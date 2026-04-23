import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RiskFactor {
  factor: string;
  impact: number;
  confidence: number;
  evidence: string;
  category: string;
  likelihoodRatio?: number;
}

interface IntelBriefing {
  riskScore: number;
  riskLevel: "low" | "moderate" | "high" | "very_high";
  confidence: number;
  factors: RiskFactor[];
  prediction: string;
  recommendations: string[];
  protectiveFactors: string[];
  accuracy?: {
    brierScore: number | null;
    totalPredictions: number;
    correctPredictions: number;
    calibrationNote: string;
  };
}

export function useIntelligenceBriefing(userId: string | null) {
  const [briefing, setBriefing] = useState<IntelBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBriefing = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.functions.invoke("health-forecast", {
        body: { userId },
      });
      if (err) throw err;
      if (data?.forecast) {
        setBriefing(data.forecast);
      } else if (data?.needsMoreData) {
        // Not enough data yet
        setBriefing(null);
      }
    } catch (e: any) {
      console.warn("[IntelBriefing] Could not fetch:", e);
      setError(e?.message || "Failed to load briefing");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBriefing();
  }, [fetchBriefing]);

  return { briefing, loading, error, refresh: fetchBriefing };
}
