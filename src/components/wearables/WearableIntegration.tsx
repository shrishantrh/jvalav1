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

  const handleConnect = async (type: 'apple_health' | 'google_fit') => {
    setConnectingDevice(type);
    const success = await connectDevice(type);
    if (success && onDataSync) {
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
        <div className="grid grid-cols-2 gap-3 mb-4">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className={cn(
                "p-3 rounded-xl border transition-all",
                conn.connected 
                  ? "bg-primary/5 border-primary/30" 
                  : "bg-muted/30 border-muted"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{conn.name}</span>
                {conn.connected && (
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">
                    Connected
                  </Badge>
                )}
              </div>
              
              {conn.connected ? (
                <div className="space-y-2">
                  {conn.lastSync && (
                    <p className="text-[10px] text-muted-foreground">
                      Last sync: {format(new Date(conn.lastSync), 'h:mm a')}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => disconnectDevice(conn.type)}
                  >
                    <Unlink className="w-3 h-3 mr-1" />
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs"
                  onClick={() => handleConnect(conn.type)}
                  disabled={isLoading || connectingDevice === conn.type}
                >
                  {connectingDevice === conn.type ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Link className="w-3 h-3 mr-1" />
                  )}
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Note about web limitations */}
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-700">
            <strong>Note:</strong> Full wearable integration requires the mobile app. 
            Web preview shows simulated data for demonstration.
          </p>
        </div>
      </Card>

      {/* Data Display */}
      {data && (
        <Card className="p-5 bg-gradient-card border-0 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Today's Health Data
            </h4>
            {data.lastSyncedAt && (
              <span className="text-xs text-muted-foreground">
                {format(new Date(data.lastSyncedAt), 'h:mm a')}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Heart Rate */}
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="w-4 h-4 text-red-500" />
                <span className="text-xs text-muted-foreground">Heart Rate</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-red-600">{data.heartRate || '--'}</span>
                <span className="text-xs text-muted-foreground">bpm</span>
              </div>
              {data.heartRateVariability && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  HRV: {data.heartRateVariability}ms
                </p>
              )}
            </div>

            {/* Steps */}
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-2 mb-1">
                <Footprints className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Steps</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-blue-600">
                  {data.steps?.toLocaleString() || '--'}
                </span>
              </div>
              {data.activeMinutes && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {data.activeMinutes} active min
                </p>
              )}
            </div>

            {/* Sleep */}
            {data.sleepHours !== undefined && (
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
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-100">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Calories</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-orange-600">
                  {data.caloriesBurned?.toLocaleString() || '--'}
                </span>
                <span className="text-xs text-muted-foreground">kcal</span>
              </div>
            </div>
          </div>

          {data.source === 'simulated' && (
            <p className="text-[10px] text-center text-muted-foreground mt-3">
              Demo data - Connect a device for real metrics
            </p>
          )}
        </Card>
      )}
    </div>
  );
};
