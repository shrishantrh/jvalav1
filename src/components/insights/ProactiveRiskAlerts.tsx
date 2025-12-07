import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CloudRain, Thermometer, Wind, X, TrendingUp, Calendar } from 'lucide-react';
import { FlareEntry } from "@/types/flare";
import { cn } from "@/lib/utils";

interface ProactiveRiskAlertsProps {
  recentEntries: FlareEntry[];
  userTriggers: string[];
  userConditions: string[];
  currentWeather?: {
    condition: string;
    temperature: number;
    humidity: number;
    city?: string;
  };
}

interface RiskAlert {
  id: string;
  type: 'weather' | 'pattern' | 'streak' | 'trigger';
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  icon: typeof AlertTriangle;
  dismissed?: boolean;
}

const DISMISSED_KEY = 'jvala_dismissed_alerts';

export const ProactiveRiskAlerts = ({ 
  recentEntries, 
  userTriggers, 
  userConditions,
  currentWeather 
}: ProactiveRiskAlertsProps) => {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    // Load from localStorage on mount
    try {
      const saved = localStorage.getItem(DISMISSED_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only keep dismissals from last 24 hours
        const now = Date.now();
        const validDismissals = Object.entries(parsed)
          .filter(([_, timestamp]) => now - (timestamp as number) < 24 * 60 * 60 * 1000)
          .map(([id]) => id);
        return new Set(validDismissals);
      }
    } catch {}
    return new Set();
  });

  useEffect(() => {
    const newAlerts: RiskAlert[] = [];
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;

    // Get flares from last 7 days
    const last7DaysFlares = recentEntries.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / dayMs;
      return age <= 7 && (e.type === 'flare' || e.severity);
    });

    // Get flares from previous 7 days for comparison
    const prev7DaysFlares = recentEntries.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / dayMs;
      return age > 7 && age <= 14 && (e.type === 'flare' || e.severity);
    });

    // Alert 1: Increasing flare trend
    if (last7DaysFlares.length > prev7DaysFlares.length * 1.5 && last7DaysFlares.length >= 3) {
      const increase = Math.round(((last7DaysFlares.length - prev7DaysFlares.length) / Math.max(prev7DaysFlares.length, 1)) * 100);
      newAlerts.push({
        id: 'trend-increase',
        type: 'pattern',
        severity: 'high',
        title: 'Flare Trend Rising',
        message: `Your flares are up ${increase}% this week (${last7DaysFlares.length} vs ${prev7DaysFlares.length} last week). Consider reviewing recent triggers.`,
        icon: TrendingUp,
      });
    }

    // Alert 2: Severe flare within 24 hours
    const recentSevere = last7DaysFlares.filter(e => {
      const age = (now - new Date(e.timestamp).getTime()) / dayMs;
      return age <= 1 && e.severity === 'severe';
    });
    if (recentSevere.length > 0) {
      newAlerts.push({
        id: 'recent-severe',
        type: 'pattern',
        severity: 'medium',
        title: 'Recent Severe Flare',
        message: `You had a severe flare recently. Take it easy and monitor for follow-up symptoms.`,
        icon: AlertTriangle,
      });
    }

    // Alert 3: Weather-based risk
    if (currentWeather) {
      const weatherCondition = currentWeather.condition.toLowerCase();
      const highHumidity = currentWeather.humidity > 75;
      const coldTemp = currentWeather.temperature < 45;
      
      // Check if weather conditions correlate with past flares
      const weatherTriggerFlares = recentEntries.filter(e => {
        const envData = e.environmentalData as any;
        return envData?.weather?.condition?.toLowerCase().includes(weatherCondition.split(' ')[0]);
      });

      if ((highHumidity || coldTemp) && weatherTriggerFlares.length >= 2) {
        newAlerts.push({
          id: 'weather-risk',
          type: 'weather',
          severity: highHumidity && coldTemp ? 'high' : 'medium',
          title: 'Weather Alert',
          message: `Current conditions (${currentWeather.condition}, ${currentWeather.humidity}% humidity) are similar to ${weatherTriggerFlares.length} of your past flares.`,
          icon: highHumidity ? CloudRain : coldTemp ? Thermometer : Wind,
        });
      }
    }

    // Alert 4: Haven't logged in a while
    const lastEntry = recentEntries[0];
    if (lastEntry) {
      const hoursSinceLog = (now - new Date(lastEntry.timestamp).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLog > 48) {
        newAlerts.push({
          id: 'no-logging',
          type: 'streak',
          severity: 'low',
          title: 'Keep Your Streak',
          message: `It's been ${Math.floor(hoursSinceLog / 24)} days since your last log. Regular tracking helps identify patterns.`,
          icon: Calendar,
        });
      }
    }

    // Alert 5: Time-of-day pattern
    const hourCounts: Record<string, number> = {};
    last7DaysFlares.forEach(f => {
      const hour = new Date(f.timestamp).getHours();
      const period = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      hourCounts[period] = (hourCounts[period] || 0) + 1;
    });
    const currentHour = new Date().getHours();
    const currentPeriod = currentHour < 12 ? 'morning' : currentHour < 18 ? 'afternoon' : 'evening';
    
    if (hourCounts[currentPeriod] >= 3) {
      newAlerts.push({
        id: 'time-pattern',
        type: 'pattern',
        severity: 'low',
        title: 'Peak Flare Time',
        message: `${hourCounts[currentPeriod]} of your recent flares occurred during the ${currentPeriod}. Stay mindful.`,
        icon: AlertTriangle,
      });
    }

    setAlerts(newAlerts.filter(a => !dismissedIds.has(a.id)));
  }, [recentEntries, userTriggers, currentWeather, dismissedIds]);

  const dismissAlert = (id: string) => {
    const newDismissed = new Set([...dismissedIds, id]);
    setDismissedIds(newDismissed);
    
    // Persist to localStorage with timestamp
    try {
      const existing = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}');
      existing[id] = Date.now();
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(existing));
    } catch {}
  };

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <AlertTriangle className="w-3.5 h-3.5" />
        Risk Alerts
      </h3>
      
      <div className="space-y-2">
        {alerts.slice(0, 3).map((alert) => {
          const Icon = alert.icon;
          return (
            <Card 
              key={alert.id} 
              className={cn(
                "p-3 border-l-4",
                alert.severity === 'high' && "border-l-severity-severe bg-severity-severe/5",
                alert.severity === 'medium' && "border-l-severity-moderate bg-severity-moderate/5",
                alert.severity === 'low' && "border-l-severity-mild bg-severity-mild/5"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <Icon className={cn(
                    "w-4 h-4 mt-0.5 shrink-0",
                    alert.severity === 'high' && "text-severity-severe",
                    alert.severity === 'medium' && "text-severity-moderate",
                    alert.severity === 'low' && "text-severity-mild"
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{alert.title}</span>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          "text-[10px] h-4",
                          alert.severity === 'high' && "border-severity-severe text-severity-severe",
                          alert.severity === 'medium' && "border-severity-moderate text-severity-moderate",
                          alert.severity === 'low' && "border-severity-mild text-severity-mild"
                        )}
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={() => dismissAlert(alert.id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
