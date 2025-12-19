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
  Activity
} from "lucide-react";
import { useWearableData, WearableData } from "@/hooks/useWearableData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
    if (success && type !== 'fitbit' && type !== 'oura' && onDataSync) {
      // For Fitbit, data will sync after OAuth callback
      // For Oura, data syncs during connect
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
    return <Watch className="w-4 h-4" />;
  };

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
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={cn(
                "p-4 rounded-xl border transition-all",
                conn.connected 
                  ? "bg-primary/5 border-primary/30" 
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
                    <span className="font-medium">{conn.name}</span>
                    {conn.connected && conn.lastSync && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {format(new Date(conn.lastSync), 'h:mm a')}
                      </p>
                    )}
                    {!conn.connected && conn.type !== 'fitbit' && conn.type !== 'oura' && (
                      <p className="text-xs text-muted-foreground">
                        Coming soon (mobile app)
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
                      variant={(conn.type === 'fitbit' || conn.type === 'oura') ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleConnect(conn.type)}
                      disabled={isLoading || connectingDevice === conn.type || (conn.type !== 'fitbit' && conn.type !== 'oura')}
                    >
                      {connectingDevice === conn.type ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Link className="w-4 h-4 mr-1" />
                          Connect
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

      {/* Data Display */}
      {data && (data.source === 'fitbit' || data.source === 'oura') && (
        <Card className="p-5 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Today's {data.source === 'oura' ? 'Oura' : 'Fitbit'} Data
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
              </div>
            )}

            {/* Oura-specific: Readiness Score */}
            {data.source === 'oura' && data.readinessScore && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-green-500" />
                  <span className="text-xs text-muted-foreground">Readiness</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-green-600">{data.readinessScore}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
            )}

            {/* Oura-specific: Sleep Score */}
            {data.source === 'oura' && data.sleepScore && (
              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                <div className="flex items-center gap-2 mb-1">
                  <Moon className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs text-muted-foreground">Sleep Score</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-indigo-600">{data.sleepScore}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
