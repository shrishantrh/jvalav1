

# Consumer App: From Logging App to Intelligence Platform

## Current State Audit

**What exists and works:**
- Conversational logging (SmartTrack) with chat-based flare entry
- ~100 greetings in `greetings.ts` with contextual selection (time, streak, weather, severity)
- Tool activity chips (`ToolActivityChips.tsx`) — heuristic-based, not real telemetry
- Health forecast component with Bayesian-EWMA risk scoring
- Environmental + biometric data capture on each log (25+ fields)
- Discovery engine (Bayesian association rules)
- Voice conversation (ElevenLabs WebRTC)
- 4-tab layout: Log, History, Trends, Exports

**What is partially built:**
- Prediction engine exists but only runs on-demand (user taps refresh), not continuously
- Greetings are contextual but only ~100 variations (spec says "hundreds"), and the greeting doesn't include a proactive briefing
- Tool chips are heuristic guesses, not real telemetry from the edge function
- Weather/environmental data captured but rate-of-change analysis (6h/12h/24h pressure windows) not computed
- Correlation engine runs but doesn't proactively surface findings — waits for user to visit Trends

**What is missing entirely:**
- **Proactive morning/evening briefings** — the app should greet you with today's risk score, contributing factors, and action items without you asking
- **Background continuous analysis** — model should update after every new data point, not on-demand
- **Multi-variable prediction explanations** — "AQI 140 + <6h sleep + 8mb pressure drop = 340% increase" style
- **Proactive AI outreach** — AI should notice patterns and tell you, not wait
- **Real tool telemetry** — edge function should emit actual tool usage events, not heuristic guesses
- **24/48/72h risk windows** — currently only single timeframe
- **Pre-appointment briefing** — summarize recent data before doctor visits
- **Bloomberg-meets-consumer aesthetic** — current UI is soft/rounded consumer wellness, not data-dense intelligence

---

## What Gets Built (Priority Order: Highest Impact for YC Demo First)

### 1. Proactive Intelligence Briefing on App Open

Replace the current generic greeting with a **real-time intelligence briefing** that loads on app open.

When the user opens the Log tab, instead of just a greeting string, they see:
- **Risk score for next 24h** with confidence and top 3 contributing factors
- **What changed since last visit** — new patterns detected, severity trend direction
- **Proactive alerts** — "Barometric pressure dropping 12mb in next 6h. Last 3 times this happened, you flared within 18h."
- **Action recommendation** — specific, evidence-based

This is computed by calling the `health-forecast` edge function on app open and rendering the result as the first message in the chat, not a separate component.

**Files:** `src/components/tracking/SmartTrack.tsx`, `src/lib/greetings.ts`, `supabase/functions/health-forecast/index.ts`

### 2. Real Tool Telemetry (Not Heuristic)

Replace the heuristic `predictToolActivities()` with **real streaming telemetry** from the `chat-assistant` edge function.

The edge function already has access to user data. When it queries weather, logs, memories, or wearables, it should emit SSE events with a `tool_activity` type that the client renders as chips. This makes the "Fetching weather for San Francisco… ✓ 72°F, light rain" chips real, not guessed.

**Format:**
```
data: {"type":"tool_activity","kind":"weather","label":"Checking weather for Austin","status":"running"}
data: {"type":"tool_activity","kind":"weather","status":"done","resultSummary":"94°F, AQI 78, pressure dropping 6mb/12h"}
```

**Files:** `supabase/functions/chat-assistant/index.ts`, `src/components/tracking/SmartTrack.tsx`, `src/components/chat/ToolActivityChips.tsx`

### 3. Expand Greetings to 300+ Variations

Scale `greetings.ts` from ~100 to 300+ variations. Add new categories:
- **Condition-specific** (RA mornings, migraine weather triggers, Crohn's food patterns)
- **Medication-aware** ("Started methotrexate 3 weeks ago — how's the adjustment?")
- **Seasonal** (allergy season, winter joint stiffness, summer heat)
- **Milestone** ("100th log. Your dataset is getting serious.")
- **Curiosity-driven** ("Your Tuesday flares are 2.3x more likely than Fridays. Noticed that?")
- **Pre-appointment** ("Dr. visit tomorrow? Want me to prep a summary?")
- **Recovery tracking** ("48h since that severe flare. Recovery on track?")

Each greeting should feel like it comes from an analyst who's been studying your data, not a wellness chatbot.

**Files:** `src/lib/greetings.ts`

### 4. Multi-Signal Prediction Explanations

Upgrade the forecast display to show **multi-variable compound risk** — not just "high risk" but the specific combination:

```
FLARE RISK: 78% (next 24h)
├─ Barometric pressure: -11mb in 12h (historically triggers 3.4x)
├─ Sleep last night: 4.8h (your baseline: 7.1h)  
├─ AQI: 142 (threshold for you: 120)
└─ Confidence: 0.82 (based on 47 similar episodes)
```

With historical accuracy tracker showing the model's Brier score improving over time.

**Files:** `src/components/forecast/HealthForecast.tsx`, `supabase/functions/health-forecast/index.ts`

### 5. Proactive AI Outreach System

Build a **proactive notification pipeline** where the AI reaches out to the user:

- After analyzing new data, if a pattern shifts or anomaly detected, push a notification
- On app open, queue proactive messages: "I noticed something — your flares cluster when barometric pressure drops AND you've had less than 6h sleep. This happened 7 of the last 9 times."
- Pre-appointment briefing: if the user has logged a physician, generate a visit prep summary 24h before

This uses the existing `proactive-monitor` edge function but surfaces results as chat messages on app open rather than just notifications.

**Files:** `src/components/tracking/SmartTrack.tsx`, `supabase/functions/proactive-monitor/index.ts`

### 6. Data-Dense UI Overhaul

Shift the consumer app aesthetic from "soft wellness" to "intelligence platform that happens to be beautiful":

- **Chat messages** show data citations inline — "Based on your last 14 entries, 3 medication logs, and current environmental data"
- **Risk score always visible** in the header — small gauge that updates
- **Denser information display** — more data per screen, less whitespace padding
- **Severity history sparkline** in the header showing 7-day trend at a glance
- **Environmental context bar** — current temp, AQI, pressure with trend arrows, always visible when on Log tab

This is not a redesign — it's adding information density to the existing layout.

**Files:** `src/components/layout/MobileHeader.tsx`, `src/components/tracking/SmartTrack.tsx`, `src/index.css`

### 7. Pressure Rate-of-Change Analysis

Currently weather data captures a snapshot. Add **temporal derivative analysis**:
- Store barometric pressure at 6h intervals
- Compute rate of change over 6h, 12h, 24h windows
- Flag rapid drops (>6mb/12h) as risk amplifiers
- Include in forecast factor breakdown

**Files:** `supabase/functions/health-forecast/index.ts`, `src/services/weatherService.ts`

### 8. Background Model Updates

After every new log entry, trigger a lightweight background analysis:
- Update the user's personal correlation model
- Recompute 24h risk score
- Check for new pattern emergence
- Queue proactive insights if anything changed

Currently this only happens when the user visits Trends or explicitly asks. It should be continuous.

**Files:** `src/components/tracking/SmartTrack.tsx` (post-save hook), `supabase/functions/pattern-learner/index.ts`

---

## Technical Approach

### No new tables needed
All data structures already exist. This is about **surfacing and computing**, not storing.

### Edge function changes
- `chat-assistant`: Add real tool telemetry SSE events
- `health-forecast`: Add multi-variable compound explanations, 24/48/72h windows, rate-of-change factors
- `pattern-learner`: Trigger post-log for continuous model updates

### Client changes
- `SmartTrack.tsx`: Load proactive briefing on mount, render real tool chips from SSE
- `greetings.ts`: Expand to 300+ variations with condition/medication/pattern awareness
- `MobileHeader.tsx`: Add persistent risk gauge and environmental context bar
- `HealthForecast.tsx`: Render multi-signal factor trees with compound explanations

### No breaking changes
Everything is additive. Existing logging flow untouched. New intelligence layers on top.

---

## What This Looks Like in a YC Demo

User opens app. Instead of "Hey, how are you feeling?" they see:

> **Today's Risk: 72% — Elevated**
> Pressure dropping fast (−9mb in 12h). Last 4 times this happened with your current sleep pattern, you flared within 18 hours.
> 
> *Your model accuracy: 81% over 23 predictions*
> 
> **Since yesterday:** 2 new correlation signals detected. Your Tuesday evening flares may be linked to a specific food pattern I'm investigating.

They type "tell me more about the Tuesday pattern" and see real-time chips:
- ✓ Reading your 47 flare entries
- ✓ Analyzing food logs (last 30 days)  
- ✓ Cross-referencing environmental data
- → Running multi-variable correlation...

The response includes a specific, data-backed finding with confidence scores, not generic health advice.

That's the difference between a logging app and an intelligence platform.

