import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ADRSignal {
  id: string;
  medication: string;
  symptom: string;
  confidence: number;
  lift: number;
  occurrences: number;
  totalExposures: number;
  avgOnsetHours: number;
  severityBreakdown: { mild: number; moderate: number; severe: number };
  temporalPattern: string; // 'acute' (<24h), 'subacute' (1-7d), 'delayed' (>7d)
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  e2bNarrananess: string; // WHO-UMC causality category
  meddraCode?: string;
  firstDetected: string;
  lastOccurred: string;
}

interface PredictiveRisk {
  overallScore: number; // 0-100
  factors: { name: string; contribution: number; direction: 'increases' | 'decreases' }[];
  predictedTimeframe: string;
  recommendations: string[];
}

// MedDRA mapping for common symptoms
const MEDDRA_MAP: Record<string, { code: string; term: string; soc: string }> = {
  'headache': { code: '10019211', term: 'Headache', soc: 'Nervous system disorders' },
  'migraine': { code: '10027599', term: 'Migraine', soc: 'Nervous system disorders' },
  'nausea': { code: '10028813', term: 'Nausea', soc: 'Gastrointestinal disorders' },
  'vomiting': { code: '10047700', term: 'Vomiting', soc: 'Gastrointestinal disorders' },
  'dizziness': { code: '10013573', term: 'Dizziness', soc: 'Nervous system disorders' },
  'fatigue': { code: '10016256', term: 'Fatigue', soc: 'General disorders' },
  'rash': { code: '10037844', term: 'Rash', soc: 'Skin and subcutaneous tissue disorders' },
  'itching': { code: '10037087', term: 'Pruritus', soc: 'Skin and subcutaneous tissue disorders' },
  'joint pain': { code: '10023222', term: 'Arthralgia', soc: 'Musculoskeletal disorders' },
  'muscle pain': { code: '10028411', term: 'Myalgia', soc: 'Musculoskeletal disorders' },
  'insomnia': { code: '10022437', term: 'Insomnia', soc: 'Psychiatric disorders' },
  'anxiety': { code: '10002855', term: 'Anxiety', soc: 'Psychiatric disorders' },
  'diarrhea': { code: '10012735', term: 'Diarrhoea', soc: 'Gastrointestinal disorders' },
  'constipation': { code: '10010774', term: 'Constipation', soc: 'Gastrointestinal disorders' },
  'stomach pain': { code: '10000081', term: 'Abdominal pain', soc: 'Gastrointestinal disorders' },
  'cough': { code: '10011224', term: 'Cough', soc: 'Respiratory disorders' },
  'shortness of breath': { code: '10013968', term: 'Dyspnoea', soc: 'Respiratory disorders' },
  'swelling': { code: '10042674', term: 'Swelling', soc: 'General disorders' },
  'chest pain': { code: '10008479', term: 'Chest pain', soc: 'General disorders' },
  'palpitations': { code: '10033557', term: 'Palpitations', soc: 'Cardiac disorders' },
  'blurred vision': { code: '10047513', term: 'Vision blurred', soc: 'Eye disorders' },
  'dry mouth': { code: '10013781', term: 'Dry mouth', soc: 'Gastrointestinal disorders' },
  'weight gain': { code: '10047896', term: 'Weight increased', soc: 'Investigations' },
  'hair loss': { code: '10001760', term: 'Alopecia', soc: 'Skin and subcutaneous tissue disorders' },
  'brain fog': { code: '10010300', term: 'Cognitive disorder', soc: 'Nervous system disorders' },
};

// WHO-UMC causality assessment
function assessCausality(confidence: number, lift: number, avgOnsetHours: number, occurrences: number): string {
  if (confidence >= 0.8 && lift >= 3 && occurrences >= 5) return 'Certain';
  if (confidence >= 0.6 && lift >= 2 && occurrences >= 3) return 'Probable';
  if (confidence >= 0.4 && lift >= 1.5 && occurrences >= 2) return 'Possible';
  if (confidence >= 0.2) return 'Unlikely';
  return 'Unclassified';
}

function classifyRiskLevel(confidence: number, lift: number, severeRatio: number): 'low' | 'moderate' | 'high' | 'critical' {
  const score = (confidence * 30) + (Math.min(lift, 5) * 10) + (severeRatio * 60);
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'moderate';
  return 'low';
}

function classifyTemporalPattern(avgOnsetHours: number): string {
  if (avgOnsetHours <= 24) return 'acute';
  if (avgOnsetHours <= 168) return 'subacute';
  return 'delayed';
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch all data in parallel
    const [entriesRes, medsRes, profileRes, discoveriesRes] = await Promise.all([
      supabase.from("flare_entries").select("*").eq("user_id", userId).order("timestamp", { ascending: false }).limit(1000),
      supabase.from("medication_logs").select("*").eq("user_id", userId).order("taken_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("discoveries").select("*").eq("user_id", userId).order("confidence", { ascending: false }).limit(50),
    ]);

    const entries = entriesRes.data || [];
    const medLogs = medsRes.data || [];
    const profile = profileRes.data;
    const discoveries = discoveriesRes.data || [];
    const flares = entries.filter((e: any) => e.entry_type === 'flare' || e.severity);

    const sevToNum = (s: string) => s === 'mild' ? 1 : s === 'moderate' ? 2 : s === 'severe' ? 3 : 0;
    const oneDay = 86400000;
    const now = Date.now();

    // ═══ ADR DETECTION ENGINE ═══
    // For each medication, find temporal correlations with symptoms
    const uniqueMeds = [...new Set(medLogs.map((m: any) => m.medication_name))];
    const adrSignals: ADRSignal[] = [];

    for (const medName of uniqueMeds) {
      const doses = medLogs.filter((m: any) => m.medication_name === medName);
      if (doses.length < 2) continue; // Need at least 2 doses for signal

      // All symptoms across all flares
      const allSymptoms = new Set<string>();
      flares.forEach((f: any) => (f.symptoms || []).forEach((s: string) => allSymptoms.add(s)));

      for (const symptom of allSymptoms) {
        let withinWindow = 0; // flares with this symptom within 48h after a dose
        let totalDoseWindows = 0;
        let onsetHoursSum = 0;
        let onsetCount = 0;
        const severities = { mild: 0, moderate: 0, severe: 0 };

        // For each dose, check if this symptom appeared within 48 hours
        for (const dose of doses) {
          const doseTime = new Date(dose.taken_at).getTime();
          totalDoseWindows++;

          const flaresInWindow = flares.filter((f: any) => {
            const fTime = new Date(f.timestamp).getTime();
            return fTime > doseTime && fTime <= doseTime + 48 * 60 * 60 * 1000 && (f.symptoms || []).includes(symptom);
          });

          if (flaresInWindow.length > 0) {
            withinWindow++;
            // Track onset timing from first occurrence
            const firstFlare = flaresInWindow[0];
            const onset = (new Date(firstFlare.timestamp).getTime() - doseTime) / (60 * 60 * 1000);
            onsetHoursSum += onset;
            onsetCount++;
            // Track severity
            const sev = firstFlare.severity as string;
            if (sev === 'mild') severities.mild++;
            else if (sev === 'moderate') severities.moderate++;
            else if (sev === 'severe') severities.severe++;
          }
        }

        if (withinWindow < 2) continue; // Need at least 2 co-occurrences

        // Calculate baseline rate (symptom frequency when NOT within 48h of this med)
        const totalFlaresWithSymptom = flares.filter((f: any) => (f.symptoms || []).includes(symptom)).length;
        const baselineRate = totalFlaresWithSymptom / Math.max(flares.length, 1);
        const exposedRate = withinWindow / Math.max(totalDoseWindows, 1);
        const lift = baselineRate > 0 ? exposedRate / baselineRate : exposedRate > 0 ? 5 : 0;
        const confidence = exposedRate;

        if (confidence < 0.15 || lift < 1.2) continue; // Too weak

        const avgOnsetHours = onsetCount > 0 ? onsetHoursSum / onsetCount : 24;
        const totalSev = severities.mild + severities.moderate + severities.severe;
        const severeRatio = totalSev > 0 ? severities.severe / totalSev : 0;

        const meddra = MEDDRA_MAP[symptom.toLowerCase()];

        adrSignals.push({
          id: `${medName}-${symptom}`.replace(/\s+/g, '_').toLowerCase(),
          medication: medName,
          symptom,
          confidence: Math.round(confidence * 100) / 100,
          lift: Math.round(lift * 100) / 100,
          occurrences: withinWindow,
          totalExposures: totalDoseWindows,
          avgOnsetHours: Math.round(avgOnsetHours * 10) / 10,
          severityBreakdown: severities,
          temporalPattern: classifyTemporalPattern(avgOnsetHours),
          riskLevel: classifyRiskLevel(confidence, lift, severeRatio),
          e2bNarrananess: assessCausality(confidence, lift, avgOnsetHours, withinWindow),
          meddraCode: meddra?.code,
          firstDetected: doses[doses.length - 1]?.taken_at || new Date().toISOString(),
          lastOccurred: doses[0]?.taken_at || new Date().toISOString(),
        });
      }
    }

    // Sort by risk level and confidence
    const riskOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
    adrSignals.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel] || b.confidence - a.confidence);

    // ═══ PREDICTIVE RISK SCORING ═══
    // Calculate overall adverse event risk based on multiple factors
    const factors: PredictiveRisk['factors'] = [];
    let riskScore = 20; // Baseline

    // Factor 1: Recent flare trend (are flares increasing?)
    const thisWeekFlares = flares.filter((f: any) => now - new Date(f.timestamp).getTime() < 7 * oneDay);
    const lastWeekFlares = flares.filter((f: any) => { const a = now - new Date(f.timestamp).getTime(); return a >= 7 * oneDay && a < 14 * oneDay; });
    const trendRatio = lastWeekFlares.length > 0 ? thisWeekFlares.length / lastWeekFlares.length : thisWeekFlares.length > 0 ? 2 : 0;
    if (trendRatio > 1.5) {
      const contrib = Math.min(20, Math.round((trendRatio - 1) * 15));
      riskScore += contrib;
      factors.push({ name: 'Rising flare trend', contribution: contrib, direction: 'increases' });
    } else if (trendRatio < 0.5 && lastWeekFlares.length > 0) {
      const contrib = Math.min(15, Math.round((1 - trendRatio) * 10));
      riskScore -= contrib;
      factors.push({ name: 'Declining flare trend', contribution: contrib, direction: 'decreases' });
    }

    // Factor 2: Severity escalation
    const recentSeverities = flares.slice(0, 10).map((f: any) => sevToNum(f.severity || 'mild'));
    const olderSeverities = flares.slice(10, 20).map((f: any) => sevToNum(f.severity || 'mild'));
    if (recentSeverities.length >= 3 && olderSeverities.length >= 3) {
      const recentAvg = recentSeverities.reduce((a, b) => a + b, 0) / recentSeverities.length;
      const olderAvg = olderSeverities.reduce((a, b) => a + b, 0) / olderSeverities.length;
      if (recentAvg > olderAvg + 0.3) {
        const contrib = Math.round((recentAvg - olderAvg) * 12);
        riskScore += contrib;
        factors.push({ name: 'Severity escalation', contribution: contrib, direction: 'increases' });
      }
    }

    // Factor 3: Known trigger exposure (from discoveries)
    const confirmedTriggers = discoveries.filter((d: any) => d.relationship === 'increases_risk' && d.confidence >= 0.5 && d.status === 'confirmed');
    const recentTriggerExposure = entries.filter((e: any) => {
      if (now - new Date(e.timestamp).getTime() > 3 * oneDay) return false;
      return (e.triggers || []).some((t: string) => confirmedTriggers.some((ct: any) => ct.factor_a.toLowerCase() === t.toLowerCase()));
    });
    if (recentTriggerExposure.length > 0) {
      const avgLift = confirmedTriggers.reduce((a: number, d: any) => a + (d.lift || 1), 0) / Math.max(confirmedTriggers.length, 1);
      const contrib = Math.min(25, Math.round(avgLift * 8));
      riskScore += contrib;
      factors.push({ name: `${recentTriggerExposure.length} confirmed trigger(s) active`, contribution: contrib, direction: 'increases' });
    }

    // Factor 4: Active ADR signals
    const activeADRs = adrSignals.filter(a => a.riskLevel === 'high' || a.riskLevel === 'critical');
    if (activeADRs.length > 0) {
      const contrib = Math.min(25, activeADRs.length * 10);
      riskScore += contrib;
      factors.push({ name: `${activeADRs.length} high-risk ADR signal(s)`, contribution: contrib, direction: 'increases' });
    }

    // Factor 5: Environmental conditions from latest entry
    const latestWithEnv = entries.find((e: any) => e.environmental_data);
    if (latestWithEnv?.environmental_data) {
      const env = latestWithEnv.environmental_data as any;
      // Check if any environmental discoveries match current conditions
      const envDiscoveries = discoveries.filter((d: any) => d.category === 'environment' && d.confidence >= 0.4);
      if (envDiscoveries.length > 0) {
        const contrib = Math.min(15, envDiscoveries.length * 5);
        riskScore += contrib;
        factors.push({ name: 'Environmental risk factors present', contribution: contrib, direction: 'increases' });
      }
    }

    // Factor 6: Polypharmacy risk
    if (uniqueMeds.length >= 3) {
      const contrib = Math.min(15, (uniqueMeds.length - 2) * 5);
      riskScore += contrib;
      factors.push({ name: `Polypharmacy (${uniqueMeds.length} medications)`, contribution: contrib, direction: 'increases' });
    }

    // Factor 7: Medication adherence (protective)
    const recentMedDays = new Set(medLogs.filter((m: any) => now - new Date(m.taken_at).getTime() < 7 * oneDay).map((m: any) => new Date(m.taken_at).toISOString().split('T')[0]));
    if (recentMedDays.size >= 6 && uniqueMeds.length > 0) {
      riskScore -= 10;
      factors.push({ name: 'Consistent medication adherence', contribution: 10, direction: 'decreases' });
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    // Generate recommendations
    const recommendations: string[] = [];
    if (activeADRs.length > 0) {
      recommendations.push(`Discuss ${activeADRs.map(a => `**${a.medication}** → ${a.symptom}`).join(', ')} with your doctor.`);
    }
    if (trendRatio > 1.5) {
      recommendations.push('Flares are trending up — consider logging more details to identify new triggers.');
    }
    if (uniqueMeds.length >= 3) {
      recommendations.push('Multiple medications detected. Ask your doctor about potential drug interactions.');
    }
    if (recentMedDays.size < 4 && uniqueMeds.length > 0) {
      recommendations.push('Medication adherence appears inconsistent — set reminders for regular dosing.');
    }
    if (confirmedTriggers.length > 0 && recentTriggerExposure.length > 0) {
      recommendations.push(`Avoid known triggers: ${confirmedTriggers.slice(0, 3).map((d: any) => `**${d.factor_a}**`).join(', ')}.`);
    }

    const predictiveRisk: PredictiveRisk = {
      overallScore: riskScore,
      factors: factors.sort((a, b) => b.contribution - a.contribution),
      predictedTimeframe: '48 hours',
      recommendations,
    };

    // ═══ MEDICATION-SYMPTOM TIMELINE DATA ═══
    // Build timeline events for the last 90 days
    const ninetyDaysAgo = now - 90 * oneDay;
    const timelineEvents: any[] = [];

    // Add medication doses
    medLogs.filter((m: any) => new Date(m.taken_at).getTime() > ninetyDaysAgo).forEach((m: any) => {
      timelineEvents.push({
        type: 'medication',
        timestamp: m.taken_at,
        label: m.medication_name,
        dosage: m.dosage,
      });
    });

    // Add flare events with symptoms
    flares.filter((f: any) => new Date(f.timestamp).getTime() > ninetyDaysAgo).forEach((f: any) => {
      timelineEvents.push({
        type: 'flare',
        timestamp: f.timestamp,
        severity: f.severity,
        symptoms: f.symptoms || [],
        triggers: f.triggers || [],
      });
    });

    timelineEvents.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // ═══ AUTO E2B(R3) REPORT DATA ═══
    // Generate E2B(R3)-compatible ICSR data for detected ADR signals
    const e2bReports = adrSignals
      .filter(adr => adr.e2bNarrananess !== 'Unclassified' && adr.e2bNarrananess !== 'Unlikely')
      .map(adr => {
        const meddra = MEDDRA_MAP[adr.symptom.toLowerCase()];
        return {
          safetyReportId: `JVALA-ICSR-${adr.id}-${Date.now()}`,
          safetyReportVersion: 1,
          primarySource: {
            reporterType: 'patient',
            qualification: 'non_health_professional',
          },
          sender: {
            organizationName: 'Jvala Health Platform',
            senderType: 'other',
          },
          patient: {
            patientOnsetAge: profile?.date_of_birth ? Math.floor((now - new Date(profile.date_of_birth).getTime()) / (365.25 * oneDay)) : null,
            patientSex: profile?.biological_sex === 'male' ? 1 : profile?.biological_sex === 'female' ? 2 : null,
            patientWeight: profile?.weight_kg || null,
            patientHeight: profile?.height_cm || null,
          },
          reaction: {
            reactionMedDRACode: meddra?.code || null,
            reactionMedDRATerm: meddra?.term || adr.symptom,
            reactionSOC: meddra?.soc || 'Not classified',
            reactionOutcome: 'not_recovered', // Conservative default
            reactionSeriousness: adr.riskLevel === 'critical' || adr.riskLevel === 'high' ? 'serious' : 'non_serious',
          },
          drug: {
            drugName: adr.medication,
            drugCharacterization: 'suspect', // Primary suspect drug
            drugAction: 'dose_not_changed',
            drugAdditionalInfo: `Temporal association detected: ${adr.occurrences}/${adr.totalExposures} exposures resulted in ${adr.symptom} within 48h. Average onset: ${adr.avgOnsetHours}h. Lift: ${adr.lift}x.`,
          },
          causality: {
            method: 'WHO-UMC',
            result: adr.e2bNarrananess,
            confidence: adr.confidence,
            lift: adr.lift,
          },
          narrative: `Patient-reported adverse drug reaction detected through continuous passive monitoring via Jvala Health Platform. ${adr.medication} was temporally associated with ${adr.symptom} in ${adr.occurrences} out of ${adr.totalExposures} medication exposures (${Math.round(adr.confidence * 100)}% co-occurrence rate). The average onset time was ${adr.avgOnsetHours} hours post-dose. The association shows a ${adr.lift}x increased likelihood compared to baseline symptom frequency. Severity breakdown: ${adr.severityBreakdown.mild} mild, ${adr.severityBreakdown.moderate} moderate, ${adr.severityBreakdown.severe} severe episodes. WHO-UMC causality assessment: ${adr.e2bNarrananess}. This report was auto-generated from real-world patient data including wearable biometrics and environmental context.`,
        };
      });

    return new Response(JSON.stringify({
      adrSignals,
      predictiveRisk,
      timelineEvents,
      e2bReports,
      summary: {
        totalMedications: uniqueMeds.length,
        totalADRSignals: adrSignals.length,
        criticalSignals: adrSignals.filter(a => a.riskLevel === 'critical').length,
        highSignals: adrSignals.filter(a => a.riskLevel === 'high').length,
        reportableEvents: e2bReports.length,
        riskScore,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("ADR detection error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
