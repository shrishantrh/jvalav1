import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, audioBase64 } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Use Lovable AI to analyze the transcript and extract structured data
    const analysisPrompt = `You are a medical symptom tracker AI. Analyze this voice note transcript from a patient tracking their health condition (like migraines, chronic pain, etc.).

Extract the following information in JSON format:
{
  "severity": "mild" | "moderate" | "severe" | null,
  "symptoms": string[] (list of symptoms mentioned),
  "triggers": string[] (list of potential triggers mentioned),
  "medications": string[] (list of medications mentioned),
  "notes": string (summary of key points),
  "energy_level": "very-low" | "low" | "moderate" | "good" | "high" | null
}

Be conservative - only extract information that is clearly mentioned. If something is not mentioned, use null for single values or empty array for lists.

Voice transcript: "${transcript}"`;

    console.log("Analyzing transcript:", transcript.substring(0, 100));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a medical symptom extraction AI. Always respond with valid JSON only, no markdown." },
          { role: "user", content: analysisPrompt }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_health_data",
              description: "Extract structured health data from voice transcript",
              parameters: {
                type: "object",
                properties: {
                  severity: { 
                    type: "string", 
                    enum: ["mild", "moderate", "severe"],
                    description: "Severity of the condition mentioned"
                  },
                  symptoms: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of symptoms mentioned"
                  },
                  triggers: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of potential triggers mentioned"
                  },
                  medications: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "List of medications mentioned"
                  },
                  notes: { 
                    type: "string",
                    description: "Summary of key points from the transcript"
                  },
                  energy_level: { 
                    type: "string", 
                    enum: ["very-low", "low", "moderate", "good", "high"],
                    description: "Energy level mentioned"
                  }
                },
                required: ["symptoms", "triggers", "medications", "notes"]
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_health_data" } }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));

    // Extract the function call result
    let extractedData = {
      severity: null,
      symptoms: [],
      triggers: [],
      medications: [],
      notes: transcript,
      energy_level: null
    };

    if (data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments) {
      try {
        extractedData = JSON.parse(data.choices[0].message.tool_calls[0].function.arguments);
      } catch (e) {
        console.error("Failed to parse tool call arguments:", e);
      }
    }

    console.log("Extracted data:", extractedData);

    return new Response(JSON.stringify({
      success: true,
      transcript,
      extracted: extractedData
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in transcribe-voice function:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
