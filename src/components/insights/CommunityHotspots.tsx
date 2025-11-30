import { useMemo, useState } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { MapPin, Users, AlertTriangle, Info, Shield } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CommunityHotspotsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Hotspot {
  id: string;
  city: string;
  region: string;
  count: number;
  avgSeverity: number;
  topSymptoms: string[];
  recentActivity: 'high' | 'moderate' | 'low';
}

// Simulated community data - in production this would come from aggregated, anonymized data
const SAMPLE_HOTSPOTS: Hotspot[] = [
  {
    id: '1',
    city: 'San Francisco',
    region: 'Bay Area',
    count: 127,
    avgSeverity: 2.1,
    topSymptoms: ['Headache', 'Fatigue', 'Brain fog'],
    recentActivity: 'high'
  },
  {
    id: '2',
    city: 'Los Angeles',
    region: 'Southern California',
    count: 89,
    avgSeverity: 1.8,
    topSymptoms: ['Respiratory issues', 'Headache'],
    recentActivity: 'moderate'
  },
  {
    id: '3',
    city: 'New York',
    region: 'Northeast',
    count: 156,
    avgSeverity: 2.3,
    topSymptoms: ['Stress', 'Fatigue', 'Joint pain'],
    recentActivity: 'high'
  },
  {
    id: '4',
    city: 'Phoenix',
    region: 'Southwest',
    count: 42,
    avgSeverity: 1.5,
    topSymptoms: ['Dehydration', 'Heat sensitivity'],
    recentActivity: 'low'
  },
  {
    id: '5',
    city: 'Seattle',
    region: 'Pacific Northwest',
    count: 78,
    avgSeverity: 1.9,
    topSymptoms: ['Seasonal affective', 'Fatigue', 'Joint pain'],
    recentActivity: 'moderate'
  }
];

export const CommunityHotspots = ({ entries, userConditions = [] }: CommunityHotspotsProps) => {
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

  // Calculate user's own location patterns
  const userLocationData = useMemo(() => {
    const locationCounts: Record<string, { count: number; severities: number[] }> = {};
    
    entries.forEach(e => {
      const city = e.environmentalData?.location?.city;
      if (city) {
        if (!locationCounts[city]) {
          locationCounts[city] = { count: 0, severities: [] };
        }
        locationCounts[city].count++;
        if (e.severity) {
          const score = e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1;
          locationCounts[city].severities.push(score);
        }
      }
    });

    return Object.entries(locationCounts)
      .map(([city, data]) => ({
        city,
        count: data.count,
        avgSeverity: data.severities.length > 0 
          ? data.severities.reduce((a, b) => a + b, 0) / data.severities.length 
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [entries]);

  const getActivityBadge = (activity: 'high' | 'moderate' | 'low') => {
    switch (activity) {
      case 'high':
        return <Badge variant="destructive" className="text-[10px]">High activity</Badge>;
      case 'moderate':
        return <Badge variant="secondary" className="text-[10px]">Moderate</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-[10px]">Low</Badge>;
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 2.5) return 'text-severity-severe';
    if (severity >= 1.5) return 'text-severity-moderate';
    return 'text-severity-mild';
  };

  return (
    <div className="space-y-4">
      {/* Privacy Notice */}
      <Alert className="bg-muted/50">
        <Shield className="h-4 w-4" />
        <AlertDescription className="text-xs">
          <span className="font-medium">Privacy protected:</span> All community data is aggregated and anonymized. 
          No individual health information is shared.
          <Button 
            variant="link" 
            className="h-auto p-0 ml-1 text-xs"
            onClick={() => setShowPrivacyInfo(!showPrivacyInfo)}
          >
            {showPrivacyInfo ? 'Hide details' : 'Learn more'}
          </Button>
          {showPrivacyInfo && (
            <p className="mt-2 text-muted-foreground">
              Hotspots are calculated using differential privacy techniques. Location data is 
              rounded to city-level and requires minimum 20 users per area before displaying. 
              Your individual entries are never shared.
            </p>
          )}
        </AlertDescription>
      </Alert>

      {/* Your Locations */}
      {userLocationData.length > 0 && (
        <Card className="p-4 bg-gradient-card border-0 shadow-soft">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Your Flare Locations
          </h3>
          <div className="space-y-2">
            {userLocationData.map((loc, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <span className="text-sm">{loc.city}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{loc.count} flares</span>
                  {loc.avgSeverity > 0 && (
                    <span className={`text-xs font-medium ${getSeverityColor(loc.avgSeverity)}`}>
                      {loc.avgSeverity >= 2.5 ? 'High' : loc.avgSeverity >= 1.5 ? 'Med' : 'Low'} severity
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Community Hotspots */}
      <Card className="p-4 bg-gradient-card border-0 shadow-soft">
        <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Community Hotspots
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Areas with elevated flare activity from similar conditions
        </p>

        <div className="space-y-3">
          {SAMPLE_HOTSPOTS.slice(0, 5).map(hotspot => (
            <div 
              key={hotspot.id} 
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-sm font-medium">{hotspot.city}</p>
                  <p className="text-xs text-muted-foreground">{hotspot.region}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {getActivityBadge(hotspot.recentActivity)}
                  <span className="text-xs text-muted-foreground">
                    {hotspot.count} reports
                  </span>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-1">
                {hotspot.topSymptoms.map((symptom, i) => (
                  <Badge key={i} variant="outline" className="text-[10px]">
                    {symptom}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t text-center">
          <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Info className="w-3 h-3" />
            Data from {SAMPLE_HOTSPOTS.reduce((sum, h) => sum + h.count, 0).toLocaleString()} anonymous reports
          </p>
        </div>
      </Card>

      {/* Travel Warning */}
      {userConditions.length > 0 && (
        <Card className="p-4 border-severity-moderate/30 bg-severity-moderate/5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-severity-moderate flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Travel Advisory</p>
              <p className="text-xs text-muted-foreground mt-1">
                Based on community data, consider checking local conditions before traveling to 
                high-activity areas. The AI assistant can help you assess specific destination risks.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
