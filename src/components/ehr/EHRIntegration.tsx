import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { 
  Hospital, 
  Link2, 
  Check, 
  ChevronRight, 
  ExternalLink,
  AlertCircle,
  Shield,
  FileText,
  Loader2,
  RefreshCw,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface EHRProvider {
  id: string;
  name: string;
  type: 'fhir' | 'proprietary';
  available: boolean;
  setupRequired: boolean;
  dataTypes: string[];
  notes: string;
  icon: string;
  priority: number;
}

interface EHRConnection {
  id: string;
  provider_id: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  last_sync_at: string | null;
  metadata: Record<string, any>;
}

const EHR_PROVIDERS: EHRProvider[] = [
  {
    id: 'apple_health_records',
    name: 'Apple Health Records',
    type: 'fhir',
    available: true,
    setupRequired: false,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'immunizations'],
    notes: 'Free. User-initiated. 700+ hospitals. Data syncs to HealthKit.',
    icon: '🍎',
    priority: 1,
  },
  {
    id: '1uphealth',
    name: '1Up Health',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'labs', 'claims', 'vitals'],
    notes: 'FHIR aggregator. Connect to 300+ EHRs. Free tier available.',
    icon: '🔗',
    priority: 2,
  },
  {
    id: 'epic',
    name: 'Epic MyChart',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals', 'encounters'],
    notes: 'Largest EHR. SMART on FHIR OAuth.',
    icon: '🏥',
    priority: 3,
  },
  {
    id: 'cerner',
    name: 'Oracle Cerner',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['conditions', 'medications', 'allergies', 'labs', 'vitals'],
    notes: 'Second largest EHR. SMART on FHIR OAuth.',
    icon: '🏨',
    priority: 4,
  },
  {
    id: 'bwell',
    name: 'b.well Connected Health',
    type: 'proprietary',
    available: true,
    setupRequired: true,
    dataTypes: ['unified_health_record', 'claims', 'clinical', 'devices'],
    notes: 'Unified API for 300+ health plans. CMS-aligned.',
    icon: '💊',
    priority: 5,
  },
  {
    id: 'healthex',
    name: 'HealthEx',
    type: 'fhir',
    available: true,
    setupRequired: true,
    dataTypes: ['patient_records', 'consent_management', 'data_sharing'],
    notes: 'TEFCA QHIN certified. Patient-driven consent.',
    icon: '🔒',
    priority: 6,
  },
];

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId }: EHRIntegrationProps) => {
  const [providers] = useState<EHRProvider[]>(EHR_PROVIDERS);
  const [connections, setConnections] = useState<EHRConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConnections();
  }, [userId]);

  const loadConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('ehr_connections')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      setConnections((data as EHRConnection[]) || []);
    } catch (err) {
      console.error('Failed to load EHR connections:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (providerId: string) => {
    setConnecting(providerId);
    
    try {
      const provider = providers.find(p => p.id === providerId);
      
      if (provider?.id === 'apple_health_records') {
        // Apple Health Records - show instructions
        toast({
          title: "Apple Health Records",
          description: "Open the Health app on your iPhone → Profile → Health Records → Get Started",
        });
        
        // Mark as "connecting" in our system
        await supabase
          .from('ehr_connections')
          .upsert({
            user_id: userId,
            provider_id: providerId,
            status: 'connecting',
            metadata: { initiated_at: new Date().toISOString() },
          }, { onConflict: 'user_id,provider_id' });
        
        await loadConnections();
      } else {
        // For other providers, call edge function to get setup info
        const { data, error } = await supabase.functions.invoke('ehr-connect', {
          body: { action: 'initiate_connection', userId, provider: providerId },
        });

        if (error) throw error;

        // Save pending connection
        await supabase
          .from('ehr_connections')
          .upsert({
            user_id: userId,
            provider_id: providerId,
            status: 'connecting',
            metadata: { setup_info: data },
          }, { onConflict: 'user_id,provider_id' });

        toast({
          title: `Connecting to ${provider?.name}`,
          description: data?.message || "Setup initiated. Follow the provider's instructions.",
        });

        await loadConnections();
      }
    } catch (err) {
      console.error('Connection error:', err);
      toast({
        title: "Connection failed",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    try {
      await supabase
        .from('ehr_connections')
        .delete()
        .eq('user_id', userId)
        .eq('provider_id', providerId);

      await loadConnections();
      toast({ title: "Disconnected" });
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const getConnectionStatus = (providerId: string): EHRConnection | undefined => {
    return connections.find(c => c.provider_id === providerId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'text-severity-none bg-severity-none/10';
      case 'connecting': return 'text-yellow-500 bg-yellow-500/10';
      case 'error': return 'text-severity-severe bg-severity-severe/10';
      default: return 'text-muted-foreground bg-muted';
    }
  };

  const connectedCount = connections.filter(c => c.status === 'connected').length;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-32 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Medical Records</CardTitle>
          </div>
          {connectedCount > 0 && (
            <Badge className="text-xs bg-severity-none/10 text-severity-none">
              {connectedCount} connected
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Import your health records for complete insights
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Quick Info */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium">Your data stays private</p>
            <p className="text-muted-foreground">
              Records are encrypted and only you can access them.
            </p>
          </div>
        </div>

        {/* Provider List */}
        <div className="space-y-2">
          {providers.sort((a, b) => a.priority - b.priority).map((provider) => {
            const connection = getConnectionStatus(provider.id);
            const isConnected = connection?.status === 'connected';
            const isConnecting = connection?.status === 'connecting' || connecting === provider.id;

            return (
              <div
                key={provider.id}
                className={cn(
                  "p-3 rounded-lg border transition-all",
                  isConnected ? "bg-severity-none/5 border-severity-none/30" : "bg-card hover:bg-muted/50"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{provider.name}</span>
                        {!provider.setupRequired && (
                          <Badge variant="secondary" className="text-[9px]">Easy</Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {provider.dataTypes.slice(0, 3).join(', ')}
                        {provider.dataTypes.length > 3 && ` +${provider.dataTypes.length - 3}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connection && (
                      <Badge className={cn("text-[10px] capitalize", getStatusColor(connection.status))}>
                        {connection.status}
                      </Badge>
                    )}
                    
                    {isConnected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handleDisconnect(provider.id)}
                      >
                        Disconnect
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="text-xs h-8 gap-1"
                        disabled={isConnecting}
                        onClick={() => handleConnect(provider.id)}
                      >
                        {isConnecting ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Link2 className="w-3 h-3" />
                        )}
                        Connect
                      </Button>
                    )}
                  </div>
                </div>

                {/* Connection details */}
                {connection?.last_sync_at && (
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2 text-[10px] text-muted-foreground">
                    <RefreshCw className="w-3 h-3" />
                    Last synced: {new Date(connection.last_sync_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* What you get */}
        <div className="pt-3 border-t space-y-2">
          <h4 className="text-xs font-medium flex items-center gap-2">
            <FileText className="w-3 h-3" />
            What gets imported:
          </h4>
          <div className="flex flex-wrap gap-1">
            {['Diagnoses', 'Medications', 'Lab Results', 'Allergies', 'Vitals', 'Immunizations'].map(item => (
              <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Your doctor visits and test results help the AI understand your full health picture.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
