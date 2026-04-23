# Jvala Clinician Portal — Production Roadmap

## Vision
Transform the clinician portal from a basic SOAP note viewer into a **real Remote Patient Monitoring (RPM) + Clinical Decision Support (CDS) platform** that doctors would actually use daily. Modeled after Current Health, Validic, HeadsUp Health, and DeepCura — but purpose-built for chronic condition management.

---

## Phase 1: Clinical Foundation (Core Infrastructure)

### 1.1 — Real-Time Patient Monitoring Dashboard
- **Population-level triage view** — All linked patients on one screen, sorted by clinical urgency (not alphabetical)
- **Risk stratification engine** — Each patient gets a computed risk score (0-100) based on:
  - Flare frequency trend (7d vs prior 7d)
  - Severity escalation patterns
  - Medication adherence gaps
  - Wearable anomalies (HR spikes, sleep disruption)
  - Days since last log (engagement drop-off = clinical risk)
- **Color-coded priority bands**: Critical (red), Elevated (amber), Stable (green), Inactive (gray)
- **Sparkline vitals** — Inline mini-charts per patient showing 7-day severity trend without clicking in

### 1.2 — Clinical Inbox / Action Queue
- **Unified alert feed** — Drug interactions, severity escalations, missed doses, ADR signals, wearable anomalies all in one inbox
- **Alert tiers** (modeled after Epic BPA):
  - **Interruptive** (must acknowledge): Drug-drug interactions, severe escalation clusters
  - **Non-interruptive** (badge count): Missed doses, engagement drop-off, weather-triggered risk
- **Bulk actions** — Acknowledge, dismiss with reason, escalate to note
- **Alert fatigue reduction** — Smart suppression: don't re-alert on the same pattern within 72h unless it worsens

### 1.3 — Patient Detail: Clinical Timeline
- **Unified timeline** — Flares, medications, food logs, wearable data, AI discoveries all on one chronological view
- **Filterable by**: Date range, entry type, severity, symptom
- **Physiological overlay** — Heart rate / sleep / steps plotted against flare events (correlation at a glance)
- **Annotation capability** — Clinician can pin notes to any timeline event

---

## Phase 2: Clinical Documentation (SOAP + Beyond)

### 2.1 — AI SOAP Notes (already built, needs refinement)
- Fix: Use Lovable AI gateway models instead of `claude-sonnet` (which isn't available via gateway)
- Add: **Template library** — Pre-built SOAP templates per condition (IBD follow-up, migraine check-in, RA flare review)
- Add: **Evidence citations** — Each SOAP section links back to the specific patient log entries it was derived from
- Add: **Amendment workflow** — Finalized notes can be amended (creates new note with `amendment_of` reference)

### 2.2 — Visit Summary Generation
- Auto-generate patient-friendly visit summary from finalized SOAP note
- Share with patient via in-app notification
- PDF export with practice letterhead

### 2.3 — Clinical Letter Generator
- Referral letters, prior authorization letters, disability documentation
- Pre-populated from patient data + SOAP notes
- Editable before finalizing

---

## Phase 3: Proactive Clinical Intelligence

### 3.1 — Predictive Risk Alerts
- **Flare prediction** — "Patient X has 78% probability of flare in next 48h based on weather change + missed medication + sleep disruption"
- **Polypharmacy risk** — Flag patients on 5+ medications with known interaction pairs
- **Adherence prediction** — Detect patterns of medication non-compliance before it becomes clinical

### 3.2 — Population Analytics
- **Cohort comparison** — Compare outcomes across patient groups (by condition, medication, age)
- **Trend dashboards** — Practice-wide metrics: avg time-to-response, flare reduction rates, patient engagement scores
- **Quality metrics** — Track clinical quality measures relevant to value-based care contracts

### 3.3 — Smart Recommendations
- **Evidence-based suggestions** — "3 patients on Methotrexate showing liver enzyme elevation pattern — consider labs"
- **Guideline adherence** — Flag when patient management diverges from clinical guidelines
- **Wearable-informed insights** — "Patient's resting HR has increased 15% over 2 weeks — correlates with flare severity increase"

---

## Phase 4: Communication & Coordination

### 4.1 — Secure Messaging
- In-app messaging between clinician and patient
- Message templates for common follow-ups
- Auto-suggest messages based on patient status

### 4.2 — Care Team Coordination
- Multiple clinicians per patient (PCP, specialist, pharmacist)
- Shared notes and alerts across care team
- Referral workflow with data handoff

### 4.3 — Patient Education
- Condition-specific education materials delivered at the right moment
- Post-visit summaries with action items
- Medication guides and interaction warnings shared with patient

---

## Phase 5: Compliance & Integration

### 5.1 — Audit Trail (already built)
- HIPAA-compliant logging of all data access
- Exportable audit reports

### 5.2 — Billing / CPT Code Suggestions
- Auto-suggest appropriate CPT codes based on:
  - RPM time tracking (99453, 99454, 99457, 99458)
  - Chronic care management (99490, 99491)
  - Visit complexity from SOAP content
- Time tracking for RPM billing compliance (minimum 20 min/month)

### 5.3 — FHIR R4 Integration
- Export patient data in FHIR format for EHR interoperability
- Import patient demographics from EHR systems

---

## Implementation Priority

### Sprint 1 (Now): Fix & Refine Core
1. ✅ Fix SOAP RLS policy
2. Fix SOAP draft edge function to use Lovable AI gateway
3. Build proper clinical-grade dashboard UI (desktop-first, data-dense)
4. Wire real patient data into dashboard (risk scores, sparklines, alert counts)

### Sprint 2: Clinical Inbox + Timeline
5. Build alert inbox with triage actions
6. Build unified patient timeline view
7. Add physiological data overlay on timeline

### Sprint 3: Intelligence Layer
8. Implement predictive risk scoring for clinician view
9. Add population-level analytics
10. Smart alert suppression to reduce fatigue

### Sprint 4: Communication
11. Secure messaging
12. Visit summary sharing
13. Patient education delivery

---

## UI Principles for Clinical Portal
- **Desktop-first** — Clinicians use monitors, not phones
- **Data-dense** — Show more, click less (inspired by Epic/Cerner density)
- **Neutral palette** — Slate/zinc, no brand colors. Color = clinical meaning only (red=critical, amber=elevated, green=stable)
- **Typography** — System fonts, high readability, clear hierarchy
- **No animations** — Clinical tools need to feel fast and serious
- **Keyboard navigation** — Power users need shortcuts
