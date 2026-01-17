import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, Calendar, AlertTriangle, Pill, Activity, 
  Heart, Moon, Thermometer, Wind, TrendingUp, TrendingDown,
  FileText, Phone, Mail, Building2, Clock, MapPin
} from "lucide-react";
import { MockWearableData, MockEnvironmentalData, DEMO_PATIENT, generateMockEHRData } from "@/services/mockWearableData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { FlareEntry } from "@/types/flare";

interface ClinicalPatientSummaryProps {
  wearableData: MockWearableData;
  environmentalData: MockEnvironmentalData;
  recentEntries: FlareEntry[];
  showFullDetails?: boolean;
}

export const ClinicalPatientSummary = ({ 
  wearableData, 
  environmentalData, 
  recentEntries,
  showFullDetails = false 
}: ClinicalPatientSummaryProps) => {
  const ehrData = generateMockEHRData();
  const patient = DEMO_PATIENT;
  
  // Calculate metrics from entries
  const last30Days = recentEntries.filter(e => {
    const daysDiff = (new Date().getTime() - e.timestamp.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  });
  
  const flareCount = last30Days.filter(e => e.type === 'flare').length;
  const severeFlares = last30Days.filter(e => e.severity === 'severe').length;
  const avgSeverity = last30Days.length > 0 
    ? last30Days.reduce((sum, e) => {
        const sev = e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : e.severity === 'mild' ? 1 : 0;
        return sum + sev;
      }, 0) / last30Days.length
    : 0;

  const topTriggers = last30Days
    .flatMap(e => e.triggers || [])
    .reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
  
  const sortedTriggers = Object.entries(topTriggers).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const getHealthScore = () => {
    // Composite score based on wearable + flare data
    let score = 100;
    if (wearableData.heartRateVariability < 35) score -= 15;
    if (wearableData.sleepQuality === 'poor') score -= 20;
    if (wearableData.sleepQuality === 'fair') score -= 10;
    if (wearableData.steps < 5000) score -= 10;
    if (severeFlares > 0) score -= 15;
    if (flareCount > 5) score -= 10;
    return Math.max(0, Math.min(100, score));
  };

  const healthScore = getHealthScore();
  const riskLevel = healthScore >= 70 ? 'Low' : healthScore >= 50 ? 'Moderate' : 'High';

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <Card className="bg-card border border-border/80 shadow-soft overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{patient.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {patient.age} y/o {patient.gender} • DOB: {format(new Date(patient.dateOfBirth), 'MMM d, yyyy')}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {patient.conditions.map((condition, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {condition}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={cn(
                "text-3xl font-bold",
                healthScore >= 70 ? "text-emerald-600" : healthScore >= 50 ? "text-amber-600" : "text-red-600"
              )}>
                {healthScore}
              </div>
              <p className="text-xs text-muted-foreground">Health Score</p>
              <Badge className={cn(
                "mt-1 text-xs",
                riskLevel === 'Low' ? "bg-emerald-100 text-emerald-700" :
                riskLevel === 'Moderate' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
              )}>
                {riskLevel} Risk
              </Badge>
            </div>
          </div>
        </div>
        
        {showFullDetails && (
          <CardContent className="pt-4 border-t border-border/50">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" />
                  <span>{patient.primaryPhysician.practice}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>{patient.primaryPhysician.name}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  <span>{patient.primaryPhysician.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  <span>{patient.primaryPhysician.email}</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="p-3 text-center bg-card border border-border/80">
          <div className="text-2xl font-bold text-primary">{flareCount}</div>
          <p className="text-xs text-muted-foreground">Flares (30d)</p>
        </Card>
        <Card className="p-3 text-center bg-card border border-border/80">
          <div className="text-2xl font-bold text-red-600">{severeFlares}</div>
          <p className="text-xs text-muted-foreground">Severe</p>
        </Card>
        <Card className="p-3 text-center bg-card border border-border/80">
          <div className="text-2xl font-bold text-blue-600">{wearableData.sleepHours}h</div>
          <p className="text-xs text-muted-foreground">Avg Sleep</p>
        </Card>
        <Card className="p-3 text-center bg-card border border-border/80">
          <div className="text-2xl font-bold text-emerald-600">{wearableData.heartRateVariability}</div>
          <p className="text-xs text-muted-foreground">HRV (ms)</p>
        </Card>
      </div>

      {/* Active Diagnoses & Medications */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border border-border/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Active Diagnoses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ehrData.diagnoses.filter(d => d.status === 'active').map((dx, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <p className="text-sm font-medium">{dx.name}</p>
                  <p className="text-xs text-muted-foreground">ICD-10: {dx.code}</p>
                </div>
                <Badge className="bg-blue-100 text-blue-700 text-[10px]">Active</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border border-border/80 shadow-soft">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              Current Medications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ehrData.medications.map((med, i) => (
              <div key={i} className="p-2 rounded-lg bg-muted/30">
                <p className="text-sm font-medium">{med.name}</p>
                <p className="text-xs text-muted-foreground">{med.dosage} • {med.frequency}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Allergies Banner */}
      <Card className="bg-red-50/50 border border-red-200 shadow-soft">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-900">Allergies</p>
              <div className="flex gap-2 mt-1">
                {ehrData.allergies.map((allergy, i) => (
                  <Badge key={i} className="bg-red-100 text-red-700 border-red-200 text-xs">
                    {allergy.allergen} ({allergy.severity})
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Physiological Trends */}
      <Card className="bg-card border border-border/80 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Real-Time Physiological Data
            <Badge className="ml-auto bg-emerald-100 text-emerald-700 text-[10px]">Live</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-center">
              <Heart className="w-4 h-4 text-red-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-red-600">{wearableData.restingHeartRate}</div>
              <p className="text-[10px] text-muted-foreground">Resting HR (bpm)</p>
            </div>
            <div className={cn(
              "p-3 rounded-lg text-center border",
              wearableData.heartRateVariability < 35 
                ? "bg-amber-50 border-amber-100" 
                : "bg-emerald-50 border-emerald-100"
            )}>
              <Activity className={cn("w-4 h-4 mx-auto mb-1", 
                wearableData.heartRateVariability < 35 ? "text-amber-500" : "text-emerald-500"
              )} />
              <div className={cn("text-xl font-bold",
                wearableData.heartRateVariability < 35 ? "text-amber-600" : "text-emerald-600"
              )}>
                {wearableData.heartRateVariability}
              </div>
              <p className="text-[10px] text-muted-foreground">HRV (ms)</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
              <Moon className="w-4 h-4 text-purple-500 mx-auto mb-1" />
              <div className="text-xl font-bold text-purple-600">{wearableData.sleepHours}h</div>
              <p className="text-[10px] text-muted-foreground">Sleep ({wearableData.sleepQuality})</p>
            </div>
            <div className={cn(
              "p-3 rounded-lg text-center border",
              wearableData.skinTemperature > 0.5 
                ? "bg-orange-50 border-orange-100" 
                : "bg-blue-50 border-blue-100"
            )}>
              <Thermometer className={cn("w-4 h-4 mx-auto mb-1",
                wearableData.skinTemperature > 0.5 ? "text-orange-500" : "text-blue-500"
              )} />
              <div className={cn("text-xl font-bold",
                wearableData.skinTemperature > 0.5 ? "text-orange-600" : "text-blue-600"
              )}>
                {wearableData.skinTemperature > 0 ? '+' : ''}{wearableData.skinTemperature.toFixed(1)}°
              </div>
              <p className="text-[10px] text-muted-foreground">Skin Temp (Δ)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identified Triggers */}
      <Card className="bg-card border border-border/80 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Top Identified Triggers (30 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedTriggers.map(([trigger, count], i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <span className="text-sm">{trigger}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${(count / (sortedTriggers[0]?.[1] || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{count}x</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environmental Context */}
      <Card className="bg-card border border-border/80 shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Current Environmental Context
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-center">
              <p className="text-xs text-muted-foreground">Temperature</p>
              <p className="text-lg font-bold text-blue-600">{environmentalData.weather.temperature}°F</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-50 border border-cyan-100 text-center">
              <p className="text-xs text-muted-foreground">Humidity</p>
              <p className="text-lg font-bold text-cyan-600">{environmentalData.weather.humidity}%</p>
            </div>
            <div className={cn(
              "p-3 rounded-lg text-center border",
              environmentalData.airQuality.aqi > 50 ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100"
            )}>
              <p className="text-xs text-muted-foreground">Air Quality</p>
              <p className={cn("text-lg font-bold",
                environmentalData.airQuality.aqi > 50 ? "text-amber-600" : "text-emerald-600"
              )}>
                {environmentalData.airQuality.aqi} AQI
              </p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50 border border-purple-100 text-center">
              <p className="text-xs text-muted-foreground">Pressure</p>
              <p className="text-lg font-bold text-purple-600">{environmentalData.weather.pressure}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
