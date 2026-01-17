import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Heart, Activity, Moon, Footprints, Flame, 
  Droplets, Wind, Thermometer, Zap, Timer,
  TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { MockWearableData } from "@/services/mockWearableData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DemoWearableDataProps {
  data: MockWearableData;
  showTrends?: boolean;
}

export const DemoWearableData = ({ data, showTrends = true }: DemoWearableDataProps) => {
  const getSleepQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'good': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'fair': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'poor': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-3 h-3 text-emerald-500" />;
      case 'down': return <TrendingDown className="w-3 h-3 text-red-500" />;
      default: return <Minus className="w-3 h-3 text-muted-foreground" />;
    }
  };

  const MetricCard = ({ 
    icon: Icon, 
    label, 
    value, 
    unit, 
    subtext,
    color,
    trend
  }: {
    icon: any;
    label: string;
    value: string | number;
    unit?: string;
    subtext?: string;
    color: string;
    trend?: 'up' | 'down' | 'stable';
  }) => (
    <div className={cn("p-3 rounded-xl border", color)}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
        </div>
        {showTrends && trend && getTrendIcon(trend)}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold">{value}</span>
        {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
      </div>
      {subtext && <p className="text-[10px] text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );

  return (
    <Card className="p-5 bg-card border border-border/80 shadow-soft">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Real-time Wearable Data</h3>
            <p className="text-xs text-muted-foreground">
              Fitbit Sense 2 • Last sync: {format(new Date(data.lastSyncedAt), 'h:mm a')}
            </p>
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
          Connected
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Heart Rate */}
        <MetricCard
          icon={Heart}
          label="Resting HR"
          value={data.restingHeartRate}
          unit="bpm"
          color="bg-red-50 border-red-100 text-red-600"
          trend={data.restingHeartRate > 70 ? 'up' : 'stable'}
        />

        {/* HRV */}
        <MetricCard
          icon={Activity}
          label="HRV"
          value={Math.round(data.heartRateVariability)}
          unit="ms"
          subtext={data.heartRateVariability < 35 ? 'Below baseline' : 'Normal range'}
          color={data.heartRateVariability < 35 ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-pink-50 border-pink-100 text-pink-600"}
          trend={data.heartRateVariability < 35 ? 'down' : 'stable'}
        />

        {/* SpO2 */}
        <MetricCard
          icon={Droplets}
          label="Blood Oxygen"
          value={data.spo2}
          unit="%"
          subtext={`Range: ${data.spo2Min}-${data.spo2Max}%`}
          color="bg-cyan-50 border-cyan-100 text-cyan-600"
          trend="stable"
        />

        {/* Breathing */}
        <MetricCard
          icon={Wind}
          label="Breathing Rate"
          value={data.breathingRate.toFixed(1)}
          unit="brpm"
          color={data.breathingRate > 16 ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-teal-50 border-teal-100 text-teal-600"}
          trend={data.breathingRate > 16 ? 'up' : 'stable'}
        />

        {/* Temperature */}
        <MetricCard
          icon={Thermometer}
          label="Skin Temp"
          value={data.skinTemperature > 0 ? `+${data.skinTemperature.toFixed(1)}` : data.skinTemperature.toFixed(1)}
          unit="°C"
          subtext="vs baseline"
          color={data.skinTemperature > 0.5 ? "bg-orange-50 border-orange-100 text-orange-600" : "bg-amber-50 border-amber-100 text-amber-600"}
          trend={data.skinTemperature > 0.5 ? 'up' : 'stable'}
        />

        {/* VO2 Max */}
        <MetricCard
          icon={Zap}
          label="VO2 Max"
          value={data.vo2Max}
          unit="ml/kg/min"
          subtext={data.vo2MaxRange}
          color="bg-emerald-50 border-emerald-100 text-emerald-600"
          trend="stable"
        />

        {/* Steps */}
        <MetricCard
          icon={Footprints}
          label="Steps"
          value={data.steps.toLocaleString()}
          subtext={`${data.distance} km walked`}
          color={data.steps < 5000 ? "bg-amber-50 border-amber-100 text-amber-600" : "bg-blue-50 border-blue-100 text-blue-600"}
          trend={data.steps < 5000 ? 'down' : 'stable'}
        />

        {/* Active Zone */}
        <MetricCard
          icon={Timer}
          label="Active Zone"
          value={data.activeZoneMinutesTotal}
          unit="min"
          subtext={`${data.cardioMinutes} cardio • ${data.peakMinutes} peak`}
          color="bg-violet-50 border-violet-100 text-violet-600"
          trend={data.activeZoneMinutesTotal < 22 ? 'down' : 'stable'}
        />
      </div>

      {/* Sleep Section */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4 text-purple-500" />
            <span className="text-sm font-medium">Sleep Analysis</span>
          </div>
          <Badge className={cn("text-xs", getSleepQualityColor(data.sleepQuality))}>
            {data.sleepQuality.charAt(0).toUpperCase() + data.sleepQuality.slice(1)} Quality
          </Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
            <span className="text-xs text-muted-foreground">Duration</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-purple-600">{data.sleepHours}</span>
              <span className="text-xs text-muted-foreground">hrs</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <span className="text-xs text-muted-foreground">Efficiency</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-indigo-600">{data.sleepEfficiency}</span>
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        {/* Sleep Stages */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-indigo-50/50">
            <span className="text-lg font-bold text-indigo-600">{data.deepSleepMinutes}</span>
            <p className="text-[10px] text-muted-foreground">Deep</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-blue-50/50">
            <span className="text-lg font-bold text-blue-600">{data.lightSleepMinutes}</span>
            <p className="text-[10px] text-muted-foreground">Light</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-purple-50/50">
            <span className="text-lg font-bold text-purple-600">{data.remSleepMinutes}</span>
            <p className="text-[10px] text-muted-foreground">REM</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50/50">
            <span className="text-lg font-bold text-gray-600">{data.wakeSleepMinutes}</span>
            <p className="text-[10px] text-muted-foreground">Awake</p>
          </div>
        </div>
      </div>

      {/* Calories Section */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-medium">Energy Expenditure</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-orange-50/50">
            <span className="text-lg font-bold text-orange-600">{data.caloriesBurned.toLocaleString()}</span>
            <p className="text-[10px] text-muted-foreground">Total kcal</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50/50">
            <span className="text-lg font-bold text-red-600">{data.activityCalories}</span>
            <p className="text-[10px] text-muted-foreground">Active kcal</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-gray-50/50">
            <span className="text-lg font-bold text-gray-600">{data.caloriesBMR}</span>
            <p className="text-[10px] text-muted-foreground">BMR</p>
          </div>
        </div>
      </div>
    </Card>
  );
};
