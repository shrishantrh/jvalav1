

# Fix: Make the AI Assistant Actually Useful

## Problem
The AI has ALL the user's data in its system prompt but still deflects with "I can't do that" responses. It also lacks key analyses (medication effectiveness, 30-day filtering) and the suggested prompts lead to dead ends.

## Root Causes
1. The system prompt in `limitless-ai` tells the AI what data it has but doesn't provide **pre-computed answers** for common questions, so the model struggles to interpret raw JSON
2. Medication analysis only tracks "flares within 24h of dose" but not effectiveness (severity changes, flare-free windows)
3. The prompt lacks explicit instructions like "You CAN filter by any time range — the data includes timestamps"
4. No daily/weekly breakdown is pre-computed for the "show me a chart of flares over 30 days" question
5. Follow-up suggestions promise things the AI can't deliver

## Solution

### 1. Pre-compute answers for common questions in `limitless-ai/index.ts`

Add pre-computed analytics that the AI can directly reference:

- **Daily flare counts for last 30 days** (so "show me flares over 30 days" just works)
- **Medication effectiveness**: for each medication, compute severity before vs after, flare-free days after taking it, and whether flares reduce in frequency/severity
- **Weekly severity trends** with severity breakdown per week
- **Trigger-to-outcome analysis**: which triggers lead to which symptoms and how often

### 2. Strengthen the system prompt anti-deflection rules

Add explicit instructions:
- "You have 30-day, 7-day, and all-time data pre-computed below. When asked about any time period, USE IT."
- "You CAN analyze medication effectiveness. The data below shows flare severity before and after each medication."
- "NEVER say 'I can't filter', 'I can't track effectiveness', or 'I can only show X'. You HAVE the data. USE it."
- "When asked 'show me a chart', populate the chart data array with ACTUAL numbers from the pre-computed data below — not placeholders."

### 3. Add medication effectiveness analysis

Compute for each medication:
- Average severity of flares within 24h BEFORE taking it vs 24h AFTER
- Number of flare-free days following medication
- Whether the user's flare frequency dropped during periods of consistent use
- Correlation strength

### 4. Add daily granularity data for chart generation

Pre-compute a day-by-day array for the last 30 days:
```
{ date: "Feb 1", flares: 2, avgSeverity: 1.5, mild: 1, moderate: 1, severe: 0 }
```
So when the AI generates a chart, it can directly use real data points.

### 5. Fix suggested prompts in `AIChatPrompts.tsx`

Update prompts to match what the AI can actually answer, and make them more specific to the user's data.

## Files to Change

1. **`supabase/functions/limitless-ai/index.ts`** — Add pre-computed daily data, medication effectiveness analysis, stronger anti-deflection prompt rules
2. **`src/components/chat/AIChatPrompts.tsx`** — Update suggested prompts to be more answerable

## Technical Details

### New pre-computed data sections added to `limitless-ai`:

```text
DAILY_FLARES_30D (for chart generation):
[{ date: "Feb 1", flares: 2, mild: 1, moderate: 1, severe: 0 }, ...]

MEDICATION_EFFECTIVENESS:
- Ibuprofen: taken 5x, avg severity in 24h before: 2.3, avg severity in 24h after: 1.4 (39% reduction), avg flare-free days after: 2.1
- Insulin Aspart: taken 3x, no severity change detected, likely maintenance medication

WEEKLY_BREAKDOWN (last 8 weeks with severity):
[{ week: "Jan 27-Feb 2", total: 5, mild: 2, moderate: 2, severe: 1 }, ...]
```

### New prompt rules:
```text
CRITICAL — STOP SAYING "I CAN'T":
- "Show me flares over 30 days" → Use DAILY_FLARES_30D data to create a bar_chart or line_chart
- "What medications helped most?" → Use MEDICATION_EFFECTIVENESS to rank by severity reduction
- "Time patterns" → Use byHour and byDayOfWeek data
- "Predict flare risk" → Use trends, weather, and risk factors to give a % estimate
- You have ALL the data. There is NOTHING you "can't" show. If you catch yourself saying "I can't", STOP and look at the data sections again.
```
