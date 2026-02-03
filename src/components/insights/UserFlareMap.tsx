import { useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { MapPin, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface UserFlareMapProps {
  entries: FlareEntry[];
}

export const UserFlareMap = ({ entries }: UserFlareMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const locatedEntries = useMemo(() => {
    return entries.filter(e => 
      e.environmentalData?.location?.latitude && 
      e.environmentalData?.location?.longitude
    ).slice(0, 50);
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

  // Initialize and update Leaflet map
  useEffect(() => {
    if (!mapRef.current || locatedEntries.length === 0) return;

    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // Add tile layer with a clean style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    // Custom marker icons based on severity
    const createMarkerIcon = (severity?: string) => {
      const color = severity === 'severe' ? '#ef4444' 
        : severity === 'moderate' ? '#f59e0b' 
        : severity === 'mild' ? '#22c55e'
        : 'hsl(var(--primary))';

      return L.divIcon({
        className: 'custom-flare-marker',
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    };

    // Add markers
    const bounds: L.LatLngTuple[] = [];
    
    locatedEntries.forEach(entry => {
      const lat = entry.environmentalData!.location!.latitude;
      const lng = entry.environmentalData!.location!.longitude;
      bounds.push([lat, lng]);

      const marker = L.marker([lat, lng], {
        icon: createMarkerIcon(entry.severity)
      }).addTo(map);

      // Popup content
      const popupContent = `
        <div style="font-family: system-ui; font-size: 13px; min-width: 140px;">
          <div style="font-weight: 600; margin-bottom: 4px; text-transform: capitalize;">
            ${entry.severity || 'Unknown'} flare
          </div>
          ${entry.environmentalData?.location?.city ? `<div style="color: #666;">📍 ${entry.environmentalData.location.city}</div>` : ''}
          ${entry.environmentalData?.weather?.temperature ? `<div style="color: #666;">🌡️ ${entry.environmentalData.weather.temperature}°F</div>` : ''}
          <div style="color: #999; font-size: 11px; margin-top: 4px;">
            ${new Date(entry.timestamp).toLocaleDateString()}
          </div>
        </div>
      `;
      
      marker.bindPopup(popupContent);
    });

    // Fit bounds
    if (bounds.length > 0) {
      if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      } else {
        map.fitBounds(bounds, { padding: [30, 30] });
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locatedEntries]);

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'severe': return 'bg-red-500';
      case 'moderate': return 'bg-amber-500';
      case 'mild': return 'bg-emerald-500';
      default: return 'bg-primary';
    }
  };

  if (locatedEntries.length === 0) {
    return (
      <div className={cn(
        "relative p-6 rounded-3xl overflow-hidden text-center",
        "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
        "border border-white/50 dark:border-slate-700/50",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <MapPin className="w-8 h-8 text-primary/60" />
        </div>
        <h3 className="text-base font-semibold mb-2">No Location Data Yet</h3>
        <p className="text-sm text-muted-foreground">
          Enable location when logging to see your flare map
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Map Card */}
      <div className={cn(
        "relative rounded-3xl overflow-hidden",
        "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
        "border border-white/50 dark:border-slate-700/50",
        "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      )}>
        <div className="p-4 border-b border-white/30 dark:border-slate-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <h3 className="font-semibold">Your Flare Locations</h3>
            </div>
            <span className="text-xs text-muted-foreground">
              {locatedEntries.length} location{locatedEntries.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        
        {/* Leaflet Map Container */}
        <div ref={mapRef} className="h-56 w-full" />
        
        {/* Legend */}
        <div className="px-4 py-3 border-t border-white/30 dark:border-slate-700/30 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
            <span className="text-muted-foreground">Mild</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
            <span className="text-muted-foreground">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
            <span className="text-muted-foreground">Severe</span>
          </div>
        </div>
      </div>

      {/* Location Breakdown */}
      {locationStats.length > 0 && (
        <div className={cn(
          "relative p-5 rounded-3xl overflow-hidden",
          "bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl",
          "border border-white/50 dark:border-slate-700/50",
          "shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Location Patterns</h3>
          </div>
          <div className="space-y-2">
            {locationStats.slice(0, 5).map((loc) => (
              <div 
                key={loc.city}
                className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full",
                    getSeverityColor(loc.dominantSeverity)
                  )} />
                  <div>
                    <p className="text-sm font-medium">{loc.city}</p>
                    <p className="text-xs text-muted-foreground">
                      {loc.count} flare{loc.count !== 1 ? 's' : ''} logged
                    </p>
                  </div>
                </div>
                {loc.avgTemp !== null && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Thermometer className="w-3 h-3" />
                    {loc.avgTemp}°
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};