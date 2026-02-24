import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, AlertTriangle, Activity, TrendingUp, FileDown, 
  ChevronRight, Pill, Clock, BarChart3, Loader2, RefreshCw,
  Download, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ADRTimeline } from './ADRTimeline';
import { RiskScoreGauge } from './RiskScoreGauge';

interface ADRSignal {
  id: string;
  medication: string;
  symptom: string;
  confidence: number;
  lift: number;
  occurrences: number;
  totalExposures: number;
  avgOnsetHours: number;
  severityBreakdown: { mild: number; moderate: number; severe: number };
  temporalPattern: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  e2bNarrananess: string;
  meddraCode?: string;
  firstDetected: string;
  lastOccurred: string;
}

interface PredictiveRisk {
  overallScore: number;
  factors: { name: string; contribution: number; direction: 'increases' | 'decreases' }[];
  predictedTimeframe: string;
  recommendations: string[];
}

interface PharmacovigilanceData {
  adrSignals: ADRSignal[];
  predictiveRisk: PredictiveRisk;
  timelineEvents: any[];
  e2bReports: any[];
  summary: {
    totalMedications: number;
    totalADRSignals: number;
    criticalSignals: number;
    highSignals: number;
    reportableEvents: number;
    riskScore: number;
  };
}

const RISK_COLORS = {
  critical: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-500' },
  high: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', text: 'text-orange-600 dark:text-orange-400', badge: 'bg-orange-500' },
  moderate: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400', badge: 'bg-yellow-500' },
  low: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-600 dark:text-green-400', badge: 'bg-green-500' },
};

interface PharmacovigilanceDashboardProps {
  userId: string;
}

export const PharmacovigilanceDashboard = ({ userId }: PharmacovigilanceDashboardProps) => {
  const [data, setData] = useState<PharmacovigilanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('signals');
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('adr-detection', {
        body: { userId },
      });
      if (error) throw error;
      setData(result);
    } catch (err) {
      console.error('ADR detection error:', err);
      toast({ title: 'Could not load safety data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [userId]);

  const handleExportE2B = () => {
    if (!data?.e2bReports?.length) {
      toast({ title: 'No reportable events', description: 'No ADR signals meet the threshold for regulatory reporting.' });
      return;
    }
    const content = JSON.stringify(data.e2bReports, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `E2B-R3-ICSR-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'E2B(R3) Report exported', description: `${data.e2bReports.length} ICSR report(s) downloaded.` });
  };

  if (loading) {
    return (
      <Card className="p-8 flex items-center justify-center bg-gradient-card border-0">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Analyzing medication safety signals...</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Drug Safety Monitor
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Continuous pharmacovigilance • {data.summary.totalMedications} medication(s) tracked
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchData} className="h-8 w-8">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 bg-gradient-card border-0 text-center">
          <RiskScoreGauge score={data.predictiveRisk.overallScore} size="sm" />
          <p className="text-[10px] text-muted-foreground mt-1">Risk Score</p>
        </Card>
        <Card className="p-3 bg-gradient-card border-0 text-center">
          <p className="text-2xl font-bold">{data.summary.totalADRSignals}</p>
          <p className="text-[10px] text-muted-foreground">ADR Signals</p>
        </Card>
        <Card className="p-3 bg-gradient-card border-0 text-center">
          <p className="text-2xl font-bold">{data.summary.reportableEvents}</p>
          <p className="text-[10px] text-muted-foreground">Reportable</p>
        </Card>
      </div>

      {/* Critical Alerts */}
      {(data.summary.criticalSignals > 0 || data.summary.highSignals > 0) && (
        <Card className={cn("p-3 border", data.summary.criticalSignals > 0 ? "border-red-500/30 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5")}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", data.summary.criticalSignals > 0 ? "text-red-500" : "text-orange-500")} />
            <div>
              <p className="text-sm font-medium">
                {data.summary.criticalSignals > 0 ? `${data.summary.criticalSignals} Critical` : ''} 
                {data.summary.criticalSignals > 0 && data.summary.highSignals > 0 ? ' + ' : ''}
                {data.summary.highSignals > 0 ? `${data.summary.highSignals} High-Risk` : ''} Signal(s) Detected
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Discuss these medication-symptom associations with your doctor.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 h-9">
          <TabsTrigger value="signals" className="text-[11px] gap-1">
            <AlertTriangle className="w-3 h-3" /> Signals
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-[11px] gap-1">
            <Activity className="w-3 h-3" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-[11px] gap-1">
            <TrendingUp className="w-3 h-3" /> Risk
          </TabsTrigger>
          <TabsTrigger value="report" className="text-[11px] gap-1">
            <FileDown className="w-3 h-3" /> E2B
          </TabsTrigger>
        </TabsList>

        {/* ADR Signals Tab */}
        <TabsContent value="signals" className="mt-3 space-y-2">
          {data.adrSignals.length === 0 ? (
            <Card className="p-6 text-center bg-gradient-card border-0">
              <Shield className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <p className="text-sm font-medium">No ADR Signals Detected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Continue logging medications and symptoms — the engine monitors for patterns automatically.
              </p>
            </Card>
          ) : (
            data.adrSignals.map(signal => {
              const colors = RISK_COLORS[signal.riskLevel];
              return (
                <Card key={signal.id} className={cn("p-3 border", colors.border, colors.bg)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Pill className={cn("w-4 h-4", colors.text)} />
                      <div>
                        <p className="text-sm font-semibold">{signal.medication}</p>
                        <p className="text-xs text-muted-foreground">→ {signal.symptom}</p>
                      </div>
                    </div>
                    <Badge className={cn("text-[10px] text-white", colors.badge)}>
                      {signal.riskLevel.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold">{Math.round(signal.confidence * 100)}%</p>
                      <p className="text-[9px] text-muted-foreground">Co-occurrence</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{signal.lift}×</p>
                      <p className="text-[9px] text-muted-foreground">Likelihood</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{signal.occurrences}/{signal.totalExposures}</p>
                      <p className="text-[9px] text-muted-foreground">Exposures</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{signal.avgOnsetHours}h</p>
                      <p className="text-[9px] text-muted-foreground">Avg onset</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-current/10">
                    <span className="text-[10px] text-muted-foreground">
                      WHO-UMC: <strong>{signal.e2bNarrananess}</strong>
                    </span>
                    {signal.meddraCode && (
                      <span className="text-[10px] text-muted-foreground">
                        MedDRA: {signal.meddraCode}
                      </span>
                    )}
                    <Badge variant="outline" className="text-[9px] ml-auto">
                      {signal.temporalPattern}
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="mt-3">
          <ADRTimeline events={data.timelineEvents} adrSignals={data.adrSignals} />
        </TabsContent>

        {/* Predictive Risk Tab */}
        <TabsContent value="risk" className="mt-3 space-y-3">
          <Card className="p-4 bg-gradient-card border-0 text-center">
            <RiskScoreGauge score={data.predictiveRisk.overallScore} size="lg" />
            <p className="text-xs text-muted-foreground mt-2">
              Predicted risk over next {data.predictiveRisk.predictedTimeframe}
            </p>
          </Card>

          {/* Risk Factors */}
          <Card className="p-3 bg-gradient-card border-0 space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground">Contributing Factors</h4>
            {data.predictiveRisk.factors.map((factor, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/30 last:border-0">
                {factor.direction === 'increases' ? (
                  <ArrowUpRight className="w-3.5 h-3.5 text-red-500 shrink-0" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5 text-green-500 shrink-0" />
                )}
                <span className="text-xs flex-1">{factor.name}</span>
                <span className={cn(
                  "text-xs font-semibold",
                  factor.direction === 'increases' ? 'text-red-500' : 'text-green-500'
                )}>
                  {factor.direction === 'increases' ? '+' : '-'}{factor.contribution}
                </span>
              </div>
            ))}
          </Card>

          {/* Recommendations */}
          {data.predictiveRisk.recommendations.length > 0 && (
            <Card className="p-3 bg-gradient-card border-0 space-y-2">
              <h4 className="text-xs font-medium text-muted-foreground">Recommendations</h4>
              {data.predictiveRisk.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 py-1">
                  <ChevronRight className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs">{rec}</p>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        {/* E2B Report Tab */}
        <TabsContent value="report" className="mt-3 space-y-3">
          <Card className="p-4 bg-gradient-card border-0 text-center space-y-3">
            <Shield className="w-10 h-10 text-primary mx-auto" />
            <div>
              <h4 className="text-sm font-semibold">E2B(R3) ICSR Reports</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Individual Case Safety Reports auto-generated from your medication-symptom data.
                Compatible with FDA MedWatch, EMA EudraVigilance, and WHO VigiBase.
              </p>
            </div>
            <Badge variant="secondary" className="text-[10px]">
              {data.e2bReports.length} report(s) ready
            </Badge>
          </Card>

          {data.e2bReports.length > 0 ? (
            <>
              {data.e2bReports.map((report: any, i: number) => (
                <Card key={i} className="p-3 bg-gradient-card border-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-xs font-semibold">{report.drug.drugName} → {report.reaction.reactionMedDRATerm}</p>
                      <p className="text-[10px] text-muted-foreground">{report.safetyReportId}</p>
                    </div>
                    <Badge variant="outline" className={cn(
                      "text-[9px]",
                      report.causality.result === 'Certain' || report.causality.result === 'Probable' ? 'border-red-500/50 text-red-500' : 'border-yellow-500/50 text-yellow-500'
                    )}>
                      {report.causality.result}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">
                    {report.narrative}
                  </p>
                </Card>
              ))}

              <Button onClick={handleExportE2B} className="w-full" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export All E2B(R3) Reports
              </Button>
            </>
          ) : (
            <Card className="p-4 bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">
                No medication-symptom associations meet the regulatory reporting threshold yet.
                Continue logging for more accurate detection.
              </p>
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground text-center px-4">
            ⚕️ These reports are generated from patient-reported data and should be reviewed by a healthcare professional before submission to regulatory authorities.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
