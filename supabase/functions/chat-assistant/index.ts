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

    // Build comprehensive user context
    let userContext = '';
    let hasWearableData = false;
    let latestPhysiologicalData: any = null;
    
    if (userId) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // Get user profile for more context
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Get recent flare entries with ALL data including physiological
      const { data: entries } = await supabase
        .from('flare_entries')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);

      // Get medication logs
      const { data: medLogs } = await supabase
        .from('medication_logs')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(100);

      // Get correlations/patterns
      const { data: correlations } = await supabase
        .from('correlations')
        .select('*')
        .eq('user_id', userId)
        .order('confidence', { ascending: false })
        .limit(30);

      // Get engagement data for streaks
      const { data: engagement } = await supabase
        .from('engagement')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get activity logs
      const { data: activityLogs } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(50);

      // Process profile
      if (profile) {
        userContext += `
USER PROFILE:
- Name: ${profile.full_name || 'Not set'}
- Conditions: ${(profile.conditions || []).join(', ') || 'None specified'}
- Known symptoms: ${(profile.known_symptoms || []).join(', ') || 'None specified'}
- Known triggers: ${(profile.known_triggers || []).join(', ') || 'None specified'}
- Age: ${profile.date_of_birth ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 'Not set'}
- Height: ${profile.height_cm ? profile.height_cm + ' cm' : 'Not set'}
- Weight: ${profile.weight_kg ? profile.weight_kg + ' kg' : 'Not set'}
`;
      }

      // Process entries comprehensively
      if (entries && entries.length > 0) {
        const flares = entries.filter(e => e.entry_type === 'flare');
        const flareCount = flares.length;
        const severeCount = flares.filter(e => e.severity === 'severe').length;
        const moderateCount = flares.filter(e => e.severity === 'moderate').length;
        const mildCount = flares.filter(e => e.severity === 'mild').length;
        
        // Calculate averages
        const avgSeverity = flares.reduce((sum, e) => {
          const val = e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1;
          return sum + val;
        }, 0) / (flares.length || 1);
        
        // Get symptom frequency
        const symptomCounts: Record<string, number> = {};
        entries.forEach(e => {
          (e.symptoms || []).forEach((s: string) => {
            symptomCounts[s] = (symptomCounts[s] || 0) + 1;
          });
        });
        const topSymptoms = Object.entries(symptomCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        // Get trigger frequency
        const triggerCounts: Record<string, number> = {};
        entries.forEach(e => {
          (e.triggers || []).forEach((t: string) => {
            triggerCounts[t] = (triggerCounts[t] || 0) + 1;
          });
        });
        const topTriggers = Object.entries(triggerCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        // Calculate time patterns
        const hourCounts: Record<string, number> = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        const dayCounts: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        flares.forEach(e => {
          const date = new Date(e.timestamp);
          const hour = date.getHours();
          if (hour >= 5 && hour < 12) hourCounts.morning++;
          else if (hour >= 12 && hour < 17) hourCounts.afternoon++;
          else if (hour >= 17 && hour < 21) hourCounts.evening++;
          else hourCounts.night++;
          dayCounts[days[date.getDay()]]++;
        });

        // Weather patterns
        const weatherCounts: Record<string, number> = {};
        entries.forEach(e => {
          const weather = e.environmental_data?.weather?.condition || e.environmental_data?.condition;
          if (weather) weatherCounts[weather] = (weatherCounts[weather] || 0) + 1;
        });

        // PHYSIOLOGICAL DATA - Extract wearable metrics
        const physiologicalEntries = entries.filter(e => e.physiological_data);
        if (physiologicalEntries.length > 0) {
          hasWearableData = true;
          latestPhysiologicalData = physiologicalEntries[0].physiological_data;
          
          // Aggregate physiological data during flares
          const hrValues: number[] = [];
          const hrvValues: number[] = [];
          const sleepValues: number[] = [];
          const stepsValues: number[] = [];
          const spo2Values: number[] = [];
          const stressValues: number[] = [];
          const tempValues: number[] = [];
          
          physiologicalEntries.forEach(e => {
            const p = e.physiological_data;
            if (p?.heartRate?.current) hrValues.push(p.heartRate.current);
            if (p?.heartRate?.resting) hrValues.push(p.heartRate.resting);
            if (p?.hrv?.current) hrvValues.push(p.hrv.current);
            if (p?.hrv?.daily) hrvValues.push(p.hrv.daily);
            if (p?.sleep?.duration) sleepValues.push(p.sleep.duration);
            if (p?.sleep?.efficiency) sleepValues.push(p.sleep.efficiency);
            if (p?.activity?.steps) stepsValues.push(p.activity.steps);
            if (p?.bloodOxygen?.current) spo2Values.push(p.bloodOxygen.current);
            if (p?.stress?.level) stressValues.push(p.stress.level);
            if (p?.temperature?.skin) tempValues.push(p.temperature.skin);
          });

          const avg = (arr: number[]) => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';
          const min = (arr: number[]) => arr.length ? Math.min(...arr) : 'N/A';
          const max = (arr: number[]) => arr.length ? Math.max(...arr) : 'N/A';

          userContext += `
WEARABLE/BODY METRICS (from ${physiologicalEntries.length} entries with data):
- Heart Rate: avg ${avg(hrValues)} bpm, range ${min(hrValues)}-${max(hrValues)} bpm
- HRV (Heart Rate Variability): avg ${avg(hrvValues)} ms, range ${min(hrvValues)}-${max(hrvValues)} ms
- Sleep Duration: avg ${avg(sleepValues)} hours
- Daily Steps: avg ${avg(stepsValues)}
- SpO2 (Blood Oxygen): avg ${avg(spo2Values)}%
- Stress Level: avg ${avg(stressValues)} (scale varies by device)
- Skin Temperature: avg ${avg(tempValues)}°

LATEST BODY METRICS (most recent entry with wearable data):
${JSON.stringify(latestPhysiologicalData, null, 2)}
`;

          // Correlate flare severity with body metrics
          const severeFlaresWithData = physiologicalEntries.filter(e => e.severity === 'severe');
          const mildFlaresWithData = physiologicalEntries.filter(e => e.severity === 'mild');
          
          if (severeFlaresWithData.length > 0 && mildFlaresWithData.length > 0) {
            const avgHrSevere = severeFlaresWithData.reduce((sum, e) => sum + (e.physiological_data?.heartRate?.current || 0), 0) / severeFlaresWithData.length;
            const avgHrMild = mildFlaresWithData.reduce((sum, e) => sum + (e.physiological_data?.heartRate?.current || 0), 0) / mildFlaresWithData.length;
            
            if (avgHrSevere && avgHrMild) {
              userContext += `
BODY METRICS DURING FLARES:
- Avg HR during severe flares: ${avgHrSevere.toFixed(0)} bpm
- Avg HR during mild flares: ${avgHrMild.toFixed(0)} bpm
`;
            }
          }
        }

        // Last flare info
        const lastFlare = flares[0];
        const daysSinceLastFlare = lastFlare 
          ? Math.floor((Date.now() - new Date(lastFlare.timestamp).getTime()) / (1000 * 60 * 60 * 24))
          : null;

        userContext += `
FLARE SUMMARY (last ${entries.length} entries):
- Total flares: ${flareCount}
- Severity breakdown: ${severeCount} severe, ${moderateCount} moderate, ${mildCount} mild
- Average severity: ${avgSeverity.toFixed(1)}/3.0
- Last flare: ${daysSinceLastFlare !== null ? `${daysSinceLastFlare} days ago` : 'No flares recorded'}
- Top symptoms: ${topSymptoms.map(([s, c]) => `${s} (${c}x)`).join(', ') || 'None logged'}
- Top triggers: ${topTriggers.map(([t, c]) => `${t} (${c}x)`).join(', ') || 'None logged'}
- Time patterns: Morning ${hourCounts.morning}, Afternoon ${hourCounts.afternoon}, Evening ${hourCounts.evening}, Night ${hourCounts.night}
- Day patterns: ${Object.entries(dayCounts).sort((a, b) => b[1] - a[1]).map(([d, c]) => `${d}(${c})`).join(', ')}
- Weather: ${Object.entries(weatherCounts).slice(0, 5).map(([w, c]) => `${w}(${c})`).join(', ') || 'Not tracked'}

RECENT ENTRIES (last 10):
${entries.slice(0, 10).map(e => {
  const date = new Date(e.timestamp).toLocaleDateString();
  const time = new Date(e.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const hasPhysio = e.physiological_data ? '📊' : '';
  const hasEnv = e.environmental_data ? '🌤️' : '';
  return `- ${date} ${time}: ${e.entry_type} ${e.severity || ''} ${hasPhysio}${hasEnv} ${(e.symptoms || []).slice(0, 3).join(', ')}`;
}).join('\n')}
`;
      }

      // Medication data
      if (medLogs && medLogs.length > 0) {
        const medCounts: Record<string, { count: number; lastTaken: string; dosage?: string }> = {};
        medLogs.forEach(m => {
          if (!medCounts[m.medication_name]) {
            medCounts[m.medication_name] = { count: 0, lastTaken: m.taken_at, dosage: m.dosage };
          }
          medCounts[m.medication_name].count++;
        });

        userContext += `
MEDICATIONS (${medLogs.length} total logs):
${Object.entries(medCounts).map(([name, data]) => `- ${name}: taken ${data.count}x, last on ${new Date(data.lastTaken).toLocaleDateString()} at ${new Date(data.lastTaken).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}, dosage: ${data.dosage || 'standard'}`).join('\n')}
`;
      }

      // Correlations
      if (correlations && correlations.length > 0) {
        userContext += `
DISCOVERED PATTERNS (AI-detected correlations):
${correlations.slice(0, 10).map(c => `- ${c.trigger_type}:${c.trigger_value} → ${c.outcome_type}:${c.outcome_value} (${(c.confidence * 100).toFixed(0)}% confidence, ${c.occurrence_count}x observed)`).join('\n')}
`;
      }

      // Engagement/streaks
      if (engagement) {
        userContext += `
LOGGING HABITS:
- Current streak: ${engagement.current_streak || 0} days
- Longest streak: ${engagement.longest_streak || 0} days  
- Total logs: ${engagement.total_logs || 0}
- Badges earned: ${(engagement.badges || []).join(', ') || 'None yet'}
`;
      }

      // Activity logs
      if (activityLogs && activityLogs.length > 0) {
        const activityTypes: Record<string, number> = {};
        activityLogs.forEach(a => {
          activityTypes[a.activity_type] = (activityTypes[a.activity_type] || 0) + 1;
        });

        userContext += `
ACTIVITY LOGS (last ${activityLogs.length}):
- Types: ${Object.entries(activityTypes).map(([t, c]) => `${t}(${c})`).join(', ')}
- Recent: ${activityLogs.slice(0, 5).map(a => `${a.activity_type} on ${new Date(a.timestamp).toLocaleDateString()}`).join(', ')}
`;
      }
    }

    // Check if no wearable data was found
    if (!hasWearableData) {
      userContext += `
NOTE: This user does NOT have wearable device data connected. If they ask about body metrics, heart rate, HRV, sleep quality, etc., tell them they need to connect a wearable device (like Fitbit, Oura, or Apple Watch) in Settings to track these metrics.
`;
    }

    const systemPrompt = `You are Jvala, a smart, warm health companion with FULL ACCESS to the user's health data. You're like a knowledgeable friend who truly understands their chronic condition.

CRITICAL INSTRUCTIONS:
1. BE CONVERSATIONAL - respond naturally to greetings, small talk, and casual messages
2. BE DATA-DRIVEN - when they ask about their health, USE THEIR ACTUAL DATA with specific numbers
3. BE CONCISE - 1-3 sentences for simple messages, longer only for data-heavy responses
4. NEVER say "I can't" or "I don't have access" - you have ALL their data below!
5. If they ask about body metrics/wearables and they don't have data, tell them to connect a device in Settings

CONVERSATION STYLE:
- For "hi", "hello", "hey" → Respond warmly and naturally, maybe ask how they're doing
- For questions about data → Give specific numbers, dates, percentages from their data
- For symptom reports → Acknowledge empathetically, offer to log, show relevant patterns
- For casual chat → Be friendly and supportive, you're their health buddy

${userContext}

VISUALIZATION CAPABILITIES (use when showing data):
Types: severity_breakdown, symptom_frequency, trigger_frequency, timeline, time_of_day, weather_correlation, medication_log, medication_adherence, weekly_trend, monthly_comparison, hrv_trend, trigger_severity_matrix, symptom_cooccurrence, pattern_summary, health_score, physiological_overview, environmental_factors, flare_duration, recovery_time, daily_rhythm, comparative_analysis, body_metrics_timeline, wearable_summary

RESPONSE FORMAT (always valid JSON):
{
  "response": "Your natural, friendly response with specific data when relevant",
  "shouldLog": true/false,
  "entryData": {
    "type": "flare|medication|trigger|recovery|energy|note",
    "severity": "mild|moderate|severe",
    "symptoms": ["symptom1"],
    "medications": ["med1"],
    "triggers": ["trigger1"]
  },
  "visualization": {
    "type": "one_of_the_types",
    "title": "Chart title",
    "data": [...],
    "insight": "Key insight"
  }
}

EXAMPLES:

User: "hi"
→ {"response": "Hey! 👋 How are you feeling today?", "shouldLog": false}

User: "what are my body metrics during flares"
→ If they have wearable data: {"response": "During your flares, your heart rate averages 82 bpm (vs 68 resting), and your HRV drops to around 35ms. Your severe flares show elevated HR of 95 bpm on average.", "shouldLog": false, "visualization": {"type": "body_metrics_timeline", "title": "Body Metrics During Flares", "data": [...], "insight": "HR increases ~20% during flares"}}
→ If NO wearable data: {"response": "I don't have body metrics for you yet! Connect a wearable device like Fitbit or Oura in Settings → Wearables to track heart rate, HRV, sleep, and more during flares.", "shouldLog": false}

User: "what patterns do you see"
→ {"response": "I see some interesting patterns! You flare most on Fridays (12x) and mornings (8x). Stress and poor sleep are your biggest triggers. Your HRV tends to drop the day before a flare.", "shouldLog": false, "visualization": {"type": "pattern_summary", ...}}

User: "feeling dizzy"
→ {"response": "Sorry you're feeling dizzy 💜 That's your most common symptom - you've logged it 5 times this month. Want me to track this? Any other symptoms?", "shouldLog": true, "entryData": {"type": "note", "symptoms": ["Dizziness"]}}`;

    const messages_to_send = [
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
        messages: messages_to_send,
        temperature: 0.7,
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
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed response:', parsed.response?.slice(0, 100));
          
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
      
      // Return raw content if not JSON
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
      response: "I'm here! What would you like to know?",
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
