import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get date range for current week
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    console.log(`Generating report for ${userId} from ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

    // Fetch entries for this week
    const { data: entries, error: entriesError } = await supabase
      .from('flare_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', weekStart.toISOString())
      .lte('timestamp', weekEnd.toISOString())
      .order('timestamp', { ascending: true });

    if (entriesError) {
      console.error('Failed to fetch entries:', entriesError);
      throw entriesError;
    }

    // Fetch correlations
    const { data: correlations } = await supabase
      .from('correlations')
      .select('*')
      .eq('user_id', userId)
      .order('confidence', { ascending: false })
      .limit(5);

    // Fetch previous week's report for comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    const { data: prevReport } = await supabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .gte('week_start', prevWeekStart.toISOString().split('T')[0])
      .lte('week_end', prevWeekEnd.toISOString().split('T')[0])
      .maybeSingle();

    // Calculate metrics
    const flareEntries = entries?.filter(e => e.entry_type === 'flare') || [];
    const flareCount = flareEntries.length;
    
    // Calculate average severity
    const severityMap: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
    const severities = flareEntries
      .map(e => severityMap[e.severity || ''] || 0)
      .filter(s => s > 0);
    const avgSeverity = severities.length > 0 
      ? severities.reduce((a, b) => a + b, 0) / severities.length 
      : 0;

    // Calculate logging consistency (days with at least one entry / 7)
    const daysWithEntries = new Set(
      (entries || []).map(e => new Date(e.timestamp).toDateString())
    ).size;
    const loggingConsistency = Math.round((daysWithEntries / 7) * 100);

    // Calculate health score (0-100)
    // Lower is better for flares, so inverse
    const flareScore = Math.max(0, 100 - (flareCount * 15)); // Each flare -15 points
    const severityScore = Math.max(0, 100 - (avgSeverity * 25)); // Higher severity = lower score
    const consistencyBonus = loggingConsistency * 0.2; // Up to 20 bonus for consistent logging
    const healthScore = Math.min(100, Math.round(
      (flareScore * 0.4) + (severityScore * 0.4) + consistencyBonus
    ));

    // Calculate trend
    let trend = 'stable';
    if (prevReport) {
      const prevScore = prevReport.health_score || 50;
      const scoreDiff = healthScore - prevScore;
      if (scoreDiff > 10) trend = 'improving';
      else if (scoreDiff < -10) trend = 'worsening';
    }

    // Get top symptoms and triggers
    const symptomCounts: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};
    
    flareEntries.forEach(entry => {
      (entry.symptoms || []).forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
      (entry.triggers || []).forEach((t: string) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });

    const topSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const topTriggers = Object.entries(triggerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Generate key insights
    const keyInsights: string[] = [];

    if (flareCount === 0) {
      keyInsights.push("Great week! No flares recorded.");
    } else if (flareCount <= 2) {
      keyInsights.push(`Manageable week with ${flareCount} flare${flareCount > 1 ? 's' : ''}.`);
    } else {
      keyInsights.push(`Challenging week with ${flareCount} flares. Consider reviewing triggers.`);
    }

    if (loggingConsistency >= 70) {
      keyInsights.push("Excellent logging consistency this week!");
    } else if (loggingConsistency < 30) {
      keyInsights.push("Try logging daily for better insights.");
    }

    if (topTriggers.length > 0) {
      keyInsights.push(`Top trigger: ${topTriggers[0].name} (${topTriggers[0].count}x)`);
    }

    if (correlations && correlations.length > 0) {
      const topCorr = correlations[0];
      keyInsights.push(`Pattern detected: ${topCorr.trigger_value} → ${topCorr.outcome_value}`);
    }

    if (trend === 'improving') {
      keyInsights.push("You're trending better than last week! Keep it up.");
    } else if (trend === 'worsening') {
      keyInsights.push("Slightly harder week than last. Be gentle with yourself.");
    }

    // Store or update the report
    const reportData = {
      user_id: userId,
      week_start: weekStart.toISOString().split('T')[0],
      week_end: weekEnd.toISOString().split('T')[0],
      health_score: healthScore,
      flare_count: flareCount,
      avg_severity: avgSeverity,
      logging_consistency: loggingConsistency,
      trend,
      top_symptoms: topSymptoms,
      top_triggers: topTriggers,
      top_correlations: (correlations || []).slice(0, 3).map(c => ({
        trigger: c.trigger_value,
        outcome: c.outcome_value,
        confidence: c.confidence,
      })),
      key_insights: keyInsights,
    };

    // Check if report exists
    const { data: existingReport } = await supabase
      .from('weekly_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start', reportData.week_start)
      .maybeSingle();

    if (existingReport) {
      await supabase
        .from('weekly_reports')
        .update(reportData)
        .eq('id', existingReport.id);
    } else {
      await supabase
        .from('weekly_reports')
        .insert(reportData);
    }

    console.log('Weekly report generated:', reportData);

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error generating weekly report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
