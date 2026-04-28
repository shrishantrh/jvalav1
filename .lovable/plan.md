# App Store Launch Sprint — Complete Fix Plan

17 issues, grouped by area. Each has scope, root cause, and exact fix.

---

## 1. Rate App Prompt (Native iOS)

**Issue:** Onboarding has a "rate the app" button but doesn't open the real iOS review popup.
**Fix:**
- Install `@capacitor-community/in-app-review` (or use `@capgo/capacitor-native-store-review`).
- Replace the button handler with `InAppReview.requestReview()` → triggers Apple's `SKStoreReviewController` (the real native overlay).
- Web fallback: open App Store URL in a new tab.
- Add to `capacitor.config.ts` and `Info.plist` if needed (no extra keys required).

---

## 2. App Update Prompt for Older Versions

**Issue:** When new builds ship, older installs need an "Update available" prompt.
**Fix:**
- Add a `min_supported_version` row to a new public `app_config` table (or use a static JSON in Supabase Storage for zero-cost reads).
- On app launch, native build reads `Capacitor.App.getInfo().version` and compares against remote.
- If `current < min_supported`: blocking modal "Update Required" with "Update Now" → opens `itms-apps://itunes.apple.com/app/idXXXX`.
- If `current < latest`: dismissible toast "New version available."
- Note: Apple does **not** provide an automatic in-app "update available" popup like Android. This is the standard pattern.

---

## 3. AI Cold-Start Latency + Repetitive Greeting

**Issue:** Opening app = long wait, then a generic "you haven't logged trigger data..." greeting every time. The 100s of greetings in `src/lib/greetings.ts` are not being used.
**Root cause:** The chat-assistant edge function generates the opening message live via Gemini Pro on every open instead of using the local greeting library + cached context.

**Fix:**
- **Instant greeting:** On Chat mount, immediately render a randomized greeting from `src/lib/greetings.ts` (no network call). Use time-of-day + name + last log context.
- **Background context fetch:** Only call the AI if the user sends a message. The opening message is local and instant.
- **Vary smartly:** Rotate through ~20 greeting buckets (morning, afternoon, evening, post-flare, streak, returning user, after long absence) so it feels alive.
- **AI response speed:** Switch the chat-assistant default model from Gemini 2.5 Pro → Gemini 2.5 Flash for routine messages (Pro only when explicitly analyzing trends). Memory rule already says this — enforce it.
- **Streaming:** Confirm SSE first-token < 1s by trimming system prompt (currently bloated with full conversation context every turn).

---

## 4. Quick-Log Flare Buttons — Condition-Specific

**Issue:** Buttons show generic "flare/attack/episode" instead of the user's actual conditions. Tapping should open that condition's symptom list.
**Fix in `src/components/tracking/SmartQuickLog.tsx` + `QuickTrack.tsx`:**
- Read `profiles.conditions` array (set during onboarding).
- Render one button per condition, labeled with condition name (e.g., "POTS episode," "Asthma attack," "Migraine") with condition-matched icon from `src/data/conditions.ts`.
- On tap → open a sheet with that condition's specific symptoms (from conditions.ts symptom map) pre-filtered, plus severity (Mild/Moderate/Severe).
- One-tap save creates the flare with `condition` field populated.
- If user has 1 condition → single big button. 2-3 conditions → row. 4+ → 2x2 grid.

---

## 5. AI Suggested Prompts — Rewrite to User Voice

**Issue:** Suggestions read like the AI talking ("Want to see your hourly pattern") instead of the user asking.
**Fix in `src/components/chat/AIChatPrompts.tsx`:**
- Rewrite all prompt templates from 2nd-person → 1st-person:
  - "Want to see your hourly flare pattern" → "Show me my hourly flare pattern"
  - "Should we check if you have emergency meds" → "Do I have emergency meds?"
  - "Thursdays are your worst day — what happens on Wednesdays?" → "Why are Thursdays my worst day?"
- Audit every prompt template; user is always the speaker.

---

## 6. Live Tool Telemetry Under Typing Bar

**Issue:** Only "Thinking" shows. Need granular live status + persistent post-message tags.
**Fix:**
- **Edge function** (`chat-assistant/index.ts`) emits SSE events with tool-name + target before each action:
  - `{type:'tool_start', tool:'location', detail:'Checking your current city'}`
  - `{type:'tool_start', tool:'health', detail:'Reading today's heart rate'}`
  - `{type:'tool_start', tool:'memory', detail:'Recalling your trigger history'}`
  - `{type:'tool_start', tool:'web', detail:'Searching medical literature'}`
  - `{type:'tool_start', tool:'weather', detail:'Checking pollen + AQI'}`
  - `{type:'tool_start', tool:'flares', detail:'Reviewing last 30 days of logs'}`
  - `{type:'tool_end', tool:'...'}` for cleanup
- **UI:** Single text line under the typing bar shows current action live ("Checking your location…"). When message completes, collapse all tools used into small chips below the message bubble (existing `ToolActivityChips.tsx` — wire it to the new event stream).
- Only render the live line when actively doing something (no idle "Thinking…").

---

## 7. Microphone Plist Keys (REQUIRED for App Store)

You must add these to `ios/App/App/Info.plist` (manual edit in Xcode):
```xml
<key>NSMicrophoneUsageDescription</key>
<string>Jvala uses your microphone for voice logging and conversations with your health companion.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>Jvala transcribes your voice notes locally to add to your health logs.</string>
<key>NSCameraUsageDescription</key>
<string>Jvala uses your camera to scan food and capture health photos.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Jvala needs photo library access to attach images to your health logs and import health records.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Jvala saves your exported health reports to your photo library.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Jvala uses your location to correlate weather, air quality, and pollen with your symptoms.</string>
<key>NSHealthShareUsageDescription</key>
<string>Jvala reads heart rate, sleep, and activity from Apple Health to find symptom patterns.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Jvala writes wellness data to Apple Health when you log it.</string>
<key>NSUserTrackingUsageDescription</key>
<string>Jvala does not track you across apps — this is required only for analytics.</string>
```
After adding: `npx cap sync ios` and rebuild in Xcode.

---

## 8. Trends Page — Better Analytics + "What's Inside" Info Modal

**Issue:** Trends are too generic, only flares; no insight into what the engine actually does.
**Fix:**
- **Add (i) info button** top-right of Trends → opens a full-screen sheet titled "How Jvala Analyzes You" with sections:
  - Bayesian-EWMA forecasting (with plain-English explanation)
  - CUSUM change-point detection
  - Association rule mining for triggers
  - Brier score calibration
  - Specific data sources used (logs, weather, Apple Health, Fitbit, food, mood, sleep)
  - What each one predicts for the user
- **Add new trend cards** beyond flares:
  - Sleep quality trend (from Apple Health/Fitbit)
  - Calorie + macronutrient trend (from food logs)
  - Inflammatory food ratio over time
  - Stress trend (from mood/HRV)
  - Step + activity trend
  - Trigger frequency by category
  - Per-condition flare breakdown (if multi-condition)
- **Bring back % values** but cap at 1-2 per card to avoid overwhelm.

---

## 9. Medication Effectiveness Chart Blank

**Issue:** Chart renders empty.
**Fix:**
- Audit `src/components/insights/` medication effectiveness component — it's likely querying with wrong filter (e.g., requiring both `medication_logs` and `flare_entries` joined within a window that has no data).
- Add empty state: "Log meds + flares for 7+ days to see effectiveness."
- Fix the join query to include all logged meds, score effectiveness by avg severity in 4hr window after dose vs. baseline.

---

## 10. Weekly Digest — View, Share, Notify

**Issue:** Exports page says "weekly digest ready" but nothing opens. No share. No nav badge.
**Fix:**
- **Viewer:** Tapping weekly digest card opens a beautifully formatted sheet with the report (charts, top triggers, narrative, week-over-week comparison).
- **Share:** Add native share button in the viewer → uses `navigator.share` (already memory-documented pattern) to share PDF/image.
- **Nav badge:** Add red dot on Exports tab in `MobileLayout.tsx` when `weekly_reports` has unread entries (track via `engagement.last_digest_seen_at` or new `read_at` column on `weekly_reports`).
- Clear badge when user views the digest.

---

## 11. AI Live Location/Vitals Awareness

**Issue:** AI thinks user is in old location even though it has geolocation access.
**Fix in `chat-assistant/index.ts`:**
- On EVERY message, fetch fresh location (Capacitor Geolocation, 5-min cache max) and inject into system prompt as `CURRENT CONTEXT`.
- Also inject: latest heart rate, today's step count, current weather/AQI/pollen, time of day in user's timezone, last 3 logs.
- Add a `getCurrentSituation()` helper that runs in parallel before the AI call (existing health/weather services).
- System prompt explicitly says: "Your knowledge of the user's location/vitals is from THIS context block only. Never assume from history."

---

## 12. Medical-Grade Exports (Critical — App Store Promise)

**Issue:** E2B(R3) exporting as JSON instead of XML. Other exports not standards-compliant. No native share.
**Fix:** Audit each export against official spec:
- **E2B(R3) ICSR:** Must be **XML** per ICH E2B(R3) spec (HL7 v3 messaging). Generate proper XML envelope with `<ichicsr>`, `<ichicsrmessageheader>`, `<safetyreport>` elements. Validate against ICH XSD.
- **HL7 FHIR R4:** Verify Bundle structure with `Patient`, `Observation`, `MedicationStatement`, `AllergyIntolerance`, `Condition` resources. Each resource needs proper `meta.profile` URLs.
- **MedDRA CSV:** Map symptoms to MedDRA PT/LLT codes (use existing `meddraDictionary.ts`).
- **FDA 314.80 (MedWatch):** Generate proper PDF with FDA form fields populated.
- **WHO-DD:** Medication exports use ATC codes from `whoDrugDictionary.ts`.
- **Clinical PDF:** Add proper sections per ISO/HL7 CDA: encounter, problems, meds, allergies, results, plan, signature.
- **Native share for ALL exports:** Wire every export button to `navigator.share` with the generated file (web download fallback).

---

## 13. Chat UI Fixes

**Issues:** Typing bar height misaligned with buttons. iOS keyboard pushes whole screen up instead of just the input.
**Fix:**
- **Height alignment:** Audit `src/components/chat/` input container — set fixed `h-11` on input and matching buttons, align via `items-center`.
- **iOS keyboard:**
  - Add `viewport-fit=cover` and `interactive-widget=resizes-content` to viewport meta in `index.html`.
  - On the chat screen, set `position: fixed` on the input bar with `bottom: env(safe-area-inset-bottom)` and use `visualViewport` API to track keyboard:
    ```ts
    visualViewport.addEventListener('resize', () => {
      const offset = window.innerHeight - visualViewport.height;
      inputBar.style.transform = `translateY(-${offset}px)`;
    });
    ```
  - Keep body `position: fixed; overflow: hidden` (per memory). Only the input translates.
  - On Capacitor: install `@capacitor/keyboard`, set `resize: 'none'` in capacitor.config so WebView doesn't resize.

---

## 14. ElevenLabs Voice Agent — Friend-Mode Call

**Issue:** Voice agent never set up to feel like calling a friend. Need full-screen call UI + short conversational responses.
**Full end-to-end setup:**

**A. ElevenLabs Dashboard (you do this):**
1. Go to elevenlabs.io → Conversational AI → Create Agent
2. **System prompt** (I'll provide): "You are Jvala, a warm friend who happens to know everything about the user's health. Keep responses SHORT — 1-2 sentences max. Talk like a friend on the phone, not a clinician. Use natural speech with 'um', 'mm-hmm', laughter. Never list bullet points — you're talking, not writing. Be empathetic, sometimes funny, sometimes serious. Let them vent. Ask one question at a time."
3. **Voice:** Choose warm voice (e.g., Sarah, Charlotte, or custom). Stability 50%, Similarity 75%, Speaker Boost on.
4. **First message:** Leave empty (we override per-session with personalized greeting).
5. **Enable client tools** (configure each in dashboard with these names + params):
   - `logSymptom(severity, symptoms[], note)`
   - `logMedication(name, dosage)`
   - `logMood(mood)`
   - `getCurrentVitals()` → returns context
   - `getRecentFlares(days)` → returns logs
   - `searchMemory(query)` → returns AI memories
   - `endCall()` → ends gracefully
6. **Enable conversation overrides:** prompt, firstMessage, voice (so we inject userContext per-call).
7. Copy the **Agent ID** → save as Supabase secret `ELEVENLABS_AGENT_ID`.

**B. Code changes:**
- `voice-conversation-token` edge function already exists — verify it injects userContext (name, conditions, recent logs, vitals, location, time of day) into the prompt override.
- `src/components/voice/VoiceConversation.tsx` → rebuild as full-screen takeover:
  - Black/gradient background
  - Animated orb in center that pulses with audio level (use `getOutputByteFrequencyData` for visualization)
  - User's name + "Talking with Jvala" label
  - Mute, end call, switch-to-text buttons at bottom
  - Live transcript subtle at top (optional toggle)
  - Haptic on connect/disconnect
- Phone button on chat screen → opens this full-screen view.
- Implement all 7 client tools in the React component to call back into Supabase (logFlare, logMed, etc.).

---

## 15. Microphone Button → Inline Waveform → Auto-Send

**Issue:** Mic button should immediately record + show waveform in input bar, then auto-send transcribed text with "Spoken" tag.
**Fix:**
- `InlineVoiceRecorder.tsx` already exists and does most of this. Verify:
  - Tap mic → input bar replaced by waveform (already done).
  - Tap stop → transcribe via `transcribe-voice` edge function → auto-send (currently waits for user confirm — change to auto-send).
  - Add a small "🎙️ Spoken" badge above the user's message bubble in `ChatLog.tsx` when `metadata.source === 'voice'`.

---

## 16. "Hey Jvala" Shortcut — Actually Logs

**Issue:** Shortcut just opens app instead of logging the dictated message.
**Fix:**
- Keep ONLY the "Hey Jvala" shortcut on `/shortcuts` page (remove the other 13).
- Verify the iCloud shortcut URL passes the dictated text as `?text=...&source=siri` parameter.
- `useDeepLinkHandler.ts` must:
  1. Catch `jvala://hey-jvala?text=...`
  2. POST to `chat-assistant` with the text as a user message
  3. AI extracts intent (flare? med? mood? question?) using existing conversational logging logic
  4. Saves to DB
  5. Shows confirmation toast: "Logged: moderate flare with chest pain"
- Test cold launch path (already fixed via `App.getLaunchUrl()`).

---

## 17. Bring Back Fitbit + Remove Apple Health "Coming Soon"

**Issue:** Fitbit integration was ripped out. Apple Health shows "Coming Soon" but should show connection status.
**Fix:**
- Fitbit code still exists: `fitbit-auth/`, `fitbit-callback/`, `fitbit-data/` edge functions, `fitbit_tokens` table, `FITBIT_CLIENT_ID/SECRET` secrets, `WearableIntegration.tsx`.
- In `WearableIntegration.tsx`:
  - Remove "Coming Soon" badge from Fitbit + Oura + Apple Health.
  - Wire Fitbit "Connect" button → call `fitbit-auth` edge function → opens OAuth flow.
  - Show "Connected ✓ — last sync 2m ago" when token exists.
  - Apple Health: read from `appleHealthService.ts`, show connected/not based on permission status.
- `useWearableData.ts`: ensure it fetches from BOTH Fitbit AND Apple Health, merges by timestamp, dedupes (per existing memory rule).
- AI/Trends: same data shape — no changes needed once both feed in.

---

## 18. Constant Smart Data Collection (Notifications)

**Issue:** App should proactively collect food/sleep/mood at right times.
**Fix:**
- Smart local notifications (already have `useSmartLocalNotifications.ts`):
  - **Morning (user-set time):** "How did you sleep?" → opens app to mood/sleep log.
  - **Meal times (8am/12pm/6pm):** "Quick — what did you eat?" → opens food logger.
  - **Evening:** "How was your day?" → opens stress/mood + summary.
  - **After flare:** 2hrs later → "How are you feeling now?"
- When app is opened during these windows AND no log exists in last hour, show inline prompt at top of chat: "Quick — log your [breakfast/sleep/mood]?"
- All this data feeds the new trend cards (sleep, food, stress, calories, fitness).

---

## 19. File Upload in Chat (Health Records)

**Issue:** Need + button in chat to upload files (PDFs, photos of health records).
**Fix:**
- Add `+` button left of mic in chat input.
- Tap → action sheet: Camera / Photo Library / Files.
- Uploads to `health-reports` Supabase Storage bucket (already exists), 1-hour signed URL per privacy memory.
- Sends file to AI in next message — AI uses Gemini Vision to read PDF/image, extracts key info (lab values, diagnosis, meds), saves to `ai_memories`.
- New "My Files" section in Profile → list of uploaded files with view/delete.
- AI can reference these files in future conversations ("Your March bloodwork showed elevated CRP at 8.2…").

---

## 20. Remove Profile Sharing from Profile > Personal

Just delete the share section from `ProfileSettings.tsx` / `ProfileManager.tsx`. Patient-clinician linking stays in its own dedicated panel.

---

## Execution Order (suggested for fastest ship)

1. **Plist keys** (you do in Xcode now, in parallel with my work)
2. **Profile sharing removal + AI prompt rewrite + Quick Log conditions** (fast wins)
3. **Greetings instant + model tier downgrade** (fixes biggest UX complaint)
4. **Live tool telemetry events**
5. **iOS keyboard fix + chat UI alignment**
6. **Rate app + update prompt**
7. **Fitbit reconnect + Apple Health status**
8. **Trends revamp + medication chart fix + info modal**
9. **Weekly digest viewer + share + nav badge**
10. **Voice agent full setup** (you do ElevenLabs dashboard config in parallel)
11. **Mic auto-send + Spoken tag**
12. **Hey Jvala shortcut wiring**
13. **File upload + AI vision memory**
14. **Smart proactive notifications**
15. **Live location/vitals injection**
16. **Medical-grade exports (E2B XML, FHIR validation, native share)**

---

## Questions / Clarifications Needed

1. **App Store ID** for the update prompt and rate-app deeplink (`itms-apps://...id<APP_ID>`). What's the App Store ID once submitted? I can use a placeholder constant `APP_STORE_ID` you swap later.
2. **ElevenLabs voice preference** — Sarah (warm female), Charlotte (calm female), or do you want a male voice? Or a custom cloned voice?
3. **Fitbit OAuth redirect URL** — currently set to `https://jvala.tech/auth/fitbit/callback`? Or the lovable preview? Confirm so callback works from native app.
4. **Update prompt thresholds** — should "min supported version" actually block use (force update), or always be a soft toast? My plan does both tiers — confirm.
5. **File upload size limit** — cap at 10MB per file? 20MB? PDFs of medical records can be large.

Reply with answers (or "use defaults") and I'll execute the entire sprint in order.