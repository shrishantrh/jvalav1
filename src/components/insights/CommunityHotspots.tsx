import { useMemo, useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlareEntry } from "@/types/flare";
import { MapPin, Users, AlertTriangle, Info, Shield, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

interface CommunityHotspotsProps {
  entries: FlareEntry[];
  userConditions?: string[];
}

interface Hotspot {
  city: string;
  report_count: number;
  avg_severity: number;
  top_symptom: string | null;
  recent_count: number;
  monthly_count: number;
  topSymptoms?: string[];
  topTriggers?: string[];
}

export const CommunityHotspots = ({ entries, userConditions = [] }: CommunityHotspotsProps) => {
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReports, setTotalReports] = useState(0);

  // Fetch real anonymized community data
  useEffect(() => {
    const fetchHotspots = async () => {
      setLoading(true);
      try {
        // Fetch from the anonymized view
        const { data, error } = await supabase
          .from('community_hotspots')
          .select('*')
          .order('report_count', { ascending: false })
          .limit(10);

        if (error) {
          console.error('Error fetching hotspots:', error);
          setHotspots([]);
        } else if (data && data.length > 0) {
          // Fetch top symptoms and triggers for each city
          const hotspotsWithDetails = await Promise.all(
            data.map(async (hotspot) => {
              const [symptomsResult, triggersResult] = await Promise.all([
                supabase.rpc('get_city_symptom_stats', { city_name: hotspot.city }),
                supabase.rpc('get_city_trigger_stats', { city_name: hotspot.city })
              ]);

              return {
                ...hotspot,
                topSymptoms: symptomsResult.data?.map((s: any) => s.symptom) || [],
                topTriggers: triggersResult.data?.map((t: any) => t.trigger) || []
              };
            })
          );

          setHotspots(hotspotsWithDetails);
          setTotalReports(data.reduce((sum, h) => sum + (h.report_count || 0), 0));
        } else {
          setHotspots([]);
        }
      } catch (err) {
        console.error('Hotspots fetch error:', err);
        setHotspots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchHotspots();
  }, []);

  // Calculate user's own location patterns
  const userLocationData = useMemo(() => {
    const locationCounts: Record<string, { count: number; severities: number[] }> = {};
    
    entries.forEach(e => {
      const city = e.environmentalData?.location?.city || (e as any).city;
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

  const getActivityBadge = (hotspot: Hotspot) => {
    const recentRatio = hotspot.monthly_count > 0 ? hotspot.recent_count / hotspot.monthly_count : 0;
    if (recentRatio > 0.5) {
      return <Badge variant="destructive" className="text-[10px]">High activity</Badge>;
    } else if (recentRatio > 0.2) {
      return <Badge variant="secondary" className="text-[10px]">Moderate</Badge>;
    }
    return <Badge variant="outline" className="text-[10px]">Low</Badge>;
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
              Hotspots are calculated from aggregated data only. Location data is 
              city-level and requires minimum 3 reports per area before displaying. 
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
          Areas with elevated flare activity from the community
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : hotspots.length > 0 ? (
          <div className="space-y-3">
            {hotspots.map((hotspot, idx) => (
              <div 
                key={idx} 
                className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{hotspot.city}</p>
                    <p className="text-xs text-muted-foreground">
                      Avg severity: <span className={getSeverityColor(Number(hotspot.avg_severity))}>
                        {Number(hotspot.avg_severity).toFixed(1)}/3
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {getActivityBadge(hotspot)}
                    <span className="text-xs text-muted-foreground">
                      {hotspot.report_count} reports
                    </span>
                  </div>
                </div>
                
                {hotspot.topSymptoms && hotspot.topSymptoms.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {hotspot.topSymptoms.slice(0, 3).map((symptom, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                )}

                {hotspot.topTriggers && hotspot.topTriggers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hotspot.topTriggers.slice(0, 2).map((trigger, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Not enough community data yet</p>
            <p className="text-xs mt-1">Keep logging to help build community insights!</p>
          </div>
        )}

        {totalReports > 0 && (
          <div className="mt-4 pt-3 border-t text-center">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Info className="w-3 h-3" />
              Data from {totalReports.toLocaleString()} anonymous reports
            </p>
          </div>
        )}
      </Card>

      {/* Travel Warning */}
      {userConditions.length > 0 && hotspots.length > 0 && (
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