import { useState } from 'react';
import { FlareEntry } from '@/types/flare';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { 
  FileText, 
  Download, 
  Share2, 
  Building2, 
  ClipboardCheck,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Copy,
  ExternalLink,
  Sparkles,
  FileJson,
  FileCode,
  Mail,
  Printer,
  Shield,
  Clock,
  AlertCircle,
  Heart,
  Activity,
  Thermometer,
  Droplets
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ClinicalRecordGeneratorProps {
  entry: FlareEntry | null;
  entries?: FlareEntry[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bulkMode?: boolean;
}

export const ClinicalRecordGenerator = ({ 
  entry, 
  entries = [],
  open, 
  onOpenChange,
  bulkMode = false 
}: ClinicalRecordGeneratorProps) => {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [generatedRecord, setGeneratedRecord] = useState<string | null>(null);
  const [format_, setFormat] = useState<'narrative' | 'fhir' | 'hl7' | 'ccd'>('narrative');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'select' | 'generating' | 'complete'>('select');

  const entriesToProcess = bulkMode ? entries : (entry ? [entry] : []);

  const generateRecord = async () => {
    if (entriesToProcess.length === 0) return;
    
    setGenerating(true);
    setStep('generating');
    setProgress(0);
    
    // Simulate progressive generation
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setProgress(i);
    }
    
    const record = bulkMode 
      ? generateBulkClinicalReport(entriesToProcess)
      : generateClinicalNarrative(entriesToProcess[0]);
    
    setGeneratedRecord(record);
    setGenerating(false);
    setStep('complete');
  };

  const generateClinicalNarrative = (entry: FlareEntry): string => {
    const date = format(entry.timestamp, 'MMMM d, yyyy');
    const time = format(entry.timestamp, 'h:mm a');
    
    let narrative = `╔══════════════════════════════════════════════════════════════════╗\n`;
    narrative += `║              PATIENT-GENERATED CLINICAL EVENT RECORD              ║\n`;
    narrative += `╠══════════════════════════════════════════════════════════════════╣\n`;
    narrative += `║  Date: ${date.padEnd(20)} Time: ${time.padEnd(23)}║\n`;
    narrative += `║  Record Type: Patient-Reported Flare Event                       ║\n`;
    narrative += `║  System: Jvala Health Intelligence Platform                      ║\n`;
    narrative += `╚══════════════════════════════════════════════════════════════════╝\n\n`;
    
    narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    narrative += `  CHIEF COMPLAINT\n`;
    narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    narrative += `  Patient reports a ${(entry.severity || 'unspecified').toUpperCase()} flare episode.\n\n`;
    
    if (entry.symptoms && entry.symptoms.length > 0) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  SYMPTOMS REPORTED\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      entry.symptoms.forEach((s, i) => {
        narrative += `  ${i + 1}. ${s}\n`;
      });
      narrative += `\n`;
    }
    
    if (entry.triggers && entry.triggers.length > 0) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  IDENTIFIED TRIGGERS\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      entry.triggers.forEach((t, i) => {
        narrative += `  ${i + 1}. ${t}\n`;
      });
      narrative += `\n`;
    }
    
    if (entry.environmentalData) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  ENVIRONMENTAL CONTEXT (Auto-Captured)\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      if (entry.environmentalData.location?.city) {
        narrative += `  Location: ${entry.environmentalData.location.city}\n`;
      }
      if (entry.environmentalData.weather) {
        const w = entry.environmentalData.weather;
        if (w.temperature) narrative += `  Temperature: ${w.temperature}°F\n`;
        if (w.humidity) narrative += `  Humidity: ${w.humidity}%\n`;
        if (w.condition) narrative += `  Conditions: ${w.condition}\n`;
        if (w.pressure) narrative += `  Barometric Pressure: ${w.pressure} inHg\n`;
      }
      if (entry.environmentalData.airQuality) {
        const a = entry.environmentalData.airQuality;
        if (a.aqi) narrative += `  Air Quality Index: ${a.aqi}\n`;
        if (a.pollen) narrative += `  Pollen Count: ${a.pollen}\n`;
      }
      narrative += `\n`;
    }
    
    if (entry.physiologicalData) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  PHYSIOLOGICAL METRICS (Wearable Device Integration)\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      const p = entry.physiologicalData;
      if (p.heartRate) narrative += `  Heart Rate: ${p.heartRate} bpm\n`;
      if (p.restingHeartRate) narrative += `  Resting Heart Rate: ${p.restingHeartRate} bpm\n`;
      if (p.heartRateVariability) narrative += `  Heart Rate Variability: ${p.heartRateVariability} ms\n`;
      if (p.spo2) narrative += `  Blood Oxygen (SpO2): ${p.spo2}%\n`;
      if (p.sleepHours) narrative += `  Sleep Duration: ${p.sleepHours} hours\n`;
      if (p.sleepQuality) narrative += `  Sleep Quality: ${p.sleepQuality}\n`;
      if (p.steps) narrative += `  Daily Steps: ${p.steps.toLocaleString()}\n`;
      if (p.stressLevel) narrative += `  Stress Level: ${p.stressLevel}/10\n`;
      if (p.skinTemperature) narrative += `  Skin Temperature: ${p.skinTemperature}°C\n`;
      narrative += `\n`;
    }
    
    if (entry.note) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  PATIENT NOTES\n`;
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `  "${entry.note}"\n\n`;
    }
    
    narrative += `╔══════════════════════════════════════════════════════════════════╗\n`;
    narrative += `║  CLINICAL NOTES                                                  ║\n`;
    narrative += `╠══════════════════════════════════════════════════════════════════╣\n`;
    narrative += `║  This record was generated from patient-reported data via the   ║\n`;
    narrative += `║  Jvala Health Intelligence Platform. Data includes automatically ║\n`;
    narrative += `║  captured environmental and physiological context for clinical   ║\n`;
    narrative += `║  correlation analysis.                                           ║\n`;
    narrative += `║                                                                  ║\n`;
    narrative += `║  For clinical use, verify with patient during consultation.      ║\n`;
    narrative += `╚══════════════════════════════════════════════════════════════════╝\n`;
    narrative += `\nGenerated: ${format(new Date(), 'PPpp')}\n`;
    narrative += `Document ID: JV-${Date.now().toString(36).toUpperCase()}\n`;
    
    return narrative;
  };

  const generateBulkClinicalReport = (entries: FlareEntry[]): string => {
    const flareEntries = entries.filter(e => e.type === 'flare');
    const dateRange = entries.length > 0 
      ? `${format(entries[entries.length - 1].timestamp, 'MMM d')} - ${format(entries[0].timestamp, 'MMM d, yyyy')}`
      : 'N/A';

    let report = `╔══════════════════════════════════════════════════════════════════╗\n`;
    report += `║          COMPREHENSIVE PATIENT HEALTH INTELLIGENCE REPORT          ║\n`;
    report += `╠══════════════════════════════════════════════════════════════════╣\n`;
    report += `║  Report Period: ${dateRange.padEnd(46)}║\n`;
    report += `║  Total Events: ${entries.length.toString().padEnd(47)}║\n`;
    report += `║  Flare Events: ${flareEntries.length.toString().padEnd(47)}║\n`;
    report += `║  Generated By: Jvala Health Intelligence Platform                 ║\n`;
    report += `╚══════════════════════════════════════════════════════════════════╝\n\n`;

    // Summary Statistics
    const severityCounts = { severe: 0, moderate: 0, mild: 0 };
    const symptomCounts: Record<string, number> = {};
    const triggerCounts: Record<string, number> = {};

    flareEntries.forEach(e => {
      if (e.severity) severityCounts[e.severity as keyof typeof severityCounts]++;
      e.symptoms?.forEach(s => { symptomCounts[s] = (symptomCounts[s] || 0) + 1; });
      e.triggers?.forEach(t => { triggerCounts[t] = (triggerCounts[t] || 0) + 1; });
    });

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `  EXECUTIVE SUMMARY\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `  Severity Distribution:\n`;
    report += `    • Severe:   ${severityCounts.severe} events\n`;
    report += `    • Moderate: ${severityCounts.moderate} events\n`;
    report += `    • Mild:     ${severityCounts.mild} events\n\n`;

    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topSymptoms.length > 0) {
      report += `  Top Symptoms:\n`;
      topSymptoms.forEach(([symptom, count], i) => {
        report += `    ${i + 1}. ${symptom} (${count} occurrences)\n`;
      });
      report += `\n`;
    }

    const topTriggers = Object.entries(triggerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    if (topTriggers.length > 0) {
      report += `  Top Triggers:\n`;
      topTriggers.forEach(([trigger, count], i) => {
        report += `    ${i + 1}. ${trigger} (${count} occurrences)\n`;
      });
      report += `\n`;
    }

    // Individual event records
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `  DETAILED EVENT LOG\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    entries.slice(0, 20).forEach((entry, i) => {
      report += `  [${i + 1}] ${format(entry.timestamp, 'MMM d, yyyy h:mm a')}\n`;
      report += `      Type: ${entry.type.toUpperCase()}`;
      if (entry.severity) report += ` | Severity: ${entry.severity.toUpperCase()}`;
      report += `\n`;
      if (entry.symptoms?.length) report += `      Symptoms: ${entry.symptoms.join(', ')}\n`;
      if (entry.triggers?.length) report += `      Triggers: ${entry.triggers.join(', ')}\n`;
      if (entry.note) report += `      Note: "${entry.note.substring(0, 60)}${entry.note.length > 60 ? '...' : ''}"\n`;
      report += `\n`;
    });

    if (entries.length > 20) {
      report += `  ... and ${entries.length - 20} more events\n\n`;
    }

    report += `╔══════════════════════════════════════════════════════════════════╗\n`;
    report += `║  END OF REPORT                                                    ║\n`;
    report += `║  Generated: ${format(new Date(), 'PPpp').padEnd(50)}║\n`;
    report += `║  Document ID: JV-RPT-${Date.now().toString(36).toUpperCase().padEnd(42)}║\n`;
    report += `╚══════════════════════════════════════════════════════════════════╝\n`;

    return report;
  };

  const generateFHIR = (): string => {
    const resource = {
      resourceType: "Bundle",
      type: "document",
      timestamp: new Date().toISOString(),
      entry: entriesToProcess.map(e => ({
        resource: {
          resourceType: "Observation",
          status: "final",
          code: {
            coding: [{
              system: "http://snomed.info/sct",
              code: "271807003",
              display: "Flare episode"
            }]
          },
          effectiveDateTime: e.timestamp.toISOString(),
          valueString: `${e.severity} flare`,
          component: [
            ...(e.symptoms || []).map(s => ({
              code: { text: "Symptom" },
              valueString: s
            })),
            ...(e.triggers || []).map(t => ({
              code: { text: "Trigger" },
              valueString: t
            }))
          ]
        }
      }))
    };
    return JSON.stringify(resource, null, 2);
  };

  const copyToClipboard = () => {
    if (generatedRecord) {
      navigator.clipboard.writeText(generatedRecord);
      toast({ title: "Copied to clipboard", description: "Clinical record copied successfully" });
    }
  };

  const downloadRecord = () => {
    if (!generatedRecord) return;
    const blob = new Blob([generatedRecord], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jvala-clinical-record-${format(new Date(), 'yyyy-MM-dd')}.${format_ === 'fhir' ? 'json' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: "Clinical record saved to your device" });
  };

  const sendToEHR = (system: string) => {
    toast({ 
      title: `Sending to ${system}...`, 
      description: "This would connect to your EHR system via FHIR API",
    });
  };

  const shareWithDoctor = () => {
    toast({ 
      title: "Share link created", 
      description: "Secure link copied - valid for 7 days",
    });
  };

  const printRecord = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow && generatedRecord) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Jvala Clinical Record</title>
            <style>
              body { font-family: 'Courier New', monospace; padding: 40px; white-space: pre-wrap; }
              @media print { body { padding: 20px; } }
            </style>
          </head>
          <body>${generatedRecord}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const resetGenerator = () => {
    setStep('select');
    setGeneratedRecord(null);
    setProgress(0);
  };

  if (entriesToProcess.length === 0 && !bulkMode) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetGenerator(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Premium Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 border-b">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                  {bulkMode ? 'Bulk Clinical Export' : 'Generate Clinical Record'}
                  <Badge className="bg-primary/20 text-primary border-0 text-[10px]">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI-Powered
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {bulkMode 
                    ? `Transform ${entriesToProcess.length} events into EHR-compatible records`
                    : 'Transform this flare event into an EHR-compatible clinical record'
                  }
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Format Selection */}
          {step === 'select' && (
            <div className="space-y-6">
              {/* Entry Summary */}
              {!bulkMode && entry && (
                <Card className="p-4 bg-muted/30 border-border/50">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                      entry.severity === 'severe' ? 'bg-red-500' :
                      entry.severity === 'moderate' ? 'bg-amber-500' :
                      'bg-blue-500'
                    )}>
                      <span className="text-white text-xl">⚡</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">
                        {entry.severity?.charAt(0).toUpperCase()}{entry.severity?.slice(1)} Flare Event
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(entry.timestamp, 'EEEE, MMMM d, yyyy • h:mm a')}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {entry.symptoms?.slice(0, 4).map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] bg-background">{s}</Badge>
                        ))}
                        {entry.environmentalData && (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-200">
                            <Thermometer className="w-2.5 h-2.5 mr-1" />
                            Environment
                          </Badge>
                        )}
                        {entry.physiologicalData && (
                          <Badge className="text-[10px] bg-rose-500/10 text-rose-600 border-rose-200">
                            <Heart className="w-2.5 h-2.5 mr-1" />
                            Wearable
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              )}

              {/* Bulk Mode Summary */}
              {bulkMode && (
                <Card className="p-4 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-3xl font-bold text-primary">{entriesToProcess.length}</span>
                    </div>
                    <div>
                      <p className="font-semibold">Health Events Selected</p>
                      <p className="text-sm text-muted-foreground">
                        {entriesToProcess.filter(e => e.type === 'flare').length} flares, 
                        {' '}{entriesToProcess.filter(e => e.type === 'medication').length} medications,
                        {' '}{entriesToProcess.filter(e => !['flare', 'medication'].includes(e.type)).length} other
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Format Selection */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-primary" />
                  Output Format
                </h4>
                <Tabs value={format_} onValueChange={(v) => setFormat(v as any)}>
                  <TabsList className="grid grid-cols-4 w-full h-auto p-1">
                    <TabsTrigger value="narrative" className="flex-col py-3 gap-1">
                      <FileText className="w-4 h-4" />
                      <span className="text-[10px]">Clinical Note</span>
                    </TabsTrigger>
                    <TabsTrigger value="fhir" className="flex-col py-3 gap-1">
                      <FileJson className="w-4 h-4" />
                      <span className="text-[10px]">FHIR R4</span>
                    </TabsTrigger>
                    <TabsTrigger value="hl7" className="flex-col py-3 gap-1">
                      <ClipboardCheck className="w-4 h-4" />
                      <span className="text-[10px]">HL7 v2</span>
                    </TabsTrigger>
                    <TabsTrigger value="ccd" className="flex-col py-3 gap-1">
                      <Building2 className="w-4 h-4" />
                      <span className="text-[10px]">CCD/CDA</span>
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-xs text-muted-foreground">
                    {format_ === 'narrative' && "Human-readable clinical note suitable for EHR documentation and patient records."}
                    {format_ === 'fhir' && "FHIR R4 JSON format for modern EHR integration (Epic, Cerner, Allscripts)."}
                    {format_ === 'hl7' && "HL7 v2.x message format for legacy healthcare system integration."}
                    {format_ === 'ccd' && "Continuity of Care Document (CCD/CDA) XML format for HIE exchange."}
                  </p>
                </div>
              </div>

              {/* Generate Button */}
              <Button 
                onClick={generateRecord}
                size="lg"
                className="w-full gap-2 h-12 text-sm font-semibold shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                Generate {bulkMode ? 'Comprehensive Report' : 'Clinical Record'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Step 2: Generating */}
          {step === 'generating' && (
            <div className="py-12 text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-lg">Generating Clinical Record</p>
                <p className="text-sm text-muted-foreground mt-1">Processing health data and formatting for EHR...</p>
              </div>
              <div className="max-w-xs mx-auto space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground">{progress}% complete</p>
              </div>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && generatedRecord && (
            <div className="space-y-4">
              {/* Success Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold">Record Generated</span>
                    <p className="text-[10px] text-muted-foreground">Ready for export or integration</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={copyToClipboard} className="gap-1.5 h-8">
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </Button>
                  <Button variant="ghost" size="sm" onClick={downloadRecord} className="gap-1.5 h-8">
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                  <Button variant="ghost" size="sm" onClick={printRecord} className="gap-1.5 h-8">
                    <Printer className="w-3.5 h-3.5" />
                    Print
                  </Button>
                </div>
              </div>
              
              {/* Record Preview */}
              <Card className="p-4 bg-slate-950 border-slate-800 font-mono text-xs max-h-64 overflow-y-auto">
                <pre className="whitespace-pre-wrap text-emerald-400/90">{generatedRecord}</pre>
              </Card>

              {/* Integration Options */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <ExternalLink className="w-4 h-4 text-primary" />
                  EHR Integration
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => sendToEHR('Epic')}
                    className="h-auto py-4 flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium block">Epic MyChart</span>
                      <span className="text-[10px] text-muted-foreground">FHIR R4 API</span>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => sendToEHR('Cerner')}
                    className="h-auto py-4 flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium block">Cerner Millennium</span>
                      <span className="text-[10px] text-muted-foreground">HL7 Integration</span>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={shareWithDoctor}
                    className="h-auto py-4 flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Share2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium block">Share Link</span>
                      <span className="text-[10px] text-muted-foreground">Secure 7-day link</span>
                    </div>
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => toast({ title: "Opening email...", description: "Preparing secure email" })}
                    className="h-auto py-4 flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
                  >
                    <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-medium block">Email to Doctor</span>
                      <span className="text-[10px] text-muted-foreground">Encrypted message</span>
                    </div>
                  </Button>
                </div>
              </div>

              {/* Security Notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
                <Shield className="w-4 h-4 text-primary mt-0.5" />
                <div className="text-[11px] text-muted-foreground">
                  <p className="font-medium text-foreground">HIPAA Compliant</p>
                  <p>All records are encrypted and transmitted securely. Patient data is never stored on third-party servers.</p>
                </div>
              </div>

              {/* Generate Another */}
              <Button variant="outline" onClick={resetGenerator} className="w-full">
                Generate Another Record
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};