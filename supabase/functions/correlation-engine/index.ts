import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ══════════════════════════════════════════════════════════════════════════════
// JVALA DISCOVERY ENGINE v3 — Bayesian Association Rule Mining
// 
// Inspired by:
// - Apriori algorithm for association rule mining (Agrawal & Srikant, 1994)
// - Bayesian posterior updating for confidence tracking
// - Lift ratio for measuring association strength vs random chance
// - Fisher's exact test approximation for small-sample significance
// - Temporal pattern mining with configurable lag windows
// ══════════════════════════════════════════════════════════════════════════════

interface FlareEntry {
  id: string;
  user_id: string;
  entry_type: string;
  severity?: string;
  symptoms?: string[];
  triggers?: string[];
  note?: string;
  timestamp: string;
  environmental_data?: any;
  physiological_data?: any;
  city?: string;
  medications?: string[];
}

// ── Statistical helpers ─────────────────────────────────────────────────────

/** Bayesian confidence update: P(trigger causes flare | data) */
function bayesianConfidence(occurrences: number, totalExposures: number, baseRate: number): number {
  // Beta-Binomial model: prior = Beta(1, 1) (uniform)
  // Posterior = Beta(1 + hits, 1 + misses)
  const hits = occurrences;
  const misses = totalExposures - occurrences;
  const alpha = 1 + hits;
  const beta = 1 + misses;
  const posterior = alpha / (alpha + beta);
  
  // Adjust for base rate: if flares happen 30% of the time anyway,
  // a trigger that causes flares 35% of the time isn't very interesting
  const liftOverBase = baseRate > 0 ? posterior / baseRate : posterior;
  
  // Scale: raw posterior weighted by how much it exceeds base rate
  return Math.min(0.99, posterior * Math.min(liftOverBase, 3) / 3);
}

/** Association rule lift: P(A∩B) / (P(A) × P(B)) */
function calculateLift(coOccurrences: number, totalA: number, totalB: number, totalN: number): number {
  if (totalA === 0 || totalB === 0 || totalN === 0) return 1;
  const pAB = coOccurrences / totalN;
  const pA = totalA / totalN;
  const pB = totalB / totalN;
  return pAB / (pA * pB);
}

/** Simple p-value approximation using binomial test */
function approxPValue(observed: number, total: number, expectedRate: number): number {
  if (total === 0) return 1;
  const expected = total * expectedRate;
  const variance = total * expectedRate * (1 - expectedRate);
  if (variance === 0) return 1;
  const z = (observed - expected) / Math.sqrt(variance);
  // Approximate one-sided p-value from z-score
  return Math.max(0.001, Math.min(1, 0.5 * Math.exp(-0.5 * z * z)));
}

/** Determine discovery status from confidence + evidence */
function getStatus(confidence: number, occurrences: number, pValue: number): string {
  if (confidence >= 0.7 && occurrences >= 5 && pValue < 0.05) return 'strong';
  if (confidence >= 0.5 && occurrences >= 3 && pValue < 0.1) return 'confirmed';
  if (confidence >= 0.3 && occurrences >= 2) return 'investigating';
  if (confidence < 0.15 && occurrences >= 5) return 'disproven';
  if (confidence < 0.2 && occurrences >= 3) return 'declining';
  return 'emerging';
}

// ── Extraction helpers ──────────────────────────────────────────────────────

function extractFoodFromNote(note: string): string[] {
  const foods: string[] = [];
  // Match "Ate X" patterns
  const ateMatch = note.match(/(?:ate|eating|had|consumed|drank|drinking)\s+(.+?)(?:\.|$|,|\n)/gi);
  if (ateMatch) {
    ateMatch.forEach(m => {
      const food = m.replace(/^(?:ate|eating|had|consumed|drank|drinking)\s+/i, '').trim();
      if (food.length > 1 && food.length < 60) foods.push(food.toLowerCase());
    });
  }
  return foods;
}

function extractWeatherBucket(envData: any): Record<string, string> {
  const buckets: Record<string, string> = {};
  const weather = envData?.weather;
  if (!weather) return buckets;
  
  if (weather.temperature !== undefined) {
    const t = weather.temperature;
    buckets['temperature'] = t < 32 ? 'freezing' : t < 50 ? 'cold' : t < 68 ? 'cool' : t < 85 ? 'warm' : 'hot';
  }
  if (weather.humidity !== undefined) {
    const h = weather.humidity;
    buckets['humidity'] = h < 30 ? 'low_humidity' : h < 60 ? 'moderate_humidity' : 'high_humidity';
  }
  if (weather.pressure !== undefined) {
    const p = weather.pressure;
    buckets['pressure'] = p < 1005 ? 'low_pressure' : p < 1020 ? 'normal_pressure' : 'high_pressure';
  }
  if (weather.condition) {
    buckets['weather_condition'] = weather.condition.toLowerCase();
  }
  
  // AQI
  const aqi = envData?.airQuality;
  if (aqi) {
    const aqiVal = aqi.overall_aqi || aqi.us_aqi || aqi.european_aqi;
    if (aqiVal !== undefined) {
      buckets['aqi'] = aqiVal <= 50 ? 'good_air' : aqiVal <= 100 ? 'moderate_air' : 'poor_air';
    }
  }
  
  // Pollen
  const pollen = envData?.pollen;
  if (pollen) {
    if (pollen.grass_pollen > 50) buckets['pollen_grass'] = 'high_grass_pollen';
    if (pollen.tree_pollen > 50) buckets['pollen_tree'] = 'high_tree_pollen';
  }
  
  return buckets;
}

function extractPhysioBuckets(physio: any): Record<string, string> {
  const buckets: Record<string, string> = {};
  if (!physio) return buckets;
  
  if (physio.heartRate) {
    const hr = physio.heartRate;
    buckets['heart_rate'] = hr < 60 ? 'low_hr' : hr < 80 ? 'normal_hr' : hr < 100 ? 'elevated_hr' : 'high_hr';
  }
  if (physio.hrv || physio.hrvRmssd) {
    const hrv = physio.hrv || physio.hrvRmssd;
    buckets['hrv'] = hrv < 20 ? 'very_low_hrv' : hrv < 40 ? 'low_hrv' : hrv < 60 ? 'moderate_hrv' : 'high_hrv';
  }
  if (physio.sleepDuration || physio.sleep?.totalMinutes) {
    const sleepH = (physio.sleepDuration || (physio.sleep?.totalMinutes / 60)) || 0;
    buckets['sleep'] = sleepH < 5 ? 'very_poor_sleep' : sleepH < 6 ? 'poor_sleep' : sleepH < 7 ? 'fair_sleep' : sleepH < 9 ? 'good_sleep' : 'oversleep';
  }
  if (physio.steps !== undefined) {
    buckets['activity'] = physio.steps < 3000 ? 'sedentary' : physio.steps < 7000 ? 'light_activity' : physio.steps < 10000 ? 'moderate_activity' : 'high_activity';
  }
  if (physio.spo2) {
    buckets['spo2'] = physio.spo2 < 94 ? 'low_spo2' : 'normal_spo2';
  }
  
  return buckets;
}

function getTimeOfDay(timestamp: string, timezone?: string): string {
  try {
    const d = new Date(timestamp);
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone || 'UTC' }).formatToParts(d);
    const h = parseInt(parts.find(p => p.type === "hour")?.value || "12", 10);
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  } catch { return 'unknown'; }
}

function getDayOfWeek(timestamp: string, timezone?: string): string {
  try {
    const d = new Date(timestamp);
    return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: timezone || 'UTC' }).format(d).toLowerCase();
  } catch { return 'unknown'; }
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS ENGINE
// ══════════════════════════════════════════════════════════════════════════════

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { action, data } = await req.json();
    console.log(`🧠 Discovery Engine: ${action} for user ${userId}`);

    switch (action) {
      // ── DEEP ANALYSIS ─────────────────────────────────────────────────
      // Runs comprehensive association rule mining across ALL dimensions
      case 'deep_analysis': {
        const timezone = data?.timezone || 'UTC';
        
        // Fetch all entries (up to 1000)
        const { data: entries } = await supabase
          .from('flare_entries')
          .select('*')
          .eq('user_id', userId)
          .order('timestamp', { ascending: false })
          .limit(1000);

        if (!entries || entries.length < 5) {
          return new Response(JSON.stringify({ 
            discoveries: [], 
            message: 'Need at least 5 entries for analysis' 
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const flares = entries.filter(e => e.entry_type === 'flare' || e.severity);
        const allEntries = entries;
        const totalN = allEntries.length;
        const flareRate = flares.length / Math.max(totalN, 1); // base rate of flaring

        // ── Build factor occurrence maps ──────────────────────────────
        // For each factor, track: total times it appeared, times followed by a flare
        const factorMap: Record<string, {
          category: string;
          totalAppearances: number;
          withFlare: number;
          withSevere: number;
          flareIds: string[];
          delays: number[]; // hours between factor and subsequent flare
        }> = {};

        const addFactor = (key: string, category: string, entryId: string, hadFlare: boolean, severity?: string, delayHours?: number) => {
          if (!factorMap[key]) {
            factorMap[key] = { category, totalAppearances: 0, withFlare: 0, withSevere: 0, flareIds: [], delays: [] };
          }
          factorMap[key].totalAppearances++;
          if (hadFlare) {
            factorMap[key].withFlare++;
            factorMap[key].flareIds.push(entryId);
            if (delayHours !== undefined) factorMap[key].delays.push(delayHours);
          }
          if (severity === 'severe' || severity === 'moderate') factorMap[key].withSevere++;
        };

        // ── Extract factors from every entry ─────────────────────────
        for (let i = 0; i < allEntries.length; i++) {
          const entry = allEntries[i];
          const isFlare = entry.entry_type === 'flare' || !!entry.severity;
          
          // Look ahead: did a flare happen within 48h after this entry?
          const entryTime = new Date(entry.timestamp).getTime();
          const nextFlare = flares.find(f => {
            const ft = new Date(f.timestamp).getTime();
            return ft > entryTime && ft < entryTime + 48 * 3600000 && f.id !== entry.id;
          });
          const hadFlareAfter = !!nextFlare || isFlare;
          const delayHours = nextFlare ? (new Date(nextFlare.timestamp).getTime() - entryTime) / 3600000 : 0;

          // 1. FOOD — from notes
          if (entry.note) {
            const foods = extractFoodFromNote(entry.note);
            foods.forEach(food => addFactor(`food:${food}`, 'food', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours));
          }

          // 2. WEATHER — bucketed
          if (entry.environmental_data) {
            const weatherBuckets = extractWeatherBucket(entry.environmental_data);
            Object.entries(weatherBuckets).forEach(([type, bucket]) => {
              addFactor(`weather:${type}:${bucket}`, 'weather', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours);
            });
          }

          // 3. PHYSIOLOGICAL — bucketed
          if (entry.physiological_data) {
            const physioBuckets = extractPhysioBuckets(entry.physiological_data);
            Object.entries(physioBuckets).forEach(([type, bucket]) => {
              addFactor(`physio:${type}:${bucket}`, 'physiological', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours);
            });
          }

          // 4. TIME patterns
          const tod = getTimeOfDay(entry.timestamp, timezone);
          const dow = getDayOfWeek(entry.timestamp, timezone);
          if (isFlare) {
            addFactor(`time:tod:${tod}`, 'time', entry.id, true, entry.severity, 0);
            addFactor(`time:dow:${dow}`, 'time', entry.id, true, entry.severity, 0);
          }

          // 5. LOCATION
          if (entry.city && isFlare) {
            addFactor(`location:${entry.city.toLowerCase()}`, 'location', entry.id, true, entry.severity, 0);
          }

          // 6. EXPLICIT TRIGGERS
          (entry.triggers || []).forEach((t: string) => {
            addFactor(`trigger:${t.toLowerCase()}`, 'lifestyle', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours);
          });

          // 7. MEDICATIONS — track as potential protective factors
          (entry.medications || []).forEach((m: string) => {
            addFactor(`medication:${m.toLowerCase()}`, 'medication', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours);
          });

          // 8. ACTIVITY TYPE for non-flare entries
          if (entry.entry_type && entry.entry_type !== 'flare') {
            addFactor(`activity:${entry.entry_type}`, 'activity', entry.id, hadFlareAfter, nextFlare?.severity || entry.severity, delayHours);
          }

          // 9. SYMPTOM CO-OCCURRENCES (which symptoms cluster together)
          if (isFlare && entry.symptoms && entry.symptoms.length >= 2) {
            for (let a = 0; a < entry.symptoms.length; a++) {
              for (let b = a + 1; b < entry.symptoms.length; b++) {
                const pair = [entry.symptoms[a], entry.symptoms[b]].sort().join(' + ');
                addFactor(`symptom_pair:${pair.toLowerCase()}`, 'pattern', entry.id, true, entry.severity, 0);
              }
            }
          }
        }

        // ── Compute discovery scores ─────────────────────────────────
        const discoveries: any[] = [];
        const flareCount = flares.length;

        for (const [key, stats] of Object.entries(factorMap)) {
          if (stats.totalAppearances < 2) continue; // need at least 2 data points
          
          const [category, ...rest] = key.split(':');
          const factorName = rest.join(':');
          
          const confidence = bayesianConfidence(stats.withFlare, stats.totalAppearances, flareRate);
          const lift = calculateLift(stats.withFlare, stats.totalAppearances, flareCount, totalN);
          const pValue = approxPValue(stats.withFlare, stats.totalAppearances, flareRate);
          const avgDelay = stats.delays.length > 0 ? stats.delays.reduce((a, b) => a + b, 0) / stats.delays.length : null;
          
          // Only keep interesting discoveries (lift > 1.2 or confidence > 0.25)
          if (lift < 1.1 && confidence < 0.25) continue;
          
          const status = getStatus(confidence, stats.withFlare, pValue);
          if (status === 'disproven') continue;

          // Determine relationship type
          const isMed = category === 'medication';
          const relationship = isMed && lift < 0.8 ? 'decreases_risk' : 
                              lift > 1.2 ? 'increases_risk' : 'correlates_with';

          // Determine discovery_type
          let discoveryType = 'correlation';
          if (category === 'food' || category === 'trigger' || category === 'lifestyle') discoveryType = 'trigger';
          if (category === 'pattern') discoveryType = 'pattern';
          if (category === 'medication' && lift < 0.8) discoveryType = 'protective_factor';
          if (category === 'time') discoveryType = 'pattern';

          // Build human-readable evidence
          const pct = Math.round((stats.withFlare / stats.totalAppearances) * 100);
          let evidence = `${stats.withFlare} out of ${stats.totalAppearances} times (${pct}%) this occurred, a flare followed.`;
          if (avgDelay && avgDelay > 0.5) evidence += ` Average delay: ${avgDelay < 1 ? Math.round(avgDelay * 60) + ' minutes' : avgDelay.toFixed(1) + ' hours'}.`;
          if (lift > 1.5) evidence += ` This is ${lift.toFixed(1)}x more likely than random chance.`;
          if (pValue < 0.05) evidence += ` Statistically significant (p<0.05).`;

          // Determine factor_b based on most common symptom that co-occurred
          let factorB = 'flare';
          if (category === 'pattern' && factorName.startsWith('symptom_pair:')) {
            factorB = null; // symptom pairs don't have a factor_b
          }

          discoveries.push({
            user_id: userId,
            discovery_type: discoveryType,
            category: category === 'trigger' ? 'lifestyle' : category,
            factor_a: factorName,
            factor_b: factorB,
            relationship,
            occurrence_count: stats.withFlare,
            total_exposures: stats.totalAppearances,
            confidence,
            lift,
            avg_delay_hours: avgDelay,
            p_value: pValue,
            supporting_entry_ids: stats.flareIds.slice(0, 20),
            evidence_summary: evidence,
            status,
            last_evidence_at: new Date().toISOString(),
          });
        }

        // Sort by confidence × lift (most interesting first)
        discoveries.sort((a, b) => (b.confidence * (b.lift || 1)) - (a.confidence * (a.lift || 1)));

        // Upsert top 50 discoveries into the table
        const topDiscoveries = discoveries.slice(0, 50);
        for (const disc of topDiscoveries) {
          const { data: existing } = await supabase
            .from('discoveries')
            .select('id, surfaced_at, confidence, occurrence_count')
            .eq('user_id', userId)
            .eq('factor_a', disc.factor_a)
            .eq('category', disc.category)
            .is('factor_b', disc.factor_b)
            .maybeSingle();

          // Also check with factor_b match
          const { data: existingWithB } = !existing ? await supabase
            .from('discoveries')
            .select('id, surfaced_at, confidence, occurrence_count')
            .eq('user_id', userId)
            .eq('factor_a', disc.factor_a)
            .eq('factor_b', disc.factor_b || 'flare')
            .eq('category', disc.category)
            .maybeSingle() : { data: existing };

          const match = existing || existingWithB;

          if (match) {
            // Update existing — preserve surfaced_at
            await supabase
              .from('discoveries')
              .update({
                occurrence_count: disc.occurrence_count,
                total_exposures: disc.total_exposures,
                confidence: disc.confidence,
                lift: disc.lift,
                avg_delay_hours: disc.avg_delay_hours,
                p_value: disc.p_value,
                supporting_entry_ids: disc.supporting_entry_ids,
                evidence_summary: disc.evidence_summary,
                status: disc.status,
                last_evidence_at: disc.last_evidence_at,
              })
              .eq('id', match.id);
          } else {
            // Insert new
            await supabase
              .from('discoveries')
              .insert(disc)
              .select()
              .maybeSingle();
          }
        }

        // Find NEW discoveries that haven't been surfaced yet (confidence >= 0.3)
        const { data: unsurfaced } = await supabase
          .from('discoveries')
          .select('*')
          .eq('user_id', userId)
          .is('surfaced_at', null)
          .gte('confidence', 0.3)
          .order('confidence', { ascending: false })
          .limit(5);

        console.log(`✅ Deep analysis complete: ${topDiscoveries.length} discoveries tracked, ${unsurfaced?.length || 0} new to surface`);

        return new Response(JSON.stringify({
          totalAnalyzed: entries.length,
          discoveriesTracked: topDiscoveries.length,
          newDiscoveries: unsurfaced || [],
          topDiscoveries: topDiscoveries.slice(0, 10),
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── GET DISCOVERIES ───────────────────────────────────────────────
      case 'get_discoveries': {
        const { minConfidence = 0.2, status: filterStatus } = data || {};
        
        let query = supabase
          .from('discoveries')
          .select('*')
          .eq('user_id', userId)
          .gte('confidence', minConfidence)
          .order('confidence', { ascending: false })
          .limit(30);

        if (filterStatus) {
          query = query.eq('status', filterStatus);
        }

        const { data: discoveries } = await query;

        return new Response(JSON.stringify({
          discoveries: discoveries || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── GET UNSURFACED ────────────────────────────────────────────────
      case 'get_unsurfaced': {
        const { data: unsurfaced } = await supabase
          .from('discoveries')
          .select('*')
          .eq('user_id', userId)
          .is('surfaced_at', null)
          .gte('confidence', 0.3)
          .order('confidence', { ascending: false })
          .limit(5);

        return new Response(JSON.stringify({
          discoveries: unsurfaced || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ── MARK SURFACED ─────────────────────────────────────────────────
      case 'mark_surfaced': {
        const { discoveryIds } = data;
        if (discoveryIds?.length) {
          await supabase
            .from('discoveries')
            .update({ surfaced_at: new Date().toISOString() })
            .in('id', discoveryIds)
            .eq('user_id', userId);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── ACKNOWLEDGE ───────────────────────────────────────────────────
      case 'acknowledge': {
        const { discoveryId } = data;
        await supabase
          .from('discoveries')
          .update({ acknowledged_at: new Date().toISOString() })
          .eq('id', discoveryId)
          .eq('user_id', userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Legacy: detect_activity (keep backward compat) ────────────────
      case 'detect_activity': {
        const { message } = data;
        const ACTIVITY_PATTERNS = [
          { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
          { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
          { pattern: /(?:ate|eating|had)\s+(.+?)(?:\s+for\s+)?(?:breakfast|lunch|dinner|meal)?/i, type: 'eat', intensity: 'low' },
          { pattern: /(?:stressed|stress|anxious|anxiety)/i, type: 'stress', intensity: 'high' },
        ];
        
        for (const { pattern, type, intensity } of ACTIVITY_PATTERNS) {
          const match = message?.toLowerCase()?.match(pattern);
          if (match) {
            const { data: activityLog } = await supabase
              .from('activity_logs')
              .insert({ user_id: userId, activity_type: type, activity_value: match[1] || undefined, intensity, timestamp: new Date().toISOString(), followed_up: false })
              .select().single();
            return new Response(JSON.stringify({ detected: true, activity: { type, intensity }, activityLog }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        return new Response(JSON.stringify({ detected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // ── Legacy: get_high_confidence ────────────────────────────────────
      case 'get_high_confidence': {
        const { data: highConf } = await supabase
          .from('discoveries')
          .select('*')
          .eq('user_id', userId)
          .gte('confidence', 0.4)
          .in('status', ['confirmed', 'strong'])
          .order('confidence', { ascending: false })
          .limit(20);
        return new Response(JSON.stringify({ correlations: highConf || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('❌ Discovery Engine Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
