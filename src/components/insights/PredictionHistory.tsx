import React, { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Target, TrendingUp, TrendingDown, CheckCircle2, XCircle,
  Clock, BarChart3, Pill, Activity
} from 'lucide-react';
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import { format, subDays } from 'date-fns';

interface PredictionLog {
  id: string;
  risk_score: number;
  risk_level: string;
  confidence: number;
  predicted_at: string;
  outcome_logged: boolean;
  was_correct: boolean | null;
  brier_score: number | null;
  outcome_severity: string | null;
  outcome_flare_count: number | null;
}

interface MedEffectiveness {
  name: string;
  timesTaken: number;
  severityBefore: number;
  severityAfter: number;
  reductionPct: number;
  flareFreeRate: number;
}

export const PredictionHistory = () => {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<PredictionLog[]>([]);
  const [medLogs, setMedLogs] = useState<any[]>([]);
  const [flareEntries, setFlareEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [predRes, medRes, flareRes] = await Promise.all([
        supabase.from('prediction_logs').select('*').eq('user_id', user.id)
          .order('predicted_at', { ascending: false }).limit(30),
        supabase.from('medication_logs').select('*').eq('user_id', user.id)
          .order('taken_at', { ascending: false }).limit(200),
        supabase.from('flare_entries').select('id, severity, timestamp, medications')
          .eq('user_id', user.id).order('timestamp', { ascending: false }).limit(300),
      ]);
      if (predRes.data) setPredictions(predRes.data);
      if (medRes.data) setMedLogs(medRes.data);
      if (flareRes.data) setFlareEntries(flareRes.data);
      setLoading(false);
    };
    fetchData();
  }, [user]);

  // Prediction accuracy chart data
  const predictionChartData = useMemo(() => {
    return predictions
      .filter(p => p.outcome_logged)
      .slice(0, 14)
      .reverse()
      .map(p => ({
        date: format(new Date(p.predicted_at), 'MMM d'),
        predicted: p.risk_score,
        actual: p.outcome_flare_count && p.outcome_flare_count > 0
          ? (p.outcome_severity === 'severe' ? 90 : p.outcome_severity === 'moderate' ? 60 : 30)
          : 5,
        correct: p.was_correct,
      }));
  }, [predictions]);

  // Medication effectiveness
  const medEffectiveness = useMemo((): MedEffectiveness[] => {
    const sevToNum = (s: string) => s === 'mild' ? 1 : s === 'moderate' ? 2 : s === 'severe' ? 3 : 0;
    const uniqueMeds = [...new Set(medLogs.map(m => m.medication_name))];
    const oneDay = 86400000;

    return uniqueMeds.slice(0, 8).map(medName => {
      const doses = medLogs.filter(m => m.medication_name === medName);
      let sevBefore = 0, cntB = 0, sevAfter = 0, cntA = 0, flareFreeAfter = 0;

      for (const dose of doses) {
        const dt = new Date(dose.taken_at).getTime();
        const before = flareEntries.filter(f => {
          const t = new Date(f.timestamp).getTime();
          return t >= dt - oneDay && t < dt;
        });
        before.forEach(f => { sevBefore += sevToNum(f.severity || 'mild'); cntB++; });

        const after = flareEntries.filter(f => {
          const t = new Date(f.timestamp).getTime();
          return t > dt && t <= dt + oneDay;
        });
        after.forEach(f => { sevAfter += sevToNum(f.severity || 'mild'); cntA++; });
        if (after.length === 0) flareFreeAfter++;
      }

      const avgB = cntB > 0 ? sevBefore / cntB : 0;
      const avgA = cntA > 0 ? sevAfter / cntA : 0;
      const reduction = avgB > 0 ? Math.round(((avgB - avgA) / avgB) * 100) : 0;

      return {
        name: medName,
        timesTaken: doses.length,
        severityBefore: Math.round(avgB * 100) / 100,
        severityAfter: Math.round(avgA * 100) / 100,
        reductionPct: reduction,
        flareFreeRate: doses.length > 0 ? Math.round((flareFreeAfter / doses.length) * 100) : 0,
      };
    }).filter(m => m.timesTaken >= 2).sort((a, b) => b.reductionPct - a.reductionPct);
  }, [medLogs, flareEntries]);

  // Accuracy stats
  const accuracyStats = useMemo(() => {
    const verified = predictions.filter(p => p.outcome_logged);
    const correct = verified.filter(p => p.was_correct);
    const brierScores = verified.filter(p => p.brier_score != null).map(p => p.brier_score!);
    const avgBrier = brierScores.length >= 3
      ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length : null;
    return {
      total: verified.length,
      correct: correct.length,
      accuracy: verified.length > 0 ? Math.round((correct.length / verified.length) * 100) : null,
      brier: avgBrier,
      pending: predictions.filter(p => !p.outcome_logged).length,
    };
  }, [predictions]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className={cn(
            "p-5 rounded-3xl animate-pulse",
            "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
            "border border-white/50 dark:border-slate-700/50"
          )}>
            <div className="h-5 w-40 bg-muted rounded mb-3" />
            <div className="h-40 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Prediction Accuracy Card */}
      {accuracyStats.total >= 3 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-bold">Prediction Accuracy</h3>
              <p className="text-xs text-muted-foreground">
                {accuracyStats.correct}/{accuracyStats.total} correct predictions
                {accuracyStats.brier !== null && ` · Brier: ${accuracyStats.brier.toFixed(3)}`}
              </p>
            </div>
            {accuracyStats.accuracy !== null && (
              <Badge variant="outline" className={cn(
                "ml-auto text-sm font-bold",
                accuracyStats.accuracy >= 70 ? "text-emerald-600 border-emerald-500/30" :
                accuracyStats.accuracy >= 50 ? "text-yellow-600 border-yellow-500/30" :
                "text-red-600 border-red-500/30"
              )}>
                {accuracyStats.accuracy}%
              </Badge>
            )}
          </div>

          {predictionChartData.length >= 3 && (
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={predictionChartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="predicted" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Predicted Risk %" />
                  <Line type="monotone" dataKey="actual" stroke="hsl(350, 70%, 55%)" strokeWidth={2} dot={{ r: 3 }} name="Actual Outcome" />
                  <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Recent predictions list */}
          <div className="mt-3 space-y-1.5">
            {predictions.slice(0, 5).map(p => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                {p.outcome_logged ? (
                  p.was_correct
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    : <XCircle className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {format(new Date(p.predicted_at), 'MMM d')}
                </span>
                <span className={cn(
                  "font-medium",
                  p.risk_level === 'low' ? 'text-emerald-600' :
                  p.risk_level === 'moderate' ? 'text-yellow-600' :
                  p.risk_level === 'high' ? 'text-orange-600' : 'text-red-600'
                )}>
                  {p.risk_score}% {p.risk_level}
                </span>
                {p.outcome_logged && (
                  <span className="text-muted-foreground ml-auto">
                    → {p.outcome_severity === 'none' ? 'No flare' : `${p.outcome_severity} flare`}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medication Effectiveness */}
      {medEffectiveness.length > 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Pill className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base font-bold">Medication Effectiveness</h3>
              <p className="text-xs text-muted-foreground">Based on flare severity before vs after dosing</p>
            </div>
          </div>

          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={medEffectiveness} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 10 }} domain={[-20, 100]} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                  formatter={(value: number) => [`${value}%`, 'Severity Reduction']}
                />
                <Bar dataKey="reductionPct" fill="hsl(280, 70%, 55%)" radius={[0, 6, 6, 0]} name="Severity Reduction" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 space-y-2">
            {medEffectiveness.map(med => (
              <div key={med.name} className={cn(
                "flex items-center justify-between p-3 rounded-xl",
                "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
                "border border-white/40 dark:border-slate-700/40"
              )}>
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium">{med.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Taken {med.timesTaken}× · {med.flareFreeRate}% flare-free rate
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={cn(
                  "text-xs font-bold",
                  med.reductionPct > 30 ? "text-emerald-600 border-emerald-500/30" :
                  med.reductionPct > 0 ? "text-yellow-600 border-yellow-500/30" :
                  "text-red-600 border-red-500/30"
                )}>
                  {med.reductionPct > 0 ? '↓' : '↑'}{Math.abs(med.reductionPct)}%
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No data states */}
      {predictions.length === 0 && medEffectiveness.length === 0 && (
        <div className={cn(
          "relative p-8 rounded-3xl text-center",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50"
        )}>
          <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">Not enough data yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Keep logging daily to see prediction accuracy and medication analysis
          </p>
        </div>
      )}
    </div>
  );
};
