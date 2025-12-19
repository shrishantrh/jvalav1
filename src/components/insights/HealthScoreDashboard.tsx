import React, { useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { FlareEntry } from "@/types/flare";
import { subDays, isWithinInterval, differenceInDays, eachDayOfInterval, format } from 'date-fns';
import { 
  Heart, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Activity,
  Moon,
  Zap,
  Target,
  Award
} from 'lucide-react';

interface HealthScoreDashboardProps {
  entries: FlareEntry[];
}

export const HealthScoreDashboard = ({ entries }: HealthScoreDashboardProps) => {
  const healthData = useMemo(() => {
    const now = new Date();
    const last30Days = entries.filter(e => 
      isWithinInterval(new Date(e.timestamp), { start: subDays(now, 30), end: now })
    );
    const prev30Days = entries.filter(e => 
      isWithinInterval(new Date(e.timestamp), { start: subDays(now, 60), end: subDays(now, 30) })
    );

    const flares30d = last30Days.filter(e => e.type === 'flare');
    const flaresPrev30d = prev30Days.filter(e => e.type === 'flare');

    // Calculate severity score (lower is better)
    const getSeverityWeight = (s: string) => s === 'severe' ? 30 : s === 'moderate' ? 15 : 5;
    const totalSeverityPenalty = flares30d.reduce((sum, e) => sum + getSeverityWeight(e.severity || 'mild'), 0);

    // Calculate logging consistency
    const daysWithLogs = new Set(
      last30Days.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))
    ).size;
    const loggingConsistency = Math.round((daysWithLogs / 30) * 100);

    // Calculate flare-free days
    const daysInRange = eachDayOfInterval({ start: subDays(now, 30), end: now });
    const daysWithFlares = new Set(
      flares30d.map(e => format(new Date(e.timestamp), 'yyyy-MM-dd'))
    );
    const flareFreeCount = daysInRange.filter(
      d => !daysWithFlares.has(format(d, 'yyyy-MM-dd'))
    ).length;

    // Calculate energy average
    const energyEntries = last30Days.filter(e => e.energyLevel);
    const energyMap: Record<string, number> = { 'very-low': 20, 'low': 40, 'moderate': 60, 'good': 80, 'high': 100 };
    const avgEnergy = energyEntries.length > 0
      ? Math.round(energyEntries.reduce((sum, e) => sum + (energyMap[e.energyLevel || 'moderate'] || 60), 0) / energyEntries.length)
      : null;

    // Calculate health score (0-100)
    // Start at 100, subtract based on flares and severity
    const maxPenalty = 100;
    const flarePenalty = Math.min(flares30d.length * 5, 40); // Max 40 points for frequency
    const severityPenalty = Math.min(totalSeverityPenalty, 40); // Max 40 points for severity
    const consistencyBonus = loggingConsistency >= 70 ? 10 : loggingConsistency >= 40 ? 5 : 0;
    
    const healthScore = Math.max(0, Math.min(100, 100 - flarePenalty - (severityPenalty / 3) + consistencyBonus));

    // Compare to previous period
    const prevFlareCount = flaresPrev30d.length;
    const currentFlareCount = flares30d.length;
    let trend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (currentFlareCount < prevFlareCount - 2) trend = 'improving';
    else if (currentFlareCount > prevFlareCount + 2) trend = 'worsening';

    // Days since last flare
    const sortedFlares = [...flares30d].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const daysSinceLastFlare = sortedFlares.length > 0 
      ? differenceInDays(now, new Date(sortedFlares[0].timestamp))
      : 30;

    return {
      healthScore: Math.round(healthScore),
      trend,
      flareCount: flares30d.length,
      prevFlareCount,
      flareFreeCount,
      loggingConsistency,
      avgEnergy,
      daysSinceLastFlare,
      totalEntries: last30Days.length
    };
  }, [entries]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-severity-none';
    if (score >= 60) return 'text-severity-mild';
    if (score >= 40) return 'text-severity-moderate';
    return 'text-severity-severe';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Needs Attention';
  };

  const getTrendIcon = () => {
    if (healthData.trend === 'improving') return <TrendingUp className="w-4 h-4 text-severity-none" />;
    if (healthData.trend === 'worsening') return <TrendingDown className="w-4 h-4 text-severity-severe" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-4">
      {/* Main Health Score */}
      <Card className="p-5 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">30-Day Health Score</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${getScoreColor(healthData.healthScore)}`}>
                {healthData.healthScore}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
            </div>
            <Badge variant="secondary" className="mt-2">
              {getScoreLabel(healthData.healthScore)}
            </Badge>
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <Heart className={`w-8 h-8 ${getScoreColor(healthData.healthScore)}`} />
          </div>
        </div>
        
        <Progress 
          value={healthData.healthScore} 
          className="h-2 mb-3"
        />
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {getTrendIcon()}
          <span>
            {healthData.trend === 'improving' && 'Improving from last month'}
            {healthData.trend === 'worsening' && 'Trending down from last month'}
            {healthData.trend === 'stable' && 'Stable compared to last month'}
          </span>
        </div>
      </Card>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Flares</span>
          </div>
          <p className="text-2xl font-bold">{healthData.flareCount}</p>
          <p className="text-xs text-muted-foreground">
            {healthData.prevFlareCount > 0 && (
              healthData.flareCount < healthData.prevFlareCount 
                ? `↓ ${healthData.prevFlareCount - healthData.flareCount} vs last month`
                : healthData.flareCount > healthData.prevFlareCount
                ? `↑ ${healthData.flareCount - healthData.prevFlareCount} vs last month`
                : 'Same as last month'
            )}
          </p>
        </Card>

        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-severity-none" />
            <span className="text-xs text-muted-foreground">Flare-Free</span>
          </div>
          <p className="text-2xl font-bold">{healthData.flareFreeCount}</p>
          <p className="text-xs text-muted-foreground">days this month</p>
        </Card>

        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Consistency</span>
          </div>
          <p className="text-2xl font-bold">{healthData.loggingConsistency}%</p>
          <p className="text-xs text-muted-foreground">logging rate</p>
        </Card>

        {healthData.avgEnergy !== null ? (
          <Card className="p-4 bg-gradient-card border-0 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-severity-mild" />
              <span className="text-xs text-muted-foreground">Energy</span>
            </div>
            <p className="text-2xl font-bold">{healthData.avgEnergy}%</p>
            <p className="text-xs text-muted-foreground">average level</p>
          </Card>
        ) : (
          <Card className="p-4 bg-gradient-card border-0 shadow-soft">
            <div className="flex items-center gap-2 mb-2">
              <Moon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Streak</span>
            </div>
            <p className="text-2xl font-bold">{healthData.daysSinceLastFlare}</p>
            <p className="text-xs text-muted-foreground">days since last flare</p>
          </Card>
        )}
      </div>

      {/* Insights */}
      {healthData.totalEntries < 10 && (
        <Card className="p-3 bg-muted/50 border-dashed">
          <p className="text-xs text-muted-foreground text-center">
            Log more entries for more accurate health insights
          </p>
        </Card>
      )}
    </div>
  );
};
