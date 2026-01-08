import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// JVALA HEALTH FORECAST ENGINE - Personal Flare Risk Prediction
// ═══════════════════════════════════════════════════════════════════════════════
// Predicts tomorrow's health based on sleep, activity, stress, weather, cycle, patterns
// ═══════════════════════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RiskFactor {
  factor: string;
  impact: number; // -1 to 1, negative = protective, positive = risk
  confidence: number;
  evidence: string;
  category: "sleep" | "activity" | "stress" | "weather" | "cycle" | "pattern" | "medication" | "trigger";
}

interface Forecast {
  riskScore: number; // 0-100
  riskLevel: "low" | "moderate" | "high" | "very_high";
  confidence: number;
  factors: RiskFactor[];
  prediction: string;
  recommendations: string[];
  protectiveFactors: string[];
  timeframe: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, currentWeather, wearableData, menstrualDay } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all relevant data in parallel
    const [entriesResult, correlationsResult, profileResult, engagementResult] = await Promise.all([
      supabase
        .from("flare_entries")
        .select("*")
        .eq("user_id", userId)
        .order("timestamp", { ascending: false })
        .limit(200),
      supabase
        .from("correlations")
        .select("*")
        .eq("user_id", userId)
        .order("confidence", { ascending: false }),
      supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single(),
      supabase
        .from("engagement")
        .select("*")
        .eq("user_id", userId)
        .single(),
    ]);

    const entries = entriesResult.data || [];
    const correlations = correlationsResult.data || [];
    const profile = profileResult.data;

    if (entries.length < 5) {
      return new Response(
        JSON.stringify({
          forecast: {
            riskScore: 50,
            riskLevel: "moderate",
            confidence: 0.2,
            factors: [],
            prediction: "Not enough data yet. Keep logging for 1-2 weeks to unlock personalized predictions.",
            recommendations: ["Log how you feel daily", "Connect a wearable for automatic data"],
            protectiveFactors: [],
            timeframe: "next 24 hours",
          },
          needsMoreData: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate risk factors
    const factors: RiskFactor[] = [];
    const flares = entries.filter((e: any) => e.entry_type === "flare");
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. SLEEP ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    if (wearableData?.sleep) {
      const sleepHours = wearableData.sleep.duration || wearableData.sleep.hours;
      const sleepQuality = wearableData.sleep.quality;

      // Calculate user's baseline sleep from historical data
      const entriesWithSleep = entries.filter((e: any) => e.physiological_data?.sleep?.duration);
      const avgSleep = entriesWithSleep.length > 0
        ? entriesWithSleep.reduce((acc: number, e: any) => {
            const d = e.physiological_data?.sleep?.duration || 0;
            return acc + (d > 24 ? d / 60 : d); // handle minutes vs hours
          }, 0) / entriesWithSleep.length
        : 7;

      // Sleep before flares vs baseline
      const flaresWithSleep = flares.filter((e: any) => e.physiological_data?.sleep);
      const avgSleepBeforeFlares = flaresWithSleep.length > 0
        ? flaresWithSleep.reduce((acc: number, e: any) => {
            const d = e.physiological_data?.sleep?.duration || 0;
            return acc + (d > 24 ? d / 60 : d);
          }, 0) / flaresWithSleep.length
        : avgSleep;

      if (sleepHours < avgSleep - 1.5) {
        factors.push({
          factor: "Poor sleep last night",
          impact: 0.4,
          confidence: 0.8,
          evidence: `${sleepHours.toFixed(1)}h vs your ${avgSleep.toFixed(1)}h average`,
          category: "sleep",
        });
      } else if (sleepHours >= avgSleep + 0.5) {
        factors.push({
          factor: "Good sleep last night",
          impact: -0.2,
          confidence: 0.7,
          evidence: `${sleepHours.toFixed(1)}h - above your average`,
          category: "sleep",
        });
      }

      if (sleepQuality === "poor" || sleepQuality === "restless") {
        factors.push({
          factor: "Restless sleep quality",
          impact: 0.25,
          confidence: 0.6,
          evidence: "Low sleep quality detected",
          category: "sleep",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. ACTIVITY ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    if (wearableData?.steps || wearableData?.activity?.steps) {
      const steps = wearableData.steps || wearableData.activity?.steps;
      
      // Calculate baseline
      const entriesWithSteps = entries.filter((e: any) => 
        e.physiological_data?.activity?.steps || e.physiological_data?.steps
      );
      const avgSteps = entriesWithSteps.length > 0
        ? entriesWithSteps.reduce((acc: number, e: any) => {
            return acc + (e.physiological_data?.activity?.steps || e.physiological_data?.steps || 0);
          }, 0) / entriesWithSteps.length
        : 5000;

      // Check for overexertion pattern (high activity → crash next day)
      const highActivityFlares = flares.filter((e: any) => {
        const entrySteps = e.physiological_data?.activity?.steps || e.physiological_data?.steps || 0;
        return entrySteps > avgSteps * 1.5;
      });

      if (steps > avgSteps * 1.5 && highActivityFlares.length >= 2) {
        factors.push({
          factor: "High activity yesterday",
          impact: 0.35,
          confidence: 0.7,
          evidence: `${Math.round(steps)} steps (${Math.round((steps / avgSteps - 1) * 100)}% above average) - you've crashed after high-activity days before`,
          category: "activity",
        });
      } else if (steps < avgSteps * 0.3) {
        // Very sedentary can also be a risk
        factors.push({
          factor: "Very low activity",
          impact: 0.15,
          confidence: 0.5,
          evidence: "Sedentary day detected",
          category: "activity",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. STRESS/HRV ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    if (wearableData?.hrv || wearableData?.stress) {
      const hrv = wearableData.hrv?.current || wearableData.hrv?.daily;
      const stress = wearableData.stress?.level || wearableData.stress;

      if (hrv) {
        const entriesWithHrv = entries.filter((e: any) => 
          e.physiological_data?.hrv?.current || e.physiological_data?.hrv?.daily
        );
        const avgHrv = entriesWithHrv.length > 0
          ? entriesWithHrv.reduce((acc: number, e: any) => {
              return acc + (e.physiological_data?.hrv?.current || e.physiological_data?.hrv?.daily || 0);
            }, 0) / entriesWithHrv.length
          : 50;

        if (hrv < avgHrv * 0.8) {
          factors.push({
            factor: "Low HRV (stress indicator)",
            impact: 0.3,
            confidence: 0.75,
            evidence: `HRV ${hrv}ms vs ${avgHrv.toFixed(0)}ms baseline - body is stressed`,
            category: "stress",
          });
        } else if (hrv > avgHrv * 1.1) {
          factors.push({
            factor: "Good HRV (recovery mode)",
            impact: -0.15,
            confidence: 0.65,
            evidence: "Body showing good recovery signals",
            category: "stress",
          });
        }
      }

      if (stress && stress > 70) {
        factors.push({
          factor: "Elevated stress levels",
          impact: 0.35,
          confidence: 0.7,
          evidence: `Stress at ${stress}%`,
          category: "stress",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. WEATHER ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    if (currentWeather) {
      // Check learned weather correlations
      const weatherCorrelations = correlations.filter((c: any) => 
        c.trigger_type === "weather" || 
        c.trigger_value?.toLowerCase().includes("weather") ||
        c.trigger_value?.toLowerCase().includes("pressure") ||
        c.trigger_value?.toLowerCase().includes("humidity")
      );

      // Check for pressure drops (migraine trigger)
      if (currentWeather.pressureChange && currentWeather.pressureChange < -5) {
        const pressureFlares = flares.filter((e: any) => {
          const pressure = e.environmental_data?.weather?.pressure;
          return pressure && pressure < 1010; // Low pressure
        });

        if (pressureFlares.length >= 2) {
          factors.push({
            factor: "Barometric pressure dropping",
            impact: 0.4,
            confidence: 0.7,
            evidence: `Pressure falling ${Math.abs(currentWeather.pressureChange)}mb - this has triggered you before`,
            category: "weather",
          });
        }
      }

      // Check humidity
      if (currentWeather.humidity > 80) {
        const humidFlares = flares.filter((e: any) => {
          const humidity = e.environmental_data?.weather?.humidity;
          return humidity && humidity > 75;
        });

        if (humidFlares.length >= 3) {
          factors.push({
            factor: "High humidity",
            impact: 0.25,
            confidence: 0.6,
            evidence: `${currentWeather.humidity}% humidity - correlates with your flares`,
            category: "weather",
          });
        }
      }

      // Temperature extremes
      if (currentWeather.temperature > 30 || currentWeather.temperature < 5) {
        factors.push({
          factor: "Temperature extreme",
          impact: 0.15,
          confidence: 0.5,
          evidence: `${currentWeather.temperature}°C - extreme temperatures can be triggering`,
          category: "weather",
        });
      }

      // Air quality
      if (currentWeather.aqi && currentWeather.aqi > 100) {
        factors.push({
          factor: "Poor air quality",
          impact: 0.3,
          confidence: 0.65,
          evidence: `AQI ${currentWeather.aqi} - may affect respiratory and inflammatory conditions`,
          category: "weather",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. MENSTRUAL CYCLE ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    if (menstrualDay) {
      // Find flares by cycle day
      const cycleFlares: Record<number, number> = {};
      flares.forEach((e: any) => {
        const day = e.physiological_data?.menstrual_day || e.environmental_data?.menstrual_day;
        if (day) {
          cycleFlares[day] = (cycleFlares[day] || 0) + 1;
        }
      });

      // Find peak days
      const peakDays = Object.entries(cycleFlares)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([day]) => parseInt(day));

      if (peakDays.includes(menstrualDay) || peakDays.includes(menstrualDay - 1) || peakDays.includes(menstrualDay + 1)) {
        factors.push({
          factor: `Cycle day ${menstrualDay} (high-risk window)`,
          impact: 0.45,
          confidence: 0.8,
          evidence: `You historically flare around days ${peakDays.slice(0, 3).join(", ")} of your cycle`,
          category: "cycle",
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. TEMPORAL PATTERNS
    // ═══════════════════════════════════════════════════════════════════════════
    const today = new Date();
    const dayOfWeek = today.getDay();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    // Day of week pattern
    const dayFlares: Record<number, number> = {};
    flares.forEach((e: any) => {
      const d = new Date(e.timestamp).getDay();
      dayFlares[d] = (dayFlares[d] || 0) + 1;
    });

    const totalFlares = flares.length;
    const todayFlares = dayFlares[dayOfWeek] || 0;
    const expectedAvg = totalFlares / 7;

    if (todayFlares > expectedAvg * 1.5 && todayFlares >= 3) {
      factors.push({
        factor: `${dayNames[dayOfWeek]}s are a risk day for you`,
        impact: 0.25,
        confidence: 0.65,
        evidence: `${Math.round((todayFlares / expectedAvg) * 100 - 100)}% more flares on ${dayNames[dayOfWeek]}s`,
        category: "pattern",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. RECENT TREND ANALYSIS
    // ═══════════════════════════════════════════════════════════════════════════
    const recentFlares = flares.filter((e: any) => now - new Date(e.timestamp).getTime() < oneWeek);
    const previousWeekFlares = flares.filter((e: any) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= now - 2 * oneWeek && ts < now - oneWeek;
    });

    if (recentFlares.length > previousWeekFlares.length + 2) {
      factors.push({
        factor: "Increasing flare trend",
        impact: 0.3,
        confidence: 0.7,
        evidence: `${recentFlares.length} flares this week vs ${previousWeekFlares.length} last week`,
        category: "pattern",
      });
    } else if (recentFlares.length === 0 && previousWeekFlares.length >= 2) {
      factors.push({
        factor: "You're on a good streak",
        impact: -0.25,
        confidence: 0.65,
        evidence: "No flares in the past week",
        category: "pattern",
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. LEARNED CORRELATIONS
    // ═══════════════════════════════════════════════════════════════════════════
    correlations.slice(0, 5).forEach((c: any) => {
      if (c.confidence >= 0.6) {
        // Check if any recent entries match this trigger
        const recentEntries = entries.filter((e: any) => 
          now - new Date(e.timestamp).getTime() < 2 * oneDay
        );

        const triggerMatched = recentEntries.some((e: any) => {
          const triggers = e.triggers || [];
          const note = e.note?.toLowerCase() || "";
          return triggers.some((t: string) => 
            t.toLowerCase().includes(c.trigger_value.toLowerCase())
          ) || note.includes(c.trigger_value.toLowerCase());
        });

        if (triggerMatched) {
          factors.push({
            factor: `Recent exposure: ${c.trigger_value}`,
            impact: 0.35 * c.confidence,
            confidence: c.confidence,
            evidence: `${c.trigger_value} → ${c.outcome_value} (${Math.round(c.confidence * 100)}% correlation)`,
            category: "trigger",
          });
        }
      }
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CALCULATE FINAL RISK SCORE
    // ═══════════════════════════════════════════════════════════════════════════
    let baseRisk = 30; // Base risk level
    
    factors.forEach((f) => {
      baseRisk += f.impact * 50 * f.confidence;
    });

    // Clamp to 0-100
    const riskScore = Math.max(0, Math.min(100, Math.round(baseRisk)));

    // Determine risk level
    let riskLevel: Forecast["riskLevel"] = "low";
    if (riskScore >= 75) riskLevel = "very_high";
    else if (riskScore >= 55) riskLevel = "high";
    else if (riskScore >= 35) riskLevel = "moderate";

    // Calculate overall confidence
    const avgConfidence = factors.length > 0
      ? factors.reduce((acc, f) => acc + f.confidence, 0) / factors.length
      : 0.3;

    // Generate predictions and recommendations
    const riskFactors = factors.filter((f) => f.impact > 0).sort((a, b) => b.impact - a.impact);
    const protectiveFactors = factors.filter((f) => f.impact < 0).map((f) => f.evidence);

    let prediction = "";
    if (riskScore < 25) {
      prediction = "Looking good! Low flare risk predicted for the next 24 hours. Your patterns suggest a stable day ahead.";
    } else if (riskScore < 45) {
      prediction = "Moderate flare risk. A few factors to watch, but nothing alarming. Take it easy if you can.";
    } else if (riskScore < 65) {
      prediction = `Elevated flare risk (${riskScore}%). ${riskFactors[0]?.factor || "Multiple factors"} is the main concern. Consider preventive measures.`;
    } else {
      prediction = `High flare risk (${riskScore}%). ${riskFactors.slice(0, 2).map((f) => f.factor).join(" and ")} are combining. Take precautions.`;
    }

    // Generate recommendations based on top risk factors
    const recommendations: string[] = [];
    
    if (riskFactors.some((f) => f.category === "sleep")) {
      recommendations.push("Prioritize rest and an early bedtime tonight");
    }
    if (riskFactors.some((f) => f.category === "activity")) {
      recommendations.push("Take it easy today - avoid overexertion");
    }
    if (riskFactors.some((f) => f.category === "stress")) {
      recommendations.push("Try stress-reduction: deep breathing, short walk, or meditation");
    }
    if (riskFactors.some((f) => f.category === "weather")) {
      recommendations.push("Stay hydrated and limit outdoor exposure if possible");
    }
    if (riskFactors.some((f) => f.category === "cycle")) {
      recommendations.push("Consider pre-medicating if this is part of your cycle pattern");
    }
    if (riskFactors.some((f) => f.category === "trigger")) {
      recommendations.push("Avoid known triggers today if possible");
    }

    if (recommendations.length === 0) {
      recommendations.push("Keep doing what you're doing - patterns look stable");
    }

    const forecast: Forecast = {
      riskScore,
      riskLevel,
      confidence: avgConfidence,
      factors,
      prediction,
      recommendations,
      protectiveFactors,
      timeframe: "next 24 hours",
    };

    return new Response(JSON.stringify({ forecast }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Health forecast error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Forecast failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
