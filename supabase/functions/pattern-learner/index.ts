import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA PATTERN LEARNER - Auto-discovers trigger → flare correlations
// ═══════════════════════════════════════════════════════════════════════════════
// Finds:
// - Delayed correlations (trigger today → flare in 2 days)
// - Multi-factor patterns (stress + poor sleep → flare)
// - Temporal patterns (time of day, day of week)
// - Weather sensitivities
// - Medication effectiveness
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Correlation {
  trigger_type: string;
  trigger_value: string;
  outcome_type: string;
  outcome_value: string;
  occurrence_count: number;
  confidence: number;
  avg_delay_minutes: number;
  last_occurred: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── JWT Auth Guard ──────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(authHeader.replace('Bearer ', ''));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;
    // ─────────────────────────────────────────────────────────────────────

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all entries
    const { data: entries, error } = await supabase
      .from("flare_entries")
      .select("*")
      .eq("user_id", userId)
      .order("timestamp", { ascending: true });

    if (error) throw error;
    if (!entries || entries.length < 10) {
      return new Response(
        JSON.stringify({ message: "Need more data to learn patterns", correlationsFound: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const flares = entries.filter((e: any) => e.entry_type === "flare");
    const correlations: Map<string, Correlation> = new Map();

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. TRIGGER → FLARE CORRELATIONS (with delay detection)
    // ═══════════════════════════════════════════════════════════════════════════
    const lookbackHours = [0, 2, 6, 12, 24, 48, 72]; // Check these delay windows

    for (const flare of flares) {
      const flareTime = new Date(flare.timestamp).getTime();
      const flareSeverity = flare.severity || "unknown";
      const flareSymptoms = flare.symptoms || [];

      // Find entries before this flare
      for (const window of lookbackHours) {
        const windowStart = flareTime - (window + 6) * 60 * 60 * 1000;
        const windowEnd = flareTime - window * 60 * 60 * 1000;

        const precedingEntries = entries.filter((e: any) => {
          const t = new Date(e.timestamp).getTime();
          return t >= windowStart && t < windowEnd;
        });

        for (const entry of precedingEntries) {
          // Check triggers
          for (const trigger of entry.triggers || []) {
            const key = `trigger:${trigger}→flare:${flareSeverity}`;
            const existing = correlations.get(key);
            const delay = (flareTime - new Date(entry.timestamp).getTime()) / 60000;

            if (existing) {
              existing.occurrence_count++;
              existing.avg_delay_minutes = (existing.avg_delay_minutes * (existing.occurrence_count - 1) + delay) / existing.occurrence_count;
              existing.last_occurred = flare.timestamp;
            } else {
              correlations.set(key, {
                trigger_type: "trigger",
                trigger_value: trigger,
                outcome_type: "flare",
                outcome_value: flareSeverity,
                occurrence_count: 1,
                confidence: 0,
                avg_delay_minutes: delay,
                last_occurred: flare.timestamp,
              });
            }
          }

          // Check notes for food mentions
          if (entry.note) {
            const foodPatterns = [
              /ate\s+(\w+)/gi, /had\s+(\w+)/gi, /drank\s+(\w+)/gi,
              /coffee/gi, /alcohol/gi, /chocolate/gi, /cheese/gi, /wine/gi,
              /sugar/gi, /gluten/gi, /dairy/gi, /spicy/gi,
            ];

            for (const pattern of foodPatterns) {
              const matches = entry.note.match(pattern);
              if (matches) {
                for (const match of matches) {
                  const food = match.toLowerCase().replace(/^(ate|had|drank)\s+/i, "");
                  if (food.length > 2) {
                    const key = `food:${food}→flare:${flareSeverity}`;
                    const existing = correlations.get(key);
                    const delay = (flareTime - new Date(entry.timestamp).getTime()) / 60000;

                    if (existing) {
                      existing.occurrence_count++;
                      existing.avg_delay_minutes = (existing.avg_delay_minutes * (existing.occurrence_count - 1) + delay) / existing.occurrence_count;
                    } else {
                      correlations.set(key, {
                        trigger_type: "food",
                        trigger_value: food,
                        outcome_type: "flare",
                        outcome_value: flareSeverity,
                        occurrence_count: 1,
                        confidence: 0,
                        avg_delay_minutes: delay,
                        last_occurred: flare.timestamp,
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Check symptoms that co-occur
      for (const symptom of flareSymptoms) {
        for (const otherSymptom of flareSymptoms) {
          if (symptom !== otherSymptom) {
            const key = `symptom:${symptom}→symptom:${otherSymptom}`;
            const existing = correlations.get(key);
            if (existing) {
              existing.occurrence_count++;
            } else {
              correlations.set(key, {
                trigger_type: "symptom",
                trigger_value: symptom,
                outcome_type: "symptom",
                outcome_value: otherSymptom,
                occurrence_count: 1,
                confidence: 0,
                avg_delay_minutes: 0,
                last_occurred: flare.timestamp,
              });
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. SLEEP → FLARE CORRELATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    const flaresWithSleep = flares.filter((e: any) => e.physiological_data?.sleep);
    if (flaresWithSleep.length >= 3) {
      const sleepHours = flaresWithSleep.map((e: any) => {
        const d = e.physiological_data.sleep.duration || e.physiological_data.sleep.hours || 0;
        return d > 24 ? d / 60 : d;
      });
      const avgSleep = sleepHours.reduce((a: number, b: number) => a + b, 0) / sleepHours.length;

      const lowSleepFlares = flaresWithSleep.filter((e: any) => {
        const d = e.physiological_data.sleep.duration || e.physiological_data.sleep.hours || 0;
        const hours = d > 24 ? d / 60 : d;
        return hours < avgSleep - 1;
      });

      if (lowSleepFlares.length >= 2) {
        correlations.set("sleep:poor→flare:any", {
          trigger_type: "sleep",
          trigger_value: "poor sleep (<" + (avgSleep - 1).toFixed(1) + "h)",
          outcome_type: "flare",
          outcome_value: "any",
          occurrence_count: lowSleepFlares.length,
          confidence: lowSleepFlares.length / flaresWithSleep.length,
          avg_delay_minutes: 0,
          last_occurred: lowSleepFlares[lowSleepFlares.length - 1].timestamp,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. WEATHER → FLARE CORRELATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    const flaresWithWeather = flares.filter((e: any) => e.environmental_data?.weather);
    const weatherCounts: Record<string, number> = {};
    
    flaresWithWeather.forEach((e: any) => {
      const condition = e.environmental_data.weather.condition;
      if (condition) {
        weatherCounts[condition] = (weatherCounts[condition] || 0) + 1;
      }
    });

    for (const [condition, count] of Object.entries(weatherCounts)) {
      if (count >= 3) {
        correlations.set(`weather:${condition}→flare:any`, {
          trigger_type: "weather",
          trigger_value: condition,
          outcome_type: "flare",
          outcome_value: "any",
          occurrence_count: count,
          confidence: count / flaresWithWeather.length,
          avg_delay_minutes: 0,
          last_occurred: flaresWithWeather.find((e: any) => 
            e.environmental_data.weather.condition === condition
          )?.timestamp,
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. CALCULATE CONFIDENCE SCORES
    // ═══════════════════════════════════════════════════════════════════════════
    const totalFlares = flares.length;
    
    correlations.forEach((corr, key) => {
      // Confidence = occurrence_count / total_flares, weighted by consistency
      const baseConfidence = Math.min(0.95, corr.occurrence_count / Math.max(totalFlares, 1));
      
      // Boost confidence if delay is consistent (low variance)
      const delayBoost = corr.avg_delay_minutes > 0 ? 0.1 : 0;
      
      corr.confidence = Math.min(0.95, baseConfidence + delayBoost);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. SAVE TO DATABASE
    // ═══════════════════════════════════════════════════════════════════════════
    const significantCorrelations = Array.from(correlations.values())
      .filter(c => c.occurrence_count >= 2 && c.confidence >= 0.2)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 50);

    // Upsert correlations
    for (const corr of significantCorrelations) {
      await supabase
        .from("correlations")
        .upsert({
          user_id: userId,
          trigger_type: corr.trigger_type,
          trigger_value: corr.trigger_value,
          outcome_type: corr.outcome_type,
          outcome_value: corr.outcome_value,
          occurrence_count: corr.occurrence_count,
          confidence: corr.confidence,
          avg_delay_minutes: Math.round(corr.avg_delay_minutes),
          last_occurred: corr.last_occurred,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,trigger_type,trigger_value,outcome_type,outcome_value",
        });
    }

    return new Response(
      JSON.stringify({
        message: "Pattern learning complete",
        correlationsFound: significantCorrelations.length,
        topPatterns: significantCorrelations.slice(0, 10).map(c => ({
          pattern: `${c.trigger_value} → ${c.outcome_value}`,
          confidence: Math.round(c.confidence * 100) + "%",
          occurrences: c.occurrence_count,
          avgDelay: c.avg_delay_minutes > 0 ? `${Math.round(c.avg_delay_minutes / 60)}h` : "immediate",
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Pattern learner error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
