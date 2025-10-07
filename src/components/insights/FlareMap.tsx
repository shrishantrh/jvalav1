import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Users, Activity } from 'lucide-react';

interface FlareLocation {
  id: string;
  latitude: number;
  longitude: number;
  severity: 'mild' | 'moderate' | 'severe';
  timestamp: Date;
  city: string;
}

export const FlareMap = () => {
  const [flareLocations, setFlareLocations] = useState<FlareLocation[]>([]);

  useEffect(() => {
    // Simulate anonymous flare data from other users
    const generateMockFlareData = () => {
      const cities = [
        { name: 'New York', lat: 40.7128, lng: -74.0060 },
        { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
        { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
        { name: 'Houston', lat: 29.7604, lng: -95.3698 },
        { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
        { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
        { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
        { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
        { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
        { name: 'San Jose', lat: 37.3382, lng: -121.8863 }
      ];

      const severities: ('mild' | 'moderate' | 'severe')[] = ['mild', 'moderate', 'severe'];

      return cities.map((city, index) => ({
        id: `flare-${index}`,
        latitude: city.lat + (Math.random() - 0.5) * 0.1, // Add some randomness
        longitude: city.lng + (Math.random() - 0.5) * 0.1,
        severity: severities[Math.floor(Math.random() * severities.length)],
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Last 7 days
        city: city.name
      }));
    };

    setFlareLocations(generateMockFlareData());
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return 'hsl(var(--severity-severe))';
      case 'moderate': return 'hsl(var(--severity-moderate))';
      case 'mild': return 'hsl(var(--severity-mild))';
      default: return 'hsl(var(--muted))';
    }
  };

  const severityCounts = flareLocations.reduce((acc, flare) => {
    acc[flare.severity] = (acc[flare.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Map Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center p-4">
            <Users className="h-8 w-8 text-primary mr-3" />
            <div>
              <p className="text-2xl font-bold">{flareLocations.length}</p>
              <p className="text-sm text-muted-foreground">Active Reports</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <Activity className="h-8 w-8 text-severity-severe mr-3" />
            <div>
              <p className="text-2xl font-bold">{severityCounts.severe || 0}</p>
              <p className="text-sm text-muted-foreground">Severe Flares</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-4">
            <MapPin className="h-8 w-8 text-accent mr-3" />
            <div>
              <p className="text-2xl font-bold">{new Set(flareLocations.map(f => f.city)).size}</p>
              <p className="text-sm text-muted-foreground">Cities Affected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simplified Map Visualization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Local Community Heatmap
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Anonymous symptom reports in your area (last 7 days)
          </p>
        </CardHeader>
        <CardContent>
          <div className="relative bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 dark:from-gray-800 dark:via-gray-850 dark:to-gray-900 rounded-lg h-80 overflow-hidden border-2 border-muted">
            {/* Local Area Map Background with Grid */}
            <div className="absolute inset-0">
              {/* Grid pattern for map-like appearance */}
              <div className="absolute inset-0 opacity-20">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={`v${i}`} className="absolute w-px bg-border h-full" style={{ left: `${i * 10}%` }} />
                ))}
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={`h${i}`} className="absolute h-px bg-border w-full" style={{ top: `${i * 12.5}%` }} />
                ))}
              </div>
              
              {/* Neighborhood areas */}
              <div className="absolute top-4 left-4 text-xs text-muted-foreground font-medium">Downtown</div>
              <div className="absolute top-4 right-4 text-xs text-muted-foreground font-medium">Riverside</div>
              <div className="absolute bottom-16 left-4 text-xs text-muted-foreground font-medium">University District</div>
              <div className="absolute bottom-16 right-4 text-xs text-muted-foreground font-medium">Oak Hills</div>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">City Center</div>
              
              {/* Major street indicators */}
              <div className="absolute top-1/3 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-30"></div>
              <div className="absolute bottom-1/3 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-border to-transparent opacity-30"></div>
              <div className="absolute top-0 bottom-0 left-1/3 w-1 bg-gradient-to-b from-transparent via-border to-transparent opacity-30"></div>
              <div className="absolute top-0 bottom-0 right-1/3 w-1 bg-gradient-to-b from-transparent via-border to-transparent opacity-30"></div>
            </div>
            
            {/* Generate local heat zones */}
            {Array.from({ length: 12 }).map((_, index) => {
              const x = 10 + (index % 4) * 20 + Math.random() * 15;
              const y = 15 + Math.floor(index / 4) * 25 + Math.random() * 15;
              const intensity = Math.random();
              const size = 20 + intensity * 40;
              
              return (
                <div
                  key={`heat-${index}`}
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    left: `${x}%`,
                    top: `${y}%`,
                    width: `${size}px`,
                    height: `${size}px`,
                    background: intensity > 0.7 
                      ? 'radial-gradient(circle, hsl(var(--severity-severe) / 0.4) 0%, hsl(var(--severity-severe) / 0.1) 50%, transparent 100%)'
                      : intensity > 0.4
                      ? 'radial-gradient(circle, hsl(var(--severity-moderate) / 0.4) 0%, hsl(var(--severity-moderate) / 0.1) 50%, transparent 100%)'
                      : 'radial-gradient(circle, hsl(var(--severity-mild) / 0.4) 0%, hsl(var(--severity-mild) / 0.1) 50%, transparent 100%)',
                    transform: 'translate(-50%, -50%)'
                  }}
                />
              );
            })}
            
            {/* Individual flare points */}
            {Array.from({ length: 20 }).map((_, index) => {
              const x = 5 + Math.random() * 90;
              const y = 5 + Math.random() * 85;
              const severity = ['mild', 'moderate', 'severe'][Math.floor(Math.random() * 3)];
              const timeAgo = Math.floor(Math.random() * 168); // hours ago
              
              return (
                <div
                  key={`point-${index}`}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div 
                    className={`w-2 h-2 rounded-full shadow-lg animate-pulse`}
                    style={{ 
                      backgroundColor: getSeverityColor(severity),
                      animation: `pulse 2s infinite ${Math.random() * 2}s`
                    }}
                  />
                  <div className="opacity-0 group-hover:opacity-100 absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-background border rounded-lg px-2 py-1 text-xs whitespace-nowrap z-10 shadow-lg transition-opacity">
                    <div className="font-medium capitalize">{severity} episode</div>
                    <div className="text-muted-foreground">{timeAgo}h ago</div>
                    <div className="text-muted-foreground text-[10px]">Anonymous report</div>
                  </div>
                </div>
              );
            })}
            
            {/* Your location indicator */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-4 h-4 rounded-full bg-primary border-2 border-background shadow-lg animate-bounce">
                <div className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75"></div>
              </div>
              <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                Your Location
              </div>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex items-center justify-center mt-4 space-x-4">
            {Object.entries(severityCounts).map(([severity, count]) => (
              <div key={severity} className="flex items-center space-x-1">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSeverityColor(severity) }}
                />
                <span className="text-sm capitalize">{severity} ({count})</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Community Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {flareLocations
              .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
              .slice(0, 5)
              .map((flare) => (
                <div key={flare.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getSeverityColor(flare.severity) }}
                    />
                    <span className="text-sm">{flare.city}</span>
                    <span className="text-xs text-muted-foreground capitalize">{flare.severity}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {flare.timestamp.toLocaleDateString()}
                  </span>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};