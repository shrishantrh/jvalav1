import React, { useMemo, useEffect, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { HealthForecast } from "@/components/forecast/HealthForecast";
import { useAuth } from "@/hooks/useAuth";
import { useDeepAnalytics } from "@/hooks/useDeepAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Minus,
  Target,
  Shield,
  Zap,
  Utensils,
  Cloud,
  Moon,
  Activity,
  Heart,
  Clock,
  MapPin,
  Pill,
  Eye,
  ChevronRight,
  Beaker,
  Flame,
  Wind,
  Search as SearchIcon,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { format, subDays, isWithinInterval, differenceInDays } from 'date-fns';

interface CleanInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  onAskAI?: (prompt: string) => void;
}

interface Discovery {
  id: string;
  discovery_type: string;
  category: string;
  factor_a: string;
  factor_b: string | null;
  relationship: string;
  confidence: number;
  lift: number | null;
  occurrence_count: number;
  total_exposures: number;
  p_value: number | null;
  avg_delay_hours: number | null;
  evidence_summary: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// Status hierarchy for display
const STATUS_ORDER: Record<string, number> = { strong: 0, confirmed: 1, investigating: 2, emerging: 3 };

const getDiscoveryIcon = (category: string, type: string) => {
  if (type === 'protective_factor') return <Shield className="w-4 h-4" />;
  switch (category) {
    case 'food': return <Utensils className="w-4 h-4" />;
    case 'weather': case 'environmental': return <Cloud className="w-4 h-4" />;
    case 'sleep': return <Moon className="w-4 h-4" />;
    case 'activity': return <Activity className="w-4 h-4" />;
    case 'physiological': return <Heart className="w-4 h-4" />;
    case 'time': return <Clock className="w-4 h-4" />;
    case 'location': return <MapPin className="w-4 h-4" />;
    case 'medication': return <Pill className="w-4 h-4" />;
    case 'symptom': return <Eye className="w-4 h-4" />;
    default: return <Beaker className="w-4 h-4" />;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'strong': return { label: 'Strong', className: 'bg-red-500/15 text-red-600 border-red-500/30' };
    case 'confirmed': return { label: 'Confirmed', className: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30' };
    case 'investigating': return { label: 'Investigating', className: 'bg-amber-500/15 text-amber-600 border-amber-500/30' };
    case 'emerging': return { label: 'Emerging', className: 'bg-blue-500/15 text-blue-600 border-blue-500/30' };
    default: return { label: status, className: 'bg-muted text-muted-foreground' };
  }
};

const getConfidenceBar = (confidence: number) => {
  const pct = Math.round(confidence * 100);
  const color = confidence >= 0.7 ? 'bg-red-500' : confidence >= 0.4 ? 'bg-amber-500' : 'bg-blue-500';
  return { pct, color };
};

const formatDelay = (hours: number) => {
  if (hours < 1) return `${Math.round(hours * 60)}min`;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
};

export const CleanInsights = ({ entries, userConditions = [], onAskAI }: CleanInsightsProps) => {
  const { user } = useAuth();
  const analytics = useDeepAnalytics(entries);
  const [discoveries, setDiscoveries] = useState<Discovery[]>([]);
  const [loadingDiscoveries, setLoadingDiscoveries] = useState(true);

  // Fetch discoveries from Supabase
  useEffect(() => {
    if (!user) return;
    const fetchDiscoveries = async () => {
      setLoadingDiscoveries(true);
      const { data, error } = await supabase
        .from('discoveries')
        .select('*')
        .eq('user_id', user.id)
        .order('confidence', { ascending: false });
      
      if (!error && data) {
        setDiscoveries(data as Discovery[]);
      }
      setLoadingDiscoveries(false);
    };
    fetchDiscoveries();
  }, [user]);

  const basicStats = useMemo(() => {
    const now = new Date();
    const flares = entries.filter(e => e.type === 'flare');
    const last7Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 7), end: now })
    );
    const last30Days = flares.filter(e => 
      isWithinInterval(e.timestamp, { start: subDays(now, 30), end: now })
    );
    const getSeverityScore = (s: string | undefined) => s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
    const avgSeverity = last30Days.length > 0 
      ? last30Days.reduce((a, b) => a + getSeverityScore(b.severity), 0) / last30Days.length 
      : 0;
    const sortedFlares = [...last30Days].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    const daysSinceLastFlare = sortedFlares.length > 0 
      ? differenceInDays(now, sortedFlares[0].timestamp) : null;
    
    // Days logged this week (for consistency %)
    const weekStart = subDays(now, 7);
    const daysWithLogs = new Set(
      entries
        .filter(e => isWithinInterval(e.timestamp, { start: weekStart, end: now }))
        .map(e => format(e.timestamp, 'yyyy-MM-dd'))
    ).size;
    const daysLoggedPct = Math.round((daysWithLogs / 7) * 100);
    
    return { flares7d: last7Days.length, flares30d: last30Days.length, avgSeverity, daysSinceLastFlare, daysLoggedPct };
  }, [entries]);

  // Categorize discoveries
  const triggers = discoveries.filter(d => d.discovery_type === 'trigger' && d.relationship === 'increases_risk');
  const protectiveFactors = discoveries.filter(d => d.discovery_type === 'protective_factor' || d.relationship === 'decreases_risk');
  const patterns = discoveries.filter(d => d.discovery_type === 'pattern' || d.discovery_type === 'correlation');
  const strongFindings = discoveries.filter(d => d.status === 'strong' || d.status === 'confirmed');
  const emerging = discoveries.filter(d => d.status === 'emerging' || d.status === 'investigating');

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
          <Brain className="w-10 h-10 text-primary" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No data yet</h3>
        <p className="text-base text-muted-foreground max-w-xs">
          Start logging to unlock personalized insights and predictions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-2">
      {/* Tomorrow's Forecast */}
      {user && <HealthForecast userId={user.id} />}

      {/* Weekly Trend Card — keep existing */}
      <div className={cn(
        "relative p-5 rounded-3xl overflow-hidden",
        analytics.weeklyTrend.change > 2 ? "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20" :
        analytics.weeklyTrend.change < -2 ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20" :
        "bg-white/70 dark:bg-slate-900/70 border-white/50 dark:border-slate-700/50",
        "backdrop-blur-xl border shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {analytics.weeklyTrend.change > 2 ? (
                <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-red-600" />
                </div>
              ) : analytics.weeklyTrend.change < -2 ? (
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-emerald-600" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                  <Minus className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold">This Week</h3>
                <p className="text-base text-muted-foreground">
                  {format(subDays(new Date(), 7), 'MMM d')} – {format(new Date(), 'MMM d')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-4xl font-bold">{analytics.weeklyTrend.thisWeek}</p>
              <p className={cn(
                "text-base font-medium",
                analytics.weeklyTrend.change > 2 ? 'text-red-600' :
                analytics.weeklyTrend.change < -2 ? 'text-emerald-600' : 'text-muted-foreground'
              )}>
                {analytics.weeklyTrend.change > 0 ? '+' : ''}{analytics.weeklyTrend.change} vs last week
              </p>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-white/40 dark:bg-slate-800/40 rounded-xl p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Flame className="w-3 h-3 text-destructive" />
                <span className="text-lg font-bold text-foreground">{analytics.weeklyTrend.thisWeek}</span>
              </div>
              <p className="text-[9px] text-muted-foreground">Flares</p>
            </div>
            <div className="bg-white/40 dark:bg-slate-800/40 rounded-xl p-2 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Activity className="w-3 h-3 text-primary" />
                <span className="text-lg font-bold text-foreground">{basicStats.daysLoggedPct}%</span>
              </div>
              <p className="text-[9px] text-muted-foreground">Days Logged</p>
            </div>
            <div className="bg-white/40 dark:bg-slate-800/40 rounded-xl p-2 text-center">
              <span className="text-lg font-bold text-foreground">
                {basicStats.avgSeverity > 0 ? basicStats.avgSeverity.toFixed(1) : '-'}
              </span>
              <p className="text-[9px] text-muted-foreground">Avg Severity</p>
            </div>
          </div>
        </div>
      </div>

      {/* Flare-free streak */}
      {basicStats.daysSinceLastFlare !== null && basicStats.daysSinceLastFlare >= 2 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-emerald-500/15 to-emerald-500/5",
          "backdrop-blur-xl border border-emerald-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
              <Target className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {basicStats.daysSinceLastFlare} days flare-free
              </p>
              <p className="text-base text-muted-foreground">Keep up the great work!</p>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* DISCOVERED TRIGGERS — the real powerful stuff */}
      {/* ============================================ */}
      {triggers.length > 0 && (
        <div className={cn(
          "relative rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                <Flame className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 className="text-base font-bold">Your Triggers</h3>
                <p className="text-xs text-muted-foreground">Things that increase your flare risk</p>
              </div>
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-2">
            {triggers.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || b.confidence - a.confidence).slice(0, 6).map((d) => {
              const conf = getConfidenceBar(d.confidence);
              const statusBadge = getStatusBadge(d.status);
              return (
                <button
                  key={d.id}
                  onClick={() => onAskAI?.(`Tell me more about "${d.factor_a}" as a trigger. Here's what the discovery engine found: it occurred ${d.occurrence_count} out of ${d.total_exposures} times (${Math.round(d.confidence * 100)}% confidence), with a lift of ${d.lift?.toFixed(1) ?? 'N/A'}x and average delay of ${d.avg_delay_hours?.toFixed(1) ?? 'N/A'} hours. Status: ${d.status}. Relationship: ${d.relationship}. Based on this data, how strong is the evidence and what should I do about it?`)}
                  className={cn(
                    "w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]",
                    "bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm",
                    "border border-white/40 dark:border-slate-700/40",
                    "hover:border-primary/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                      d.confidence >= 0.5 ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
                    )}>
                      {getDiscoveryIcon(d.category, d.discovery_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold">{d.factor_a}</p>
                        <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5", statusBadge.className)}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                      
                      {/* Evidence summary */}
                      {d.evidence_summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{d.evidence_summary}</p>
                      )}
                      
                      {/* Confidence bar */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", conf.color)} style={{ width: `${conf.pct}%` }} />
                        </div>
                        <span className="text-[10px] font-semibold tabular-nums w-8 text-right">{conf.pct}%</span>
                      </div>
                      
                      {/* Stats row */}
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{d.occurrence_count} occurrences</span>
                        {d.lift && d.lift > 1 && (
                          <>
                            <span>•</span>
                            <span>{d.lift.toFixed(1)}× more likely</span>
                          </>
                        )}
                        {d.avg_delay_hours && (
                          <>
                            <span>•</span>
                            <span>~{formatDelay(d.avg_delay_hours)} delay</span>
                          </>
                        )}
                        {d.p_value !== null && d.p_value < 0.05 && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-600 font-medium">p&lt;0.05</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PROTECTIVE FACTORS */}
      {protectiveFactors.length > 0 && (
        <div className={cn(
          "relative rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-emerald-500/8 to-emerald-500/3",
          "backdrop-blur-xl border border-emerald-500/20",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold">What Helps You</h3>
                <p className="text-xs text-muted-foreground">Things that reduce your flare risk</p>
              </div>
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-2">
            {protectiveFactors.slice(0, 4).map((d) => {
              const conf = getConfidenceBar(d.confidence);
              return (
                <button
                  key={d.id}
                  onClick={() => onAskAI?.(`Tell me more about how "${d.factor_a}" helps with my condition. Discovery data: ${d.occurrence_count} out of ${d.total_exposures} exposures (${Math.round(d.confidence * 100)}% confidence), lift ${d.lift?.toFixed(1) ?? 'N/A'}x, relationship: ${d.relationship}, status: ${d.status}. What does this mean and how can I use this?`)}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl transition-all active:scale-[0.98]",
                    "bg-white/60 dark:bg-slate-800/50 backdrop-blur-sm",
                    "border border-emerald-500/10"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
                      {getDiscoveryIcon(d.category, d.discovery_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{d.factor_a}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-emerald-500/10 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${conf.pct}%` }} />
                        </div>
                        <span className="text-[10px] text-emerald-600 font-medium">{conf.pct}%</span>
                        <span className="text-[10px] text-muted-foreground">{d.occurrence_count}×</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* EMERGING / INVESTIGATING — "Keeping an Eye On" */}
      {emerging.length > 0 && (
        <div className={cn(
          "relative rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="p-5 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <SearchIcon className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-base font-bold">Under Investigation</h3>
                <p className="text-xs text-muted-foreground">Building evidence — keep logging</p>
              </div>
            </div>
          </div>
          
          <div className="px-4 pb-4 space-y-1.5">
            {emerging.slice(0, 5).map((d) => {
              const emoji = d.discovery_type === 'trigger' ? '🔍' : 
                           d.discovery_type === 'protective_factor' ? '🛡️' : 
                           d.discovery_type === 'pattern' ? '📊' : '💡';
              return (
                <button
                  key={d.id}
                  onClick={() => onAskAI?.(`What do you know so far about "${d.factor_a}" and my health? Discovery data: ${d.occurrence_count}/${d.total_exposures} occurrences (${Math.round(d.confidence * 100)}% confidence), lift ${d.lift?.toFixed(1) ?? 'N/A'}x, avg delay ${d.avg_delay_hours?.toFixed(1) ?? 'N/A'}h, status: ${d.status}. Is there a real connection forming?`)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl transition-all active:scale-[0.98]",
                    "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.factor_a}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.occurrence_count} occurrences • {Math.round(d.confidence * 100)}% confidence
                        {d.lift && d.lift > 1 ? ` • ${d.lift.toFixed(1)}× lift` : ''}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] h-4 px-1.5 shrink-0", getStatusBadge(d.status).className)}>
                      {getStatusBadge(d.status).label}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PATTERNS & CORRELATIONS from local analytics (keep existing but improved) */}
      {analytics.correlations.length > 0 && discoveries.length === 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Local Patterns</h3>
                <p className="text-sm text-muted-foreground">Based on {basicStats.flares30d} flares in 30 days</p>
              </div>
            </div>
            <div className="space-y-3">
              {analytics.correlations.slice(0, 5).map((corr, i) => (
                <div key={i} className="p-3 rounded-2xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border border-white/40 dark:border-slate-700/40">
                  <p className="text-sm font-semibold">{corr.factor}</p>
                  <p className="text-xs text-muted-foreground mt-1">{corr.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>{corr.occurrences} occurrences</span>
                    <span>•</span>
                    <span>{Math.round(corr.confidence * 100)}% confidence</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading state for discoveries */}
      {loadingDiscoveries && discoveries.length === 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50"
        )}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center animate-pulse">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Analyzing your data...</p>
              <p className="text-xs text-muted-foreground">Finding patterns across all your logs</p>
            </div>
          </div>
        </div>
      )}

      {/* No discoveries yet CTA */}
      {!loadingDiscoveries && discoveries.length === 0 && entries.length >= 3 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden text-center",
          "bg-gradient-to-br from-primary/5 to-primary/10",
          "backdrop-blur-xl border border-primary/10"
        )}>
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-sm font-semibold">Your discovery engine is warming up</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Keep logging daily — the AI is analyzing your entries for triggers, protective factors, and patterns
          </p>
        </div>
      )}

      {/* Action Button */}
      <Button
        data-tour="deep-research"
        onClick={() => onAskAI?.("Give me a deep analysis of all my triggers, protective factors, and patterns. What's statistically significant?")}
        className={cn(
          "w-full h-14 rounded-2xl text-base font-semibold",
          "bg-gradient-to-r from-primary to-primary/80",
          "shadow-lg shadow-primary/20"
        )}
      >
        <Brain className="w-5 h-5 mr-2" />
        Deep Analysis
      </Button>

      {/* Data count */}
      {basicStats.flares30d < 10 && (
        <p className="text-center text-sm text-muted-foreground px-4">
          💡 More accurate insights with {10 - basicStats.flares30d} more logged flares
        </p>
      )}

      {/* Medical Disclaimer */}
      <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
        <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
          <Shield className="w-3 h-3 inline mr-1 -mt-0.5" />
          Insights are for informational purposes only and do not constitute medical advice. Always consult a healthcare professional.
        </p>
      </div>
    </div>
  );
};
