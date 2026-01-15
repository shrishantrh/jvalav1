import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Hospital, 
  Link2, 
  ExternalLink,
  Shield,
  FileText,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface EHRConnection {
  id: string;
  provider_id: string;
  status: string;
  last_sync_at: string | null;
  metadata: Record<string, any>;
}

interface FhirData {
  conditions: any[];
  medications: any[];
  allergies: any[];
  labs: any[];
  vitals: any[];
}

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId }: EHRIntegrationProps) => {
  const [connection, setConnection] = useState<EHRConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [fhirData, setFhirData] = useState<FhirData | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConnection();
  }, [userId]);

  const loadConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('ehr_connections')
        .select('*')
        .eq('user_id', userId)
        .eq('provider_id', '1uphealth')
        .maybeSingle();

      if (error) throw error;
      setConnection(data as EHRConnection | null);
      
      // If connected, load FHIR data
      if (data?.status === 'connected') {
        await loadFhirData();
      }
    } catch (err) {
      console.error('Failed to load EHR connection:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFhirData = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ehr-connect', {
        body: { action: 'get_fhir_data', userId, provider: '1uphealth' },
      });
      
      if (error) throw error;
      if (data?.resources) {
        setFhirData(data.resources);
      }
    } catch (err) {
      console.error('Failed to load FHIR data:', err);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ehr-connect', {
        body: { action: 'initiate_connection', userId, provider: '1uphealth' },
      });

      if (error) throw error;

      if (data?.status === 'connected' && data?.connect_url) {
        toast({
          title: "Connected to 1Up Health!",
          description: "Opening provider connection page...",
        });
        
        // Open the 1Up Health connect page in a new tab
        window.open(data.connect_url, '_blank');
        await loadConnection();
      } else {
        throw new Error(data?.message || 'Failed to connect');
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      toast({
        title: "Connection failed",
        description: err.message || "Please try again later",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('ehr-connect', {
        body: { action: 'sync_data', userId, provider: '1uphealth' },
      });

      if (error) throw error;

      toast({
        title: "Data synced!",
        description: `Imported ${data.records_synced} health records.`,
      });
      
      await loadConnection();
      await loadFhirData();
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({
        title: "Sync failed",
        description: err.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenProviderConnect = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('ehr-connect', {
        body: { action: 'get_connect_url', userId },
      });

      if (error) throw error;
      if (data?.connect_url) {
        window.open(data.connect_url, '_blank');
      }
    } catch (err) {
      console.error('Error getting connect URL:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await supabase.functions.invoke('ehr-connect', {
        body: { action: 'disconnect', userId, provider: '1uphealth' },
      });

      setConnection(null);
      setFhirData(null);
      toast({ title: "Disconnected from 1Up Health" });
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  const isConnected = connection?.status === 'connected';
  const totalRecords = fhirData ? 
    Object.values(fhirData).reduce((sum: number, arr: unknown) => sum + (Array.isArray(arr) ? arr.length : 0), 0) : 0;

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-24 bg-muted rounded" />
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
          {isConnected && (
            <Badge className="text-xs bg-severity-none/10 text-severity-none">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          Import your health records via 1Up Health
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Privacy Notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium">Your data stays private</p>
            <p className="text-muted-foreground">
              Records are encrypted. Only you can access them.
            </p>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected ? (
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔗</span>
              <div>
                <p className="font-medium text-sm">1Up Health</p>
                <p className="text-xs text-muted-foreground">
                  Connect to 300+ health systems
                </p>
              </div>
            </div>
            
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect Health Records
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Connected Provider */}
            <div className="p-4 rounded-lg border bg-severity-none/5 border-severity-none/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <p className="font-medium text-sm">1Up Health</p>
                    {connection?.last_sync_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Last synced: {new Date(connection.last_sync_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenProviderConnect}
                  className="flex-1 text-xs"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Add Providers
                </Button>
                <Button
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex-1 text-xs"
                >
                  {syncing ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3 mr-1" />
                  )}
                  Sync Data
                </Button>
              </div>
            </div>

            {/* Imported Data Summary */}
            {totalRecords > 0 && (
              <div className="p-3 rounded-lg bg-muted/50">
                <h4 className="text-xs font-medium flex items-center gap-2 mb-2">
                  <FileText className="w-3 h-3" />
                  Imported Records ({totalRecords})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {fhirData?.conditions?.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Conditions:</span>{' '}
                      <span className="font-medium">{fhirData.conditions.length}</span>
                    </div>
                  )}
                  {fhirData?.medications?.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Medications:</span>{' '}
                      <span className="font-medium">{fhirData.medications.length}</span>
                    </div>
                  )}
                  {fhirData?.allergies?.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Allergies:</span>{' '}
                      <span className="font-medium">{fhirData.allergies.length}</span>
                    </div>
                  )}
                  {fhirData?.labs?.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Lab Results:</span>{' '}
                      <span className="font-medium">{fhirData.labs.length}</span>
                    </div>
                  )}
                  {fhirData?.vitals?.length > 0 && (
                    <div className="text-xs">
                      <span className="text-muted-foreground">Vitals:</span>{' '}
                      <span className="font-medium">{fhirData.vitals.length}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {totalRecords === 0 && connection?.last_sync_at && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                No records found. Click "Add Providers" to connect your health systems.
              </div>
            )}

            {/* Disconnect */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="w-full text-xs text-muted-foreground"
            >
              Disconnect
            </Button>
          </div>
        )}

        {/* What gets imported */}
        <div className="pt-3 border-t space-y-2">
          <h4 className="text-xs font-medium">What gets imported:</h4>
          <div className="flex flex-wrap gap-1">
            {['Diagnoses', 'Medications', 'Lab Results', 'Allergies', 'Vitals'].map(item => (
              <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
