import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { MapPin, Thermometer, Droplets, Wind, Sun, CloudRain, CloudSnow, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserFlareMapProps {
  entries: FlareEntry[];
}

export const UserFlareMap = ({ entries }: UserFlareMapProps) => {
  const locatedEntries = useMemo(() => {
    return entries.filter(e => 
      e.environmentalData?.location?.latitude && 
      e.environmentalData?.location?.longitude
    ).slice(0, 50); // Limit to 50 most recent
  }, [entries]);

  const locationStats = useMemo(() => {
    const cityMap: Record<string, { count: number; severities: string[]; weather: any[] }> = {};
    
    locatedEntries.forEach(entry => {
      const city = entry.environmentalData?.location?.city || 'Unknown';
      if (!cityMap[city]) {
        cityMap[city] = { count: 0, severities: [], weather: [] };
      }
      cityMap[city].count++;
      if (entry.severity) cityMap[city].severities.push(entry.severity);
      if (entry.environmentalData?.weather) {
        cityMap[city].weather.push(entry.environmentalData.weather);
      }
    });

    return Object.entries(cityMap)
      .map(([city, data]) => {
        const severeCount = data.severities.filter(s => s === 'severe').length;
        const dominantSeverity = severeCount > data.count / 3 ? 'severe' 
          : data.severities.filter(s => s === 'moderate').length > data.count / 3 ? 'moderate' 
          : 'mild';
        
        const avgTemp = data.weather.length > 0
          ? Math.round(data.weather.reduce((sum, w) => sum + (w.temperature || 0), 0) / data.weather.length)
          : null;

        return { city, ...data, dominantSeverity, avgTemp };
      })
      .sort((a, b) => b.count - a.count);
  }, [locatedEntries]);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-severity-severe';
      case 'moderate': return 'bg-severity-moderate';
      case 'mild': return 'bg-severity-mild';
      default: return 'bg-primary';
    }
  };

  const getSeverityGlow = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'shadow-[0_0_12px_hsl(var(--severity-severe)/0.5)]';
      case 'moderate': return 'shadow-[0_0_12px_hsl(var(--severity-moderate)/0.5)]';
      case 'mild': return 'shadow-[0_0_12px_hsl(var(--severity-mild)/0.5)]';
      default: return '';
    }
  };

  const getWeatherIcon = (condition?: string) => {
    if (!condition) return null;
    const lower = condition.toLowerCase();
    if (lower.includes('rain') || lower.includes('drizzle')) return CloudRain;
    if (lower.includes('snow') || lower.includes('sleet')) return CloudSnow;
    if (lower.includes('cloud') || lower.includes('overcast')) return Cloud;
    if (lower.includes('sun') || lower.includes('clear')) return Sun;
    return Cloud;
  };

  if (locatedEntries.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-card via-card to-muted/30 border-0 shadow-lg overflow-hidden">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <MapPin className="w-8 h-8 text-primary/60" />
          </div>
          <h3 className="text-base font-semibold mb-2">No Location Data Yet</h3>
          <p className="text-sm text-muted-foreground">
            Enable location when logging to see your flare map and location-based patterns
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Interactive Map Visualization */}
      <Card className="bg-gradient-to-br from-card via-card to-primary/5 border-0 shadow-xl overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            Your Flare Locations
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {locatedEntries.length} logged location{locatedEntries.length !== 1 ? 's' : ''} • Tap locations for details
          </p>
        </CardHeader>
        <CardContent className="pt-2">
          {/* Stylized Map Area */}
          <div className="relative h-52 rounded-xl bg-gradient-to-br from-blue-50/50 via-green-50/30 to-purple-50/30 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 overflow-hidden border border-border/50">
            {/* Grid overlay */}
            <div className="absolute inset-0">
              {Array.from({ length: 8 }).map((_, i) => (
                <div 
                  key={`v${i}`} 
                  className="absolute w-px h-full bg-border/20" 
                  style={{ left: `${(i + 1) * 12.5}%` }} 
                />
              ))}
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={`h${i}`} 
                  className="absolute h-px w-full bg-border/20" 
                  style={{ top: `${(i + 1) * 16.67}%` }} 
                />
              ))}
            </div>

            {/* Flare points plotted based on relative positions */}
            {locatedEntries.map((entry, idx) => {
              // Create a deterministic position based on lat/lng
              const lat = entry.environmentalData?.location?.latitude || 0;
              const lng = entry.environmentalData?.location?.longitude || 0;
              const x = ((lng + 180) % 360) / 360 * 80 + 10;
              const y = ((90 - lat) % 180) / 180 * 70 + 15;
              
              return (
                <div
                  key={entry.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group cursor-pointer z-10"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {/* Glow effect */}
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-full blur-md opacity-50 scale-150",
                      getSeverityColor(entry.severity)
                    )} 
                  />
                  {/* Main dot */}
                  <div 
                    className={cn(
                      "relative w-3 h-3 rounded-full border-2 border-white/80 transition-transform group-hover:scale-150",
                      getSeverityColor(entry.severity),
                      getSeverityGlow(entry.severity)
                    )}
                  />
                  {/* Hover tooltip */}
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-20">
                    <div className="bg-popover border rounded-lg shadow-xl px-3 py-2 whitespace-nowrap">
                      <p className="text-xs font-semibold capitalize">{entry.severity} flare</p>
                      <p className="text-[10px] text-muted-foreground">
                        📍 {entry.environmentalData?.location?.city || 'Unknown'}
                      </p>
                      {entry.environmentalData?.weather?.temperature && (
                        <p className="text-[10px] text-muted-foreground">
                          🌡️ {entry.environmentalData.weather.temperature}°F
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Decorative elements */}
            <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground/50">
              Interactive Map View
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center mt-3 gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-severity-mild shadow-sm" />
              <span className="text-muted-foreground">Mild</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-severity-moderate shadow-sm" />
              <span className="text-muted-foreground">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-severity-severe shadow-sm" />
              <span className="text-muted-foreground">Severe</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location Breakdown */}
      {locationStats.length > 0 && (
        <Card className="bg-gradient-to-br from-card to-muted/20 border-0 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-primary" />
              Location Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {locationStats.slice(0, 5).map((loc) => {
              const WeatherIcon = loc.weather[0]?.condition 
                ? getWeatherIcon(loc.weather[0].condition) 
                : null;
              
              return (
                <div 
                  key={loc.city}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-2.5 h-2.5 rounded-full",
                      getSeverityColor(loc.dominantSeverity)
                    )} />
                    <div>
                      <p className="text-sm font-medium">{loc.city}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {loc.count} flare{loc.count !== 1 ? 's' : ''} logged
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {loc.avgTemp !== null && (
                      <span className="flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {loc.avgTemp}°
                      </span>
                    )}
                    {WeatherIcon && <WeatherIcon className="w-3.5 h-3.5" />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
