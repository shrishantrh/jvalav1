import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Watch, 
  Heart, 
  Footprints, 
  Moon, 
  Flame, 
  RefreshCw, 
  Loader2,
  Link,
  Unlink,
  Activity,
  Wind,
  Thermometer,
  Droplets,
  Zap,
  Timer,
  Smartphone
} from "lucide-react";
import { useWearableData, WearableData } from "@/hooks/useWearableData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { isNative, platform } from '@/lib/capacitor';

interface WearableIntegrationProps {
  onDataSync?: (data: WearableData) => void;
}

export const WearableIntegration = ({ onDataSync }: WearableIntegrationProps) => {
  const { 
    data, 
    connections, 
    isLoading, 
    isSyncing, 
    connectDevice, 
    disconnectDevice, 
    syncData 
  } = useWearableData();
  
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null);

  const handleConnect = async (type: 'fitbit' | 'apple_health' | 'google_fit' | 'oura') => {
    setConnectingDevice(type);
    const success = await connectDevice(type);
    if (success && type !== 'fitbit' && onDataSync) {
      // For Fitbit, data will sync after OAuth callback
      const newData = await syncData(type);
      if (newData) onDataSync(newData);
    }
    setConnectingDevice(null);
  };

  const handleSync = async () => {
    const newData = await syncData();
    if (newData && onDataSync) {
      onDataSync(newData);
    }
  };

  const hasConnection = connections.some(c => c.connected);

  const getSleepQualityColor = (quality?: string) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-100';
      case 'good': return 'text-blue-600 bg-blue-100';
      case 'fair': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const getDeviceIcon = (type: string) => {
    if (type === 'fitbit') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <path d="M12.5 5.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5S10.17 4 11 4s1.5.67 1.5 1.5zm0 6.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm0 6.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5z"/>
        </svg>
      );
    }
    if (type === 'oura') {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
        </svg>
      );
    }
    if (type === 'apple_health') {
      return (
        <Heart className="w-4 h-4 text-red-500" />
      );
    }
    if (type === 'google_fit') {
      return (
        <Activity className="w-4 h-4 text-green-500" />
      );
    }
    return <Watch className="w-4 h-4" />;
  };

  // Check if we should show native health as the primary option
  const isIOS = isNative && platform === 'ios';
  const isAndroid = isNative && platform === 'android';
  
  // Filter connections based on platform - prioritize native health on native
  const displayConnections = connections.filter(conn => {
    // On iOS, hide Health Connect; on Android, hide Apple Health
    if (isIOS && conn.type === 'google_fit') return false;
    if (isAndroid && conn.type === 'apple_health') return false;
    // On web, show all but mark native-only as coming soon
    return true;
  });

  return (
    <div className="space-y-4">
      <Card className="p-5 bg-gradient-card border-0 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Watch className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Wearable Devices</h3>
              <p className="text-xs text-muted-foreground">
                Sync health data from your devices
              </p>
            </div>
          </div>
          {hasConnection && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>

        {/* Connection Cards */}
        <div className="grid grid-cols-1 gap-3 mb-4">
          {displayConnections.map((conn) => (
            <div
              key={conn.id}
              className={cn(
                "p-4 rounded-xl border transition-all",
                conn.connected 
                  ? "bg-primary/5 border-primary/30" 
                  : conn.comingSoon
                    ? "bg-muted/20 border-muted/50 opacity-70"
                    : "bg-muted/30 border-muted"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-full",
                    conn.connected ? "bg-primary/20" : "bg-muted"
                  )}>
                    {getDeviceIcon(conn.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{conn.name}</span>
                      {conn.comingSoon && (
                        <Badge variant="secondary" className="text-[10px] h-4 bg-amber-100 text-amber-700 border-amber-200">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    {conn.connected && conn.lastSync && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {format(new Date(conn.lastSync), 'h:mm a')}
                      </p>
                    )}
                    {conn.comingSoon && !conn.connected && (
                      <p className="text-xs text-muted-foreground">
                        Stay tuned for updates
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {conn.connected && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Connected
                    </Badge>
                  )}
                  
                  {conn.connected ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => disconnectDevice(conn.type)}
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  ) : (
                    <Button
                      variant={!conn.comingSoon ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleConnect(conn.type)}
                      disabled={isLoading || connectingDevice === conn.type || conn.comingSoon}
                    >
                      {connectingDevice === conn.type ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Link className="w-4 h-4 mr-1" />
                          {conn.comingSoon ? 'Soon' : 'Connect'}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Comprehensive Data Display - works for both Fitbit and Apple Health */}
      {data && (data.source === 'fitbit' || data.source === 'apple_health') && (
        <Card className="p-5 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              {data.source === 'apple_health' ? (
                <Heart className="w-4 h-4 text-red-500" />
              ) : (
                <Activity className="w-4 h-4 text-primary" />
              )}
              Today's {data.source === 'apple_health' ? 'Apple Health' : 'Fitbit'} Data
            </h4>
            {data.lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(data.lastSyncedAt), 'h:mm a')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Heart Rate */}
            {data.heartRate && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-2 mb-1">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Resting HR</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-red-600">{data.heartRate}</span>
                  <span className="text-xs text-muted-foreground">bpm</span>
                </div>
              </div>
            )}

            {/* HRV */}
            {data.heartRateVariability && (
              <div className="p-3 rounded-xl bg-pink-50 border border-pink-100">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-pink-500" />
                  <span className="text-xs text-muted-foreground">HRV</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-pink-600">{Math.round(data.heartRateVariability)}</span>
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
              </div>
            )}

            {/* SpO2 */}
            {data.spo2 && (
              <div className="p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                <div className="flex items-center gap-2 mb-1">
                  <Droplets className="w-4 h-4 text-cyan-500" />
                  <span className="text-xs text-muted-foreground">SpO2</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-cyan-600">{data.spo2}</span>
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
            )}

            {/* Breathing Rate */}
            {data.breathingRate && (
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
                <div className="flex items-center gap-2 mb-1">
                  <Wind className="w-4 h-4 text-teal-500" />
                  <span className="text-xs text-muted-foreground">Breathing</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-teal-600">{data.breathingRate.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">bpm</span>
                </div>
              </div>
            )}

            {/* Skin Temperature */}
            {data.skinTemperature && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer className="w-4 h-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Skin Temp</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-amber-600">
                    {data.skinTemperature > 0 ? '+' : ''}{data.skinTemperature.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">°C</span>
                </div>
              </div>
            )}

            {/* VO2 Max */}
            {data.vo2Max && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">VO2 Max</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-emerald-600">{data.vo2Max}</span>
                  <span className="text-xs text-muted-foreground">ml/kg/min</span>
                </div>
              </div>
            )}

            {/* Steps */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Footprints className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Steps</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-600">
                  {data.steps?.toLocaleString() || '0'}
                </span>
              </div>
              {data.activeMinutes && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data.activeMinutes} active min
                </p>
              )}
            </div>

            {/* Active Zone Minutes */}
            {data.activeZoneMinutesTotal && (
              <div className="p-3 rounded-xl bg-violet-50 border border-violet-100">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="w-4 h-4 text-violet-500" />
                  <span className="text-xs text-muted-foreground">Zone Min</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-violet-600">{data.activeZoneMinutesTotal}</span>
                  <span className="text-xs text-muted-foreground">min</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data.cardioMinutes || 0} cardio • {data.peakMinutes || 0} peak
                </p>
              </div>
            )}

            {/* Sleep */}
            {data.sleepHours !== undefined && data.sleepHours !== null && (
              <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2 mb-1">
                  <Moon className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Sleep</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-purple-600">{data.sleepHours}</span>
                  <span className="text-xs text-muted-foreground">hrs</span>
                </div>
                {data.sleepQuality && (
                  <Badge className={cn("text-[10px] mt-1", getSleepQualityColor(data.sleepQuality))}>
                    {data.sleepQuality}
                  </Badge>
                )}
                {data.sleepEfficiency && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {data.sleepEfficiency}% efficiency
                  </p>
                )}
              </div>
            )}

            {/* Calories */}
            {data.caloriesBurned && (
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Calories</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-orange-600">
                    {data.caloriesBurned?.toLocaleString() || '0'}
                  </span>
                  <span className="text-xs text-muted-foreground">kcal</span>
                </div>
                {data.activityCalories && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {data.activityCalories} from activity
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Sleep Stages */}
          {data.sleepStages && (data.deepSleepMinutes || data.remSleepMinutes) && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <h5 className="text-xs font-medium mb-2 text-muted-foreground">Sleep Stages</h5>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center p-2 rounded-lg bg-indigo-50/50">
                  <span className="text-lg font-bold text-indigo-600">{data.deepSleepMinutes || 0}</span>
                  <p className="text-[10px] text-muted-foreground">Deep</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50/50">
                  <span className="text-lg font-bold text-blue-600">{data.lightSleepMinutes || 0}</span>
                  <p className="text-[10px] text-muted-foreground">Light</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-purple-50/50">
                  <span className="text-lg font-bold text-purple-600">{data.remSleepMinutes || 0}</span>
                  <p className="text-[10px] text-muted-foreground">REM</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-50/50">
                  <span className="text-lg font-bold text-gray-600">{data.wakeSleepMinutes || 0}</span>
                  <p className="text-[10px] text-muted-foreground">Awake</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
