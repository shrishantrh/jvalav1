import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  activity_value?: string;
  intensity?: string;
  timestamp: string;
}

interface FlareEntry {
  id: string;
  user_id: string;
  type: string;
  severity?: string;
  symptoms?: string[];
  triggers?: string[];
  timestamp: string;
}

interface Correlation {
  trigger_type: string;
  trigger_value: string;
  outcome_type: string;
  outcome_value: string;
  avg_delay_minutes: number;
  occurrence_count: number;
  confidence: number;
}

// Activity detection patterns
const ACTIVITY_PATTERNS = [
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:just\s+)?(?:finished|completed|did)\s+(?:a\s+)?(run|jog|jogging)/i, type: 'run', intensity: 'moderate' },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:a\s+)?(?:my\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' },
  { pattern: /(?:went|going|gone)\s+(?:for\s+)?(?:a\s+)?(walk|walking)/i, type: 'walk', intensity: 'low' },
  { pattern: /(?:back|returned|finished)\s+(?:from\s+)?(?:the\s+)?(gym|workout|exercise)/i, type: 'gym', intensity: 'high' },
  { pattern: /(?:went|going|gone)\s+(?:to\s+)?(?:the\s+)?(gym)/i, type: 'gym', intensity: 'high' },
  { pattern: /(?:woke\s+up|just\s+woke|got\s+up)/i, type: 'sleep', intensity: 'low' },
  { pattern: /(?:ate|eating|had)\s+(.+?)(?:\s+for\s+)?(?:breakfast|lunch|dinner|meal)?/i, type: 'eat', intensity: 'low' },
  { pattern: /(?:finished|back\s+from|done\s+with)\s+work/i, type: 'work', intensity: 'moderate' },
  { pattern: /(?:stressed|stress|anxious|anxiety)/i, type: 'stress', intensity: 'high' },
  { pattern: /(?:yoga|meditation|meditate)/i, type: 'relaxation', intensity: 'low' },
  { pattern: /(?:swimming|swam|swim)/i, type: 'swim', intensity: 'moderate' },
  { pattern: /(?:cycling|cycled|biking|biked)/i, type: 'cycling', intensity: 'moderate' },
  { pattern: /(?:hiking|hiked|hike)/i, type: 'hike', intensity: 'high' },
];

function detectActivity(message: string): { type: string; intensity: string; value?: string } | null {
  const lower = message.toLowerCase();
  
  for (const { pattern, type, intensity } of ACTIVITY_PATTERNS) {
    const match = lower.match(pattern);
    if (match) {
      return { type, intensity, value: match[1] || undefined };
    }
  }
  
  return null;
}

function calculateConfidence(occurrenceCount: number, daysSinceLastOccurrence: number): number {
  const countScore = Math.min(Math.log2(occurrenceCount + 1) / 5, 0.7);
  const recencyScore = Math.max(0, 0.3 - (daysSinceLastOccurrence / 30) * 0.3);
  return Math.min(countScore + recencyScore, 1.0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action, userId, data } = await req.json();

    console.log(`🔄 Correlation Engine: ${action} for user ${userId}`);

    switch (action) {
      case 'detect_activity': {
        const { message } = data;
        const activity = detectActivity(message);
        
        if (activity) {
          console.log(`🏃 Detected activity: ${activity.type} (${activity.intensity})`);
          
          // Log the activity
          const { data: activityLog, error: logError } = await supabase
            .from('activity_logs')
            .insert({
              user_id: userId,
              activity_type: activity.type,
              activity_value: activity.value,
              intensity: activity.intensity,
              timestamp: new Date().toISOString(),
              followed_up: false,
            })
            .select()
            .single();

          if (logError) {
            console.error('Error logging activity:', logError);
            throw logError;
          }

          return new Response(JSON.stringify({
            detected: true,
            activity: activity,
            activityLog: activityLog,
            followUpIn: activity.type === 'run' || activity.type === 'gym' ? 30 : 60, // minutes
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        return new Response(JSON.stringify({ detected: false }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'build_correlation': {
        const { trigger, outcome, delayMinutes } = data;
        
        console.log(`🔗 Building correlation: ${trigger.type}:${trigger.value} → ${outcome.type}:${outcome.value}`);

        // Check for existing correlation
        const { data: existing } = await supabase
          .from('correlations')
          .select('*')
          .eq('user_id', userId)
          .eq('trigger_type', trigger.type)
          .eq('trigger_value', trigger.value)
          .eq('outcome_type', outcome.type)
          .eq('outcome_value', outcome.value)
          .maybeSingle();

        if (existing) {
          const newCount = existing.occurrence_count + 1;
          const newAvgDelay = Math.round((existing.avg_delay_minutes * (newCount - 1) + delayMinutes) / newCount);
          const newConfidence = calculateConfidence(newCount, 0);

          const { data: updated, error: updateError } = await supabase
            .from('correlations')
            .update({
              occurrence_count: newCount,
              avg_delay_minutes: newAvgDelay,
              confidence: newConfidence,
              last_occurred: new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();

          if (updateError) throw updateError;

          console.log(`📈 Updated correlation: ${newCount} occurrences, ${(newConfidence * 100).toFixed(0)}% confidence`);

          return new Response(JSON.stringify({
            correlation: updated,
            isNew: false,
            isHighConfidence: newConfidence >= 0.4 && newCount >= 3,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        } else {
          const newConfidence = calculateConfidence(1, 0);

          const { data: created, error: createError } = await supabase
            .from('correlations')
            .insert({
              user_id: userId,
              trigger_type: trigger.type,
              trigger_value: trigger.value,
              outcome_type: outcome.type,
              outcome_value: outcome.value,
              avg_delay_minutes: delayMinutes,
              occurrence_count: 1,
              confidence: newConfidence,
              last_occurred: new Date().toISOString(),
            })
            .select()
            .single();

          if (createError) throw createError;

          console.log(`🆕 Created new correlation`);

          return new Response(JSON.stringify({
            correlation: created,
            isNew: true,
            isHighConfidence: false,
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      }

      case 'analyze_flare': {
        const { flareEntry, lookbackHours = 24 } = data;
        
        console.log(`🔍 Analyzing flare for correlations, looking back ${lookbackHours} hours`);

        const flareTime = new Date(flareEntry.timestamp).getTime();
        const lookbackTime = new Date(flareTime - (lookbackHours * 60 * 60 * 1000)).toISOString();

        // Get activities before the flare
        const { data: activities } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', userId)
          .gte('timestamp', lookbackTime)
          .lte('timestamp', flareEntry.timestamp)
          .order('timestamp', { ascending: false });

        const correlationsBuilt: any[] = [];

        if (activities && activities.length > 0) {
          for (const activity of activities) {
            const activityTime = new Date(activity.timestamp).getTime();
            const delayMinutes = Math.round((flareTime - activityTime) / (1000 * 60));

            // Build correlation for activity → each symptom
            for (const symptom of (flareEntry.symptoms || [])) {
              const { data: corr } = await supabase.functions.invoke('correlation-engine', {
                body: {
                  action: 'build_correlation',
                  userId,
                  data: {
                    trigger: { type: 'activity', value: activity.activity_type },
                    outcome: { type: 'symptom', value: symptom },
                    delayMinutes,
                  }
                }
              });
              if (corr?.correlation) correlationsBuilt.push(corr);
            }

            // Build correlation for activity → severity
            if (flareEntry.severity) {
              const { data: corr } = await supabase.functions.invoke('correlation-engine', {
                body: {
                  action: 'build_correlation',
                  userId,
                  data: {
                    trigger: { type: 'activity', value: activity.activity_type },
                    outcome: { type: 'severity', value: flareEntry.severity },
                    delayMinutes,
                  }
                }
              });
              if (corr?.correlation) correlationsBuilt.push(corr);
            }

            // Mark activity as followed up
            await supabase
              .from('activity_logs')
              .update({
                followed_up: true,
                follow_up_result: {
                  flare_id: flareEntry.id,
                  symptoms: flareEntry.symptoms,
                  severity: flareEntry.severity,
                  delay_minutes: delayMinutes,
                }
              })
              .eq('id', activity.id);
          }
        }

        // Build correlations for explicit triggers
        for (const trigger of (flareEntry.triggers || [])) {
          for (const symptom of (flareEntry.symptoms || [])) {
            const { data: corr } = await supabase.functions.invoke('correlation-engine', {
              body: {
                action: 'build_correlation',
                userId,
                data: {
                  trigger: { type: 'food', value: trigger },
                  outcome: { type: 'symptom', value: symptom },
                  delayMinutes: 0,
                }
              }
            });
            if (corr?.correlation) correlationsBuilt.push(corr);
          }
        }

        console.log(`✅ Built ${correlationsBuilt.length} correlations from flare analysis`);

        return new Response(JSON.stringify({
          activitiesAnalyzed: activities?.length || 0,
          correlationsBuilt: correlationsBuilt.length,
          highConfidenceFound: correlationsBuilt.filter(c => c.isHighConfidence).length,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_pending_followups': {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

        const { data: pendingActivities } = await supabase
          .from('activity_logs')
          .select('*')
          .eq('user_id', userId)
          .eq('followed_up', false)
          .gte('timestamp', fourHoursAgo)
          .lte('timestamp', twoHoursAgo)
          .order('timestamp', { ascending: false });

        return new Response(JSON.stringify({
          pendingFollowUps: pendingActivities || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_high_confidence': {
        const { minConfidence = 0.4, minCount = 3 } = data || {};

        const { data: highConfidence } = await supabase
          .from('correlations')
          .select('*')
          .eq('user_id', userId)
          .gte('confidence', minConfidence)
          .gte('occurrence_count', minCount)
          .order('confidence', { ascending: false })
          .limit(20);

        return new Response(JSON.stringify({
          correlations: highConfidence || [],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      case 'get_correlations_for_activity': {
        const { activityType } = data;

        const { data: correlations } = await supabase
          .from('correlations')
          .select('*')
          .eq('user_id', userId)
          .eq('trigger_type', 'activity')
          .eq('trigger_value', activityType)
          .order('confidence', { ascending: false });

        // Check if this activity has high-confidence correlations
        const highConfidence = (correlations || []).filter(c => c.confidence >= 0.4 && c.occurrence_count >= 3);
        
        let warning = null;
        if (highConfidence.length > 0) {
          const topCorrelation = highConfidence[0];
          warning = `${activityType} has been followed by ${topCorrelation.outcome_value} ${topCorrelation.occurrence_count} times (avg ${topCorrelation.avg_delay_minutes} min delay)`;
        }

        return new Response(JSON.stringify({
          correlations: correlations || [],
          warning,
          hasHighConfidence: highConfidence.length > 0,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('❌ Correlation Engine Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
