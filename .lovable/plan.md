

# Clinician Portal: Clinical-Grade RPM Overhaul

## Competitive Analysis Summary

**What Current Health, HeadsUp Health, Validic, Tellescope, and Vitalera all do:**
- Population-level triage with risk stratification and sparkline vitals per patient
- Unified patient timeline with biometrics, vitals, symptoms, medications, and environmental data overlaid
- Configurable alert thresholds (not just static rules) with fatigue suppression
- AI-generated visit prep briefs ("what changed since last visit")
- RPM billing time tracking (CPT 99453-99458) with auto-suggested codes
- Trend visualization with comparative periods (this week vs last week)
- Natural language query across patient panel ("show patients with worsening severity")
- Task management and care team coordination

**What Jvala already collects that NONE of them have:**
- Real-world environmental data (weather, AQI, UV, pollen, barometric pressure) per log
- Geolocation with city-level flare mapping
- AI-discovered correlations (Bayesian association rules with confidence scores)
- Food logging with inflammatory markers
- Voice transcripts from patient notes
- Predictive risk forecasts with Brier score calibration

**Our edge:** We have richer RWE than any competitor. The clinician portal just doesn't display any of it.

---

## What Gets Built

### 1. Population Dashboard Overhaul (`ClinicianDashboard.tsx`)

**Replace the current simple list with a data-dense clinical workstation:**

- **Command bar** at top: natural language search ("patients with severe flares this week", "on methotrexate")
- **Summary strip**: Total patients, Critical count, Open alerts, Avg health score, Active today
- **Patient table** (not cards -- a proper data table):
  - Columns: Name | Age/Sex | Conditions | Health Score (color-coded gauge) | 7d Severity Sparkline | Flares 7d/30d | Open Alerts | Last Activity | Biometric Flags
  - Sortable by any column, filterable by risk tier tabs (All / Critical / High / Moderate / Stable)
  - Inline 7-day severity sparkline per patient (tiny SVG, no library needed)
  - Biometric flag icons: heart (HR anomaly), moon (sleep disruption), thermometer (weather risk)
- **Alert inbox sidebar** (right panel on desktop): unified feed of all unacknowledged alerts across all patients, sorted by severity, with bulk acknowledge/dismiss

### 2. Patient Detail Overhaul (`ClinicianPatientDetail.tsx`)

**Replace the 4-tab layout with a comprehensive clinical chart:**

**Header card:**
- Patient demographics (name, age, sex, conditions, email)
- Health score gauge (0-100, color-coded)
- Risk tier badge
- Active medications list
- "Draft SOAP" and "Generate Visit Summary" action buttons

**Tab structure (6 tabs):**

**a. Overview**
- Vitals grid: HR (avg/min/max 7d), Sleep (avg hours), Steps (daily avg), SpO2, HRV -- pulled from `physiological_data` in `flare_entries`
- Severity trend chart (30d line chart with 7d moving average)
- Flare frequency bar chart (weekly buckets)
- Top symptoms and triggers (frequency-ranked horizontal bars)
- AI Discoveries section: show patient's `discoveries` table entries with confidence bars
- Environmental correlation summary from `environmental_data`

**b. Biometrics**
- Full physiological data display: HR, HRV, sleep duration, sleep quality, steps, calories, SpO2, skin temp
- Plot each metric over time (30d sparklines)
- Overlay flare events on the timeline to show correlations visually
- Weather/environmental overlay: barometric pressure, humidity, AQI, pollen alongside flare markers
- Location map: show patient's flare locations from `latitude`/`longitude` data

**c. Medications & Food**
- Medication timeline: when each med was taken from `medication_logs`
- Adherence gaps highlighted (expected vs actual based on `frequency`)
- Food log summary from `food_logs`: calorie trends, inflammatory markers, meal patterns
- Drug interaction matrix (from existing `drugInteractions.ts`)

**d. CDS Alerts** (existing, enhanced)
- Add alert threshold configuration per patient
- Add 72h suppression logic (don't re-alert same pattern)
- Show evidence links back to specific entries
- Interruptive vs non-interruptive tiers

**e. SOAP Notes** (existing, enhanced)
- Note history with status badges
- Click to open SOAPEditor
- Amendment workflow
- Visit summary generation from finalized SOAP

**f. Timeline**
- Unified chronological feed: flares, meds, food logs, activity logs, voice transcripts
- Each entry shows attached environmental + physiological data
- Filterable by entry type, severity, date range
- Clinician can pin annotations to any entry

### 3. New Hook: `usePatientBiometrics`

Fetches and aggregates:
- `flare_entries` with `physiological_data` and `environmental_data` for the patient
- `food_logs` for nutritional data
- `activity_logs` for exercise/activity
- `medication_logs` for adherence analysis
- `discoveries` for AI-found correlations
- `prediction_logs` for forecast history

Computes:
- 7d and 30d averages for all biometric fields
- Trend direction (improving/worsening/stable)
- Anomaly flags (>2 SD from patient's own baseline)

### 4. Sparkline Component (`components/clinician/Sparkline.tsx`)

Tiny inline SVG chart component. No charting library needed. Takes an array of values, renders a 60x20px polyline with optional color gradient (green-to-red based on severity).

### 5. Enhanced `useLinkedPatients` Hook

Add to the existing hook:
- Fetch latest `physiological_data` from most recent `flare_entry` per patient (for biometric flags)
- Fetch `environmental_data` from most recent entry
- Compute trend direction for severity (7d vs prior 7d)
- Return biometric anomaly flags

### 6. Clinical Inbox Component (`components/clinician/ClinicalInbox.tsx`)

- Fetches `clinical_alerts` across ALL linked patients
- Groups by severity tier
- Bulk actions: acknowledge selected, dismiss with reason
- Click alert to navigate to patient detail
- 72h suppression: alerts of same `alert_type` for same patient within 72h are collapsed

### 7. Visit Summary Generation

- New edge function `generate-visit-summary` that takes a finalized SOAP note ID
- Uses Lovable AI gateway (gemini-2.5-flash) to generate patient-friendly markdown summary
- Saves to `visit_summaries` table
- Clinician can share with patient (sets `shared_with_patient = true`)

### 8. RPM Time Tracking (Database + UI)

- Migration: create `rpm_time_entries` table (clinician_id, patient_id, start_time, end_time, activity_type, duration_seconds)
- Auto-track time spent on each patient detail page
- Monthly summary with CPT code suggestions:
  - 99453: Initial setup
  - 99454: Device supply (30d monitoring)
  - 99457: First 20 min RPM management
  - 99458: Each additional 20 min
- Display in dashboard sidebar

### 9. UI Design System for Clinical Portal

**Desktop-first, data-dense, zero decoration:**
- Background: `#FAFAFA` (not white, reduces eye strain)
- Cards: white, 1px `#E5E7EB` border, no shadow, no rounded corners beyond 4px
- Text: system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`), not Manrope
- Color = clinical meaning ONLY:
  - Red `#DC2626`: critical/severe
  - Amber `#D97706`: warning/elevated
  - Green `#059669`: stable/normal
  - Blue `#2563EB`: informational/links
  - Gray `#6B7280`: secondary text
- No gradients, no brand colors, no animations
- Dense spacing: 12px padding on cards, 8px gaps
- Tables use alternating row backgrounds `#F9FAFB`

### 10. Database Migrations

```sql
-- RPM time tracking for billing
CREATE TABLE public.rpm_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinician_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  activity_type text NOT NULL DEFAULT 'chart_review',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rpm_time_entries ENABLE ROW LEVEL SECURITY;

-- Clinicians can manage their own time entries
CREATE POLICY "Clinicians manage own time entries"
ON public.rpm_time_entries FOR ALL TO authenticated
USING (auth.uid() = clinician_id)
WITH CHECK (auth.uid() = clinician_id);

-- clinical_alerts INSERT policy (currently missing)
CREATE POLICY "System and clinicians can insert alerts"
ON public.clinical_alerts FOR INSERT TO authenticated
WITH CHECK (is_clinician_for_patient(auth.uid(), patient_id));
```

---

## Files Changed/Created

| File | Action |
|------|--------|
| `src/pages/ClinicianDashboard.tsx` | Rewrite -- data table, sparklines, alert inbox |
| `src/pages/ClinicianPatientDetail.tsx` | Rewrite -- 6-tab clinical chart with biometrics |
| `src/components/clinician/Sparkline.tsx` | Create -- inline SVG sparkline |
| `src/components/clinician/ClinicalInbox.tsx` | Create -- cross-patient alert feed |
| `src/components/clinician/BiometricsPanel.tsx` | Create -- vitals grid + charts |
| `src/components/clinician/MedicationTimeline.tsx` | Create -- med adherence view |
| `src/components/clinician/PatientTimeline.tsx` | Create -- unified entry feed |
| `src/components/clinician/RPMTimeTracker.tsx` | Create -- billing time tracker |
| `src/hooks/usePatientBiometrics.ts` | Create -- aggregated biometric data |
| `src/hooks/useLinkedPatients.ts` | Enhance -- add biometric flags, trends |
| `supabase/functions/generate-visit-summary/index.ts` | Create |
| `src/index.css` | Update clinical shell styles |
| Migration SQL | RPM time entries table + clinical_alerts INSERT policy |

