import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (!audioFile) {
      throw new Error('No audio file provided');
    }

    console.log('🎤 Transcribing audio with Gemini API...');

    // Convert audio to base64
    const audioBytes = await audioFile.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBytes)));

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: audioFile.type || 'audio/webm',
                data: base64Audio
              }
            },
            {
              text: `Transcribe this audio and analyze it as a health note. Return JSON only.

Determine:
1. Entry type: flare, medication, trigger, recovery, energy, or note
2. If flare: severity (none, mild, moderate, severe) and possible symptoms
3. If energy: level (very-low, low, moderate, good, high)

Return JSON format:
{
  "transcription": "the exact transcribed text",
  "type": "flare|medication|trigger|recovery|energy|note",
  "severity": "none|mild|moderate|severe" (only for flares),
  "energyLevel": "very-low|low|moderate|good|high" (only for energy),
  "symptoms": ["symptom1", "symptom2"] (only for flares if mentioned),
  "medications": ["med1"] (only for medication entries),
  "triggers": ["trigger1"] (only for trigger entries)
}

Be specific but concise. Only include fields that are clearly indicated.`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      console.error('❌ Gemini API request failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('📤 Gemini API response:', data);
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (content) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log('✅ Parsed AI result:', parsed);
        
        return new Response(JSON.stringify({
          success: true,
          result: {
            transcription: parsed.transcription,
            type: parsed.type,
            ...(parsed.severity && { severity: parsed.severity }),
            ...(parsed.energyLevel && { energyLevel: parsed.energyLevel }),
            ...(parsed.symptoms && { symptoms: parsed.symptoms }),
            ...(parsed.medications && { medications: parsed.medications }),
            ...(parsed.triggers && { triggers: parsed.triggers }),
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: false, result: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Failed to transcribe audio:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
