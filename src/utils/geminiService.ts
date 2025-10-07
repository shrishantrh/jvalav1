import { FlareEntry } from "@/types/flare";

export const analyzeNoteForEntry = async (note: string, apiKey: string): Promise<Partial<FlareEntry> | null> => {
  console.log('🤖 Analyzing note with Gemini API:', note);
  console.log('🔑 API Key available:', !!apiKey);
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this health note and suggest appropriate entry categorization. Return JSON only.

Note: "${note}"

Determine:
1. Entry type: flare, medication, trigger, recovery, energy, or note
2. If flare: severity (none, mild, moderate, severe) and possible symptoms
3. If energy: level (very-low, low, moderate, good, high)

Return JSON format:
{
  "type": "flare|medication|trigger|recovery|energy|note",
  "severity": "none|mild|moderate|severe" (only for flares),
  "energyLevel": "very-low|low|moderate|good|high" (only for energy),
  "symptoms": ["symptom1", "symptom2"] (only for flares if mentioned),
  "medications": ["med1"] (only for medication entries),
  "triggers": ["trigger1"] (only for trigger entries)
}

Examples:
- "Feeling tired today" → {"type": "energy", "energyLevel": "low"}
- "Bad flare in my joints" → {"type": "flare", "severity": "moderate", "symptoms": ["joint pain"]}
- "Took my methotrexate" → {"type": "medication", "medications": ["methotrexate"]}

Be specific but concise. Only include fields that are clearly indicated.`
          }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 300,
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Gemini API request failed:', response.status, response.statusText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 Gemini API response:', data);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📝 Extracted content:', content);
    
    if (content) {
      try {
        // Clean the response to extract JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed AI result:', parsed);
          const result = {
            type: parsed.type,
            ...(parsed.severity && { severity: parsed.severity }),
            ...(parsed.energyLevel && { energyLevel: parsed.energyLevel }),
            ...(parsed.symptoms && { symptoms: parsed.symptoms }),
            ...(parsed.medications && { medications: parsed.medications }),
            ...(parsed.triggers && { triggers: parsed.triggers }),
            timestamp: new Date(),
          };
          console.log('🎯 Returning structured entry:', result);
          return result;
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError);
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to analyze note:', error);
    return null;
  }
};

export const generateQuickSuggestions = async (entries: FlareEntry[], apiKey: string): Promise<string[]> => {
  if (!entries.length || !apiKey) return [];

  try {
    const recentEntries = entries.slice(0, 10);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Based on recent health tracking entries, suggest 3 quick actions the user might want to track next. Be specific and practical.

Recent entries: ${JSON.stringify(recentEntries.map(e => ({
  type: e.type,
  severity: e.severity,
  timestamp: e.timestamp,
  note: e.note?.substring(0, 50)
})))}

Return a JSON array of 3 short, actionable suggestions (max 30 chars each):
["Check energy level", "Log water intake", "Note sleep quality"]

Focus on:
- Missing data patterns
- Follow-up actions
- Preventive measures
- Recovery tracking`
          }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 200,
        }
      })
    });

    if (!response.ok) throw new Error('API request failed');

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (content) {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          return Array.isArray(suggestions) ? suggestions.slice(0, 3) : [];
        }
      } catch (parseError) {
        console.error('Failed to parse suggestions:', parseError);
      }
    }
    
    return [];
  } catch (error) {
    console.error('Failed to generate suggestions:', error);
    return [];
  }
};

export const generateInsights = async (entries: FlareEntry[], apiKey: string): Promise<any[]> => {
  console.log('🔍 Generating insights with Gemini API...');
  console.log('📊 Entry count:', entries.length);
  console.log('🔑 API Key available:', !!apiKey);

  if (!entries.length || !apiKey) {
    console.log('❌ No entries or API key available');
    return [];
  }

  try {
    const recentEntries = entries.slice(0, 20);
    console.log('📝 Processing entries:', recentEntries.length);

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze these health tracking entries and generate actionable insights. Focus on patterns, correlations, and recommendations.

Entries data: ${JSON.stringify(recentEntries.map(e => ({
  type: e.type,
  severity: e.severity,
  energyLevel: e.energyLevel,
  symptoms: e.symptoms,
  timestamp: e.timestamp,
  note: e.note?.substring(0, 100),
  environmentalData: e.environmentalData,
  physiologicalData: e.physiologicalData
})))}

Return a JSON array of insights in this exact format:
[
  {
    "type": "pattern|correlation|recommendation|warning",
    "title": "Short insight title",
    "description": "Detailed explanation with actionable advice",
    "confidence": 0.85
  }
]

Generate 3-5 insights focusing on:
1. Temporal patterns (time of day, day of week, seasonal)
2. Environmental correlations (weather, temperature, air quality)
3. Physiological patterns (sleep, stress, heart rate)
4. Severity trends and triggers
5. Actionable recommendations for improvement

Be specific, medical-appropriate, and helpful. Confidence should be 0.7-0.95.`
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 800,
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Gemini API request failed:', response.status, response.statusText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 Gemini insights response:', data);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📝 Extracted insights content:', content);
    
    if (content) {
      try {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const insights = JSON.parse(jsonMatch[0]);
          console.log('✅ Parsed insights:', insights);
          return Array.isArray(insights) ? insights : [];
        } else {
          console.log('⚠️ No JSON array found in response');
        }
      } catch (parseError) {
        console.error('❌ Failed to parse insights JSON:', parseError);
      }
    }
    
    return [];
  } catch (error) {
    console.error('❌ Failed to generate insights:', error);
    return [];
  }
};