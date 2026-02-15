

# Post-Onboarding App Tour

## Overview
A guided, step-by-step spotlight tour that activates immediately after a new user completes onboarding. Inspired by best-in-class mobile tours (Duolingo's coach marks, Headspace's gentle nudges, Slack's contextual tooltips), the tour uses a dark overlay with animated neon-pink spotlight cutouts and minimal one-sentence speech bubbles to walk users through the app's core features.

## Tour Flow (7 Steps)

```text
+--------------------------------------------------+
| Step 1: LOG TAB                                   |
| Spotlight: condition buttons in chat input bar    |
| Bubble: "Tap a button to log — it takes 1 second"|
| Action: User MUST log something to proceed        |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
| Step 2: LOG CONFIRMATION                          |
| Spotlight: the chat message that appeared         |
| Bubble: "Nice! Your first entry is saved."        |
| Button: [Next ->]                                 |
+--------------------------------------------------+
         |  (auto-navigate to History tab)
         v
+--------------------------------------------------+
| Step 3: HISTORY TAB                               |
| Spotlight: calendar + the new entry card          |
| Bubble: "Your logs appear here by date."          |
| Button: [Next ->]                                 |
+--------------------------------------------------+
         |  (auto-navigate to Trends tab)
         v
+--------------------------------------------------+
| Step 4: TRENDS TAB                                |
| Spotlight: insights area                          |
| Bubble: "Patterns emerge as you log more."        |
| Button: [Next ->]                                 |
+--------------------------------------------------+
         |  (scroll down, spotlight Deep Research)
         v
+--------------------------------------------------+
| Step 5: DEEP RESEARCH BUTTON                      |
| Spotlight: Deep Research / AI button               |
| Bubble: "After 10 entries, AI finds deep links."  |
| Button: [Next ->]                                 |
+--------------------------------------------------+
         |  (auto-navigate to Exports tab)
         v
+--------------------------------------------------+
| Step 6: EXPORTS TAB                               |
| Spotlight: export area                            |
| Bubble: "Share your health story with doctors."   |
| Button: [Next ->]                                 |
+--------------------------------------------------+
         |  (auto-navigate back to Log tab)
         v
+--------------------------------------------------+
| Step 7: PROFILE + STREAKS                         |
| Spotlight: profile icon in header + streak pill   |
| Bubble: "Track your streak and earn badges!"      |
| Button: [Done]                                    |
+--------------------------------------------------+
         |
         v
   Tour complete -> persist flag -> return to Log
```

## Visual Design

- **Overlay**: Full-screen semi-transparent black (`rgba(0,0,0,0.65)`) with a CSS mask or SVG cutout creating a rounded-rect spotlight hole around the target element
- **Spotlight border**: Animated glowing border using `box-shadow` with theme pink (`hsl(var(--primary))`) that pulses/fades in and out -- a neon-pink breathing effect
- **Speech bubble**: Glassmorphic card (matching existing `glass-card` aesthetic), positioned above or below the spotlight depending on available space, with a small triangle pointer
- **Text**: Single sentence, max ~60 characters, using Manrope font
- **Navigation**: "Next" pill button in the bubble, styled with the pink primary color; final step shows "Done"
- **Transitions**: Each step fades in (`animate-fade-in`), spotlight morphs position smoothly with CSS transitions

## Technical Implementation

### New Files

1. **`src/components/onboarding/AppTour.tsx`**
   - Self-contained overlay component using React Portal (`createPortal` into document.body)
   - Manages tour state (current step, completed)
   - Uses `ref` callbacks or `data-tour="step-name"` attributes on target elements to locate spotlight positions
   - Listens for entry creation event (step 1 requires user to actually log) before advancing
   - Handles tab navigation by calling the parent's `onViewChange` callback
   - CSS mask technique: a full-screen div with `pointer-events: none` except for the spotlight cutout area where the user needs to interact (step 1)

2. **`src/components/onboarding/TourSpotlight.tsx`**
   - Reusable spotlight + bubble component
   - Props: `targetRect`, `message`, `position` (above/below), `onNext`, `isLast`, `allowInteraction`
   - Animated neon border using CSS keyframes
   - Glassmorphic bubble with arrow pointer

### Modifications

3. **`src/pages/Index.tsx`**
   - Add `showTour` state, triggered after `handleOnboardingComplete` sets `showOnboarding = false`
   - Pass `data-tour` attributes to key elements (or provide refs)
   - Pass `onViewChange` and `setShowProgress` to `AppTour` so it can navigate tabs
   - Persist `tour_completed` flag in the user's profile metadata to never show again

4. **`src/components/tracking/SmartTrack.tsx`**
   - Add `data-tour="log-buttons"` to the condition quick-log buttons container
   - Expose an `onEntryLogged` callback or event so the tour knows when step 1 is complete

5. **`src/components/layout/MobileHeader.tsx`**
   - Add `data-tour="profile-button"` to the profile icon
   - Add `data-tour="streak-pill"` to the streak button

6. **`src/components/layout/MobileLayout.tsx`**
   - Add `data-tour="nav-history"`, `data-tour="nav-insights"`, `data-tour="nav-exports"` to bottom nav items

7. **`src/components/history/WeekCalendarHistory.tsx`**
   - Add `data-tour="calendar-view"` to the calendar container

8. **`src/components/insights/RevampedInsights.tsx`**
   - Add `data-tour="trends-area"` to the main insights container
   - Add `data-tour="deep-research"` to the Deep Research / AI button

9. **`src/index.css`**
   - Add `@keyframes tour-glow` animation for the neon-pink pulsing border
   - Add `.tour-spotlight` utility class

### Persistence
- On tour completion, update `profiles.metadata.tour_completed = true`
- On app load, if `onboarding_completed === true && metadata.tour_completed !== true`, trigger tour
- Tour can be dismissed at any step (small X button), which also persists the flag

### Step 1 Interaction Logic
- During step 1, the overlay allows pointer events ONLY on the spotlight area (the log buttons)
- A listener watches for the `onSave` callback to fire successfully
- Once an entry is saved, the tour auto-advances to step 2 with a 500ms delay for the confirmation message to appear

