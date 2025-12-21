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
    const { message, userSymptoms, userConditions, history, userId } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!apiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('💬 Chat message:', message);

    // Fetch user's data for context
    let userContext = '';
    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Get recent flare entries
      const { data: entries } = await supabase
        .from('flare_entries')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      // Get medication logs
      const { data: medLogs } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(50);

      // Get correlations
      const { data: correlations } = await supabase
        .from('correlations')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false })
        .limit(20);

      if (entries && entries.length > 0) {
        const flareCount = entries.filter(e => e.entry_type === 'flare').length;
        const severeCount = entries.filter(e => e.severity === 'severe').length;
        const moderateCount = entries.filter(e => e.severity === 'moderate').length;
        const mildCount = entries.filter(e => e.severity === 'mild').length;
        
        // Get symptom frequency
        const symptomCounts: Record<string, number> = {};
        entries.forEach(e => {
          (e.symptoms || []).forEach((s: string) => {
            symptomCounts[s] = (symptomCounts[s] || 0) + 1;
          });
        });
        const topSymptoms = Object.entries(symptomCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Get trigger frequency
        const triggerCounts: Record<string, number> = {};
        entries.forEach(e => {
          (e.triggers || []).forEach((t: string) => {
            triggerCounts[t] = (triggerCounts[t] || 0) + 1;
          });
        });
        const topTriggers = Object.entries(triggerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        // Calculate time patterns
        const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        entries.forEach(e => {
          const hour = new Date(e.timestamp).getHours();
          if (hour >= 5 && hour < 12) hourCounts.morning++;
          else if (hour >= 12 && hour < 17) hourCounts.afternoon++;
          else if (hour >= 17 && hour < 21) hourCounts.evening++;
          else hourCounts.night++;
        });

        // Weather patterns
        const weatherCounts: Record<string, number> = {};
        entries.forEach(e => {
          const weather = e.environmental_data?.weather?.condition;
          if (weather) weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
        });

        userContext += `
USER'S HEALTH DATA (last 50 entries):
- Total flares: ${flareCount} (${severeCount} severe, ${moderateCount} moderate, ${mildCount} mild)
- Top symptoms: ${topSymptoms.map(([s, c]) => `${s}(${c})`).join(', ')}
- Top triggers: ${topTriggers.map(([t, c]) => `${t}(${c})`).join(', ')}
- Time patterns: Morning ${hourCounts.morning}, Afternoon ${hourCounts.afternoon}, Evening ${hourCounts.evening}, Night ${hourCounts.night}
- Weather patterns: ${Object.entries(weatherCounts).slice(0, 3).map(([w, c]) => `${w}(${c})`).join(', ')}
- Recent entries: ${entries.slice(0, 5).map(e => `${e.severity || 'note'} on ${new Date(e.timestamp).toLocaleDateString()}`).join(', ')}
`;
      }

      if (medLogs && medLogs.length > 0) {
        const medCounts: Record<string, { count: number; lastTaken: string }> = {};
        medLogs.forEach(m => {
          if (!medCounts[m.medication_name]) {
            medCounts[m.medication_name] = { count: 0, lastTaken: m.taken_at };
          }
          medCounts[m.medication_name].count++;
        });

        userContext += `
MEDICATION LOGS (last 50):
${Object.entries(medCounts).map(([name, data]) => `- ${name}: taken ${data.count}x, last on ${new Date(data.lastTaken).toLocaleDateString()}`).join('\n')}
`;
      }

      if (correlations && correlations.length > 0) {
        userContext += `
DISCOVERED PATTERNS:
${correlations.slice(0, 5).map(c => `- ${c.trigger_type}:${c.trigger_value} → ${c.outcome_type}:${c.outcome_value} (${c.confidence}% confidence, ${c.occurrence_count}x)`).join('\n')}
`;
      }
    }

    const systemPrompt = `You are Jvala, a warm and intelligent health companion. You're like a caring friend who truly understands chronic conditions AND has access to the user's complete health data.

PERSONALITY:
- Warm, empathetic, genuinely caring, and DATA-DRIVEN
- Speak naturally, like a supportive friend with health expertise
- Keep responses SHORT unless showing data/charts - 1-3 sentences for simple chats
- Use occasional emojis sparingly (💜, ✨, 🌟)
- ALWAYS reference their actual data when relevant
- Be specific with numbers and dates from their data

USER'S CONDITIONS: ${userConditions?.join(', ') || 'Not specified'}
KNOWN SYMPTOMS: ${userSymptoms?.join(', ') || 'Not specified'}

${userContext}

YOUR JOB:
1. When users describe symptoms → Log it and respond with empathy + relevant patterns from their data
2. When users ask questions → Answer using their ACTUAL data with specific numbers
3. When users ask about medications → Show their medication history with dates and patterns
4. When users ask about patterns/trends → Analyze their data and provide specific insights
5. When users share feelings → Validate them and offer data-backed perspective

VISUALIZATION CAPABILITIES:
You can generate rich visual data displays. When showing data, include a "visualization" object with one of these types:

1. severity_breakdown - Pie/donut chart of severity distribution
2. symptom_frequency - Bar chart of symptom counts
3. trigger_frequency - Bar chart of trigger counts  
4. timeline - Line chart showing flares over time
5. time_of_day - Distribution of flares by time period
6. weather_correlation - Bar chart of weather conditions during flares
7. medication_log - Table/timeline of medication history
8. medication_adherence - Calendar view of med-taking patterns
9. weekly_trend - Week-over-week comparison chart
10. monthly_comparison - Month-over-month comparison
11. sleep_correlation - Sleep hours vs flare severity scatter
12. activity_correlation - Steps/activity vs flares
13. hrv_trend - HRV values over time with flare markers
14. trigger_severity_matrix - Heatmap of triggers vs severity
15. symptom_cooccurrence - Which symptoms appear together
16. pattern_summary - Summary card of discovered patterns
17. health_score - Overall health score gauge
18. streak_calendar - Logging streak visualization
19. environmental_factors - Combined weather/AQI/pollen chart
20. physiological_overview - Dashboard of wearable metrics
21. medication_effectiveness - Comparison of symptoms before/after meds
22. flare_duration - Distribution of flare durations
23. recovery_time - Time between flares analysis
24. daily_rhythm - Hour-by-hour activity pattern
25. comparative_analysis - Compare two time periods

RESPONSE FORMAT (always valid JSON):
{
  "response": "Your warm, data-informed response",
  "shouldLog": true/false,
  "entryData": {
    "type": "flare|medication|trigger|recovery|energy|note",
    "severity": "mild|moderate|severe",
    "symptoms": ["symptom1"],
    "medications": ["med1"],
    "triggers": ["trigger1"]
  },
  "visualization": {
    "type": "one_of_the_25_types_above",
    "title": "Chart title",
    "data": [...array of data points...],
    "insight": "Key insight from this visualization"
  }
}

IMPORTANT EXAMPLES:

User: "When did I last take my ibuprofen?"
→ {
  "response": "You last took Ibuprofen on December 18th at 2:30 PM. You've taken it 8 times in the past month. 💊",
  "shouldLog": false,
  "visualization": {
    "type": "medication_log",
    "title": "Your Ibuprofen History",
    "data": [{"date": "Dec 18", "time": "2:30 PM"}, {"date": "Dec 15", "time": "9:00 AM"}],
    "insight": "You typically take this medication every 3-4 days"
  }
}

User: "What triggers my worst flares?"
→ {
  "response": "Based on your data, stress and poor sleep are your biggest triggers for severe flares. Stress appears in 67% of your severe episodes! 📊",
  "shouldLog": false,
  "visualization": {
    "type": "trigger_severity_matrix",
    "title": "Triggers by Severity",
    "data": [{"trigger": "Stress", "severe": 4, "moderate": 2, "mild": 1}, {"trigger": "Poor Sleep", "severe": 3, "moderate": 3, "mild": 2}],
    "insight": "Stress is 3x more likely to cause severe flares than mild ones"
  }
}

User: "Show me my medication patterns"
→ {
  "response": "Here's your medication overview! You've been most consistent with your morning doses. 💜",
  "shouldLog": false,
  "visualization": {
    "type": "medication_adherence",
    "title": "Medication Adherence - Last 30 Days",
    "data": [{"week": "Week 1", "adherence": 85}, {"week": "Week 2", "adherence": 71}],
    "insight": "Your adherence is highest on weekdays (82%) vs weekends (65%)"
  }
}

User: "How am I doing this week vs last week?"
→ {
  "response": "Good news! You're doing better this week - 2 flares compared to 5 last week, and they've been less severe. Keep it up! 🌟",
  "shouldLog": false,
  "visualization": {
    "type": "weekly_trend",
    "title": "This Week vs Last Week",
    "data": [{"metric": "Flares", "thisWeek": 2, "lastWeek": 5}, {"metric": "Severe", "thisWeek": 0, "lastWeek": 2}],
    "insight": "60% reduction in flare frequency"
  }
}

User: "feeling really tired today"
→ {
  "response": "I'm sorry you're feeling exhausted 💜 I noticed you've logged fatigue 4 times this week - more than usual. Want me to track this?",
  "shouldLog": true,
  "entryData": {"type": "note", "symptoms": ["fatigue"]},
  "visualization": {
    "type": "symptom_frequency",
    "title": "Fatigue Pattern This Week",
    "data": [{"day": "Mon", "count": 1}, {"day": "Tue", "count": 0}, {"day": "Wed", "count": 2}, {"day": "Thu", "count": 1}],
    "insight": "Fatigue has increased 50% compared to last week"
  }
}

SEVERITY GUIDE:
- mild: Minor discomfort, can continue activities
- moderate: Noticeable impact, may need to slow down  
- severe: Significant impairment, needs rest

CRITICAL RULES:
1. ALWAYS use the user's actual data when they ask questions
2. Include specific numbers, dates, and percentages
3. Generate appropriate visualizations for data-related questions
4. If no relevant data exists, say so honestly
5. Keep text responses SHORT but pack visualizations with insight`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded. Please try again in a moment.' 
        }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (response.status === 402) {
        return new Response(JSON.stringify({ 
          error: 'AI credits exhausted. Please try again later.' 
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 AI response received');
    
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed response:', parsed);
          
          return new Response(JSON.stringify({
            response: parsed.response || "Got it!",
            shouldLog: parsed.shouldLog || false,
            entryData: parsed.entryData || null,
            visualization: parsed.visualization || null
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (parseError) {
        console.log('Could not parse as JSON, returning raw response');
      }
      
      return new Response(JSON.stringify({
        response: content,
        shouldLog: false,
        entryData: null,
        visualization: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      response: "Hmm, I didn't quite catch that. Could you try again?",
      shouldLog: false,
      entryData: null,
      visualization: null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
