import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAI } from "../_shared/ai-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── OpenFoodFacts API ───

async function searchOpenFoodFacts(query: string): Promise<any[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,brands,nutriments,serving_size,serving_quantity,code,image_front_small_url`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.products || []).map(formatOFFProduct);
  } catch (e) {
    console.error("OFF search error:", e);
    return [];
  }
}

async function lookupBarcode(barcode: string): Promise<any | null> {
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=product_name,brands,nutriments,serving_size,serving_quantity,code,image_front_small_url`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return formatOFFProduct(data.product);
  } catch (e) {
    console.error("OFF barcode error:", e);
    return null;
  }
}

function formatOFFProduct(p: any) {
  const n = p.nutriments || {};
  return {
    food_name: p.product_name || "Unknown",
    brand: p.brands || null,
    barcode: p.code || null,
    serving_size: p.serving_size || null,
    image_url: p.image_front_small_url || null,
    calories: n["energy-kcal_100g"] || n["energy-kcal_serving"] || null,
    total_fat_g: n.fat_100g ?? n.fat_serving ?? null,
    saturated_fat_g: n["saturated-fat_100g"] ?? null,
    trans_fat_g: n["trans-fat_100g"] ?? null,
    cholesterol_mg: n.cholesterol_100g ? n.cholesterol_100g * 1000 : null,
    sodium_mg: n.sodium_100g ? n.sodium_100g * 1000 : null,
    total_carbs_g: n.carbohydrates_100g ?? null,
    dietary_fiber_g: n.fiber_100g ?? null,
    total_sugars_g: n.sugars_100g ?? null,
    added_sugars_g: n["added-sugars_100g"] ?? null,
    protein_g: n.proteins_100g ?? null,
    vitamin_d_mcg: n["vitamin-d_100g"] ? n["vitamin-d_100g"] * 1000000 : null,
    calcium_mg: n.calcium_100g ? n.calcium_100g * 1000 : null,
    iron_mg: n.iron_100g ? n.iron_100g * 1000 : null,
    potassium_mg: n.potassium_100g ? n.potassium_100g * 1000 : null,
    vitamin_a_mcg: n["vitamin-a_100g"] ? n["vitamin-a_100g"] * 1000000 : null,
    vitamin_c_mg: n["vitamin-c_100g"] ? n["vitamin-c_100g"] * 1000 : null,
  };
}

// ─── AI Photo Analysis ───

async function analyzePhotoWithAI(imageDataUrl: string): Promise<any> {
  const systemPrompt = `You are a nutrition analysis AI. Given a photo of food, identify the food item(s) and estimate their nutritional content as accurately as possible.

You MUST respond using the analyze_food tool with your best estimates. If you can see a nutrition label, extract the exact values. If it's a photo of food, estimate based on visual portion size.

Be specific with food names (e.g., "Grilled Chicken Caesar Salad" not just "salad").`;

  const response = await callAI({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify this food and provide complete nutritional information. If there's a barcode or nutrition label visible, extract that data precisely." },
          { type: "image_url", image_url: { url: imageDataUrl } },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "analyze_food",
          description: "Return identified food with nutritional data",
          parameters: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    food_name: { type: "string" },
                    brand: { type: "string" },
                    serving_size: { type: "string" },
                    calories: { type: "number" },
                    total_fat_g: { type: "number" },
                    saturated_fat_g: { type: "number" },
                    trans_fat_g: { type: "number" },
                    cholesterol_mg: { type: "number" },
                    sodium_mg: { type: "number" },
                    total_carbs_g: { type: "number" },
                    dietary_fiber_g: { type: "number" },
                    total_sugars_g: { type: "number" },
                    added_sugars_g: { type: "number" },
                    protein_g: { type: "number" },
                    vitamin_d_mcg: { type: "number" },
                    calcium_mg: { type: "number" },
                    iron_mg: { type: "number" },
                    potassium_mg: { type: "number" },
                    detected_barcode: { type: "string" },
                  },
                  required: ["food_name", "calories", "total_fat_g", "total_carbs_g", "protein_g"],
                },
              },
              confidence: { type: "number", description: "0-1 confidence in identification" },
            },
            required: ["items", "confidence"],
            additionalProperties: false,
          },
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "analyze_food" } },
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("AI analysis error:", response.status, err);
    throw new Error("AI food analysis failed");
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error("No tool call in AI response");

  return JSON.parse(toolCall.function.arguments);
}

// ─── Main Handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, barcode, imageDataUrl } = await req.json();

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader || "" } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "search": {
        if (!query || query.length < 2) {
          result = { items: [] };
          break;
        }
        const items = await searchOpenFoodFacts(query);
        result = { items };
        break;
      }

      case "barcode": {
        if (!barcode) {
          return new Response(JSON.stringify({ error: "Barcode required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const item = await lookupBarcode(barcode);
        result = { item };
        break;
      }

      case "analyze_photo": {
        if (!imageDataUrl) {
          return new Response(JSON.stringify({ error: "Image required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await analyzePhotoWithAI(imageDataUrl);
        break;
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-food error:", e);
    
    const status = e.message?.includes("429") ? 429 : e.message?.includes("402") ? 402 : 500;
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Internal error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
