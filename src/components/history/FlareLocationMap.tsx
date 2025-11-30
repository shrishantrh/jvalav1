import { useEffect, useMemo, useRef } from "react";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { MapPin } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface FlareLocationMapProps {
  entries: FlareEntry[];
}

export const FlareLocationMap = ({ entries }: FlareLocationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const locatedEntries = useMemo(() => {
    return entries.filter(e => 
      e.environmentalData?.location?.latitude && 
      e.environmentalData?.location?.longitude
    );
  }, [entries]);

  useEffect(() => {
    if (!mapRef.current || locatedEntries.length === 0) return;

    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    // Create map
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Custom marker icons based on severity
    const createMarkerIcon = (severity?: string) => {
      const color = severity === 'severe' ? '#FF4B4B' 
        : severity === 'moderate' ? '#FFA500' 
        : severity === 'mild' ? '#4ADE80'
        : '#8B5CF6';

      return L.divIcon({
        className: 'custom-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          "></div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
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
        <div style="font-family: system-ui; font-size: 13px; min-width: 150px;">
          <div style="font-weight: 600; margin-bottom: 4px;">
            ${entry.type === 'flare' ? '🔥' : '📝'} ${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
          </div>
          ${entry.severity ? `<div style="color: #666;">Severity: ${entry.severity}</div>` : ''}
          ${entry.environmentalData?.location?.city ? `<div style="color: #666;">📍 ${entry.environmentalData.location.city}</div>` : ''}
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

  if (locatedEntries.length === 0) {
    return (
      <Card className="p-6 text-center bg-muted/30">
        <MapPin className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No location data available yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Enable location when logging to see your flare map
        </p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <h3 className="font-clinical text-sm">Flare Locations</h3>
          <span className="text-xs text-muted-foreground">
            {locatedEntries.length} logged location{locatedEntries.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      <div ref={mapRef} className="h-[200px] w-full" />
      
      {/* Legend */}
      <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-mild" />
          <span className="text-muted-foreground">Mild</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-moderate" />
          <span className="text-muted-foreground">Moderate</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-severity-severe" />
          <span className="text-muted-foreground">Severe</span>
        </div>
      </div>
    </Card>
  );
};
