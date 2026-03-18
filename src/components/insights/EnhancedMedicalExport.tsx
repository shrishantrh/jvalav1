import React, { useState, useMemo, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, subDays } from 'date-fns';
import { FileDown, FileJson, FileCode, FileText, Share2, Mail, Loader2, CheckCircle, Shield, Download, FileType, Trophy, Flame, Sparkles, Image } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useEngagement } from "@/hooks/useEngagement";
import { useAuth } from "@/hooks/useAuth";
import { ALL_BADGES, getRarityColor } from "@/data/allBadges";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";

interface EnhancedMedicalExportProps {
  entries: FlareEntry[];
  patientName?: string;
  patientId?: string;
  conditions?: string[];
}

const MEDDRA_CODES: Record<string, { code: string; term: string }> = {
  'headache': { code: '10019211', term: 'Headache' },
  'migraine': { code: '10027599', term: 'Migraine' },
  'fatigue': { code: '10016256', term: 'Fatigue' },
  'nausea': { code: '10028813', term: 'Nausea' },
  'dizziness': { code: '10013573', term: 'Dizziness' },
  'joint pain': { code: '10023222', term: 'Arthralgia' },
  'muscle pain': { code: '10028411', term: 'Myalgia' },
  'rash': { code: '10037844', term: 'Rash' },
  'itching': { code: '10037087', term: 'Pruritus' },
  'swelling': { code: '10042674', term: 'Swelling' },
};

export const EnhancedMedicalExport = ({ 
  entries, 
  patientName = 'Patient',
  patientId = 'PATIENT-001',
  conditions = []
}: EnhancedMedicalExportProps) => {
  const [activeTab, setActiveTab] = useState<string>('share');
  const [selectedFormat, setSelectedFormat] = useState<string>('fhir');
  const [dateRange, setDateRange] = useState<string>('30');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getEngagement } = useEngagement();
  const [engagement, setEngagement] = useState<any>(null);

  React.useEffect(() => {
    if (user) {
      getEngagement(user.id).then(setEngagement);
    }
  }, [user]);

  const filteredEntries = entries.filter(e => {
    const days = parseInt(dateRange);
    return e.timestamp >= subDays(new Date(), days);
  });

  const earnedBadges = ALL_BADGES.filter(b => engagement?.badges?.includes(b.id));
  const streak = engagement?.current_streak || 0;
  const totalLogs = engagement?.total_logs || 0;

  // Generate shareable image from canvas
  const handleShareJourney = async () => {
    haptics.light();
    setGeneratingImage(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const el = shareCardRef.current;
      if (!el) return;
      
      // Temporarily show the card
      el.style.display = 'block';
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      
      const canvas = await html2canvas(el, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        width: 400,
        height: 500,
      });
      
      el.style.display = 'none';
      el.style.position = '';
      el.style.top = '';
      
      canvas.toBlob(blob => {
        if (!blob) return;
        
        if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'jvala-journey.png', { type: 'image/png' })] })) {
          navigator.share({
            files: [new File([blob], 'jvala-journey.png', { type: 'image/png' })],
            title: 'My Health Journey',
            text: `I've been on a ${streak}-day streak tracking my health with Jvala! 🔥`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'jvala-journey.png';
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: "Image saved!", description: "Share it with your friends" });
        }
      }, 'image/png');
    } catch (e) {
      console.error('Share failed:', e);
      toast({ title: "Couldn't generate image", variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  // FHIR, CCD, etc. generators (kept from original)
  const generateFHIRBundle = () => ({
    resourceType: "Bundle", type: "collection", timestamp: new Date().toISOString(),
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/Bundle"] },
    identifier: { system: "urn:jvala:export", value: `JVALA-${Date.now()}` },
    entry: filteredEntries.map(entry => ({
      fullUrl: `urn:uuid:${entry.id}`,
      resource: {
        resourceType: "Observation", id: entry.id, status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey", display: "Survey" }] }],
        code: { coding: [{ system: "http://snomed.info/sct", code: entry.type === 'flare' ? "404684003" : "413350009", display: entry.type === 'flare' ? "Clinical finding" : "Finding" }], text: `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Entry` },
        subject: { reference: `Patient/${patientId}`, display: patientName },
        effectiveDateTime: new Date(entry.timestamp).toISOString(),
        component: [
          entry.severity && { code: { coding: [{ system: "http://snomed.info/sct", code: "246112005", display: "Severity" }] }, valueString: entry.severity },
          ...(entry.symptoms?.map(s => ({ code: { coding: [{ system: "http://snomed.info/sct", code: "418799008", display: "Symptom" }] }, valueString: s })) || [])
        ].filter(Boolean),
        note: entry.note ? [{ text: entry.note }] : undefined
      }
    }))
  });

  const generateCCDSummary = () => {
    const severeCounts = filteredEntries.filter(e => e.severity === 'severe').length;
    const moderateCounts = filteredEntries.filter(e => e.severity === 'moderate').length;
    const mildCounts = filteredEntries.filter(e => e.severity === 'mild').length;
    const allSymptoms: Record<string, number> = {};
    const allTriggers: Record<string, number> = {};
    filteredEntries.forEach(e => {
      e.symptoms?.forEach(s => { allSymptoms[s] = (allSymptoms[s] || 0) + 1; });
      e.triggers?.forEach(t => { allTriggers[t] = (allTriggers[t] || 0) + 1; });
    });
    return `CONTINUITY OF CARE DOCUMENT (CCD)\nHealth Summary Export from Jvala\nGenerated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}\nReport Period: Last ${dateRange} days\n\nSUMMARY STATISTICS\nTotal Episodes: ${filteredEntries.length}\nSevere: ${severeCounts} | Moderate: ${moderateCounts} | Mild: ${mildCounts}\n\nTOP SYMPTOMS\n${Object.entries(allSymptoms).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([s, c]) => `${s}: ${c}`).join('\n')}\n\nTOP TRIGGERS\n${Object.entries(allTriggers).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t, c]) => `${t}: ${c}`).join('\n') || 'None recorded'}\n\nDETAILED ENTRIES\n${filteredEntries.slice(0, 50).map((e, i) => `${i + 1}. ${format(new Date(e.timestamp), 'MMM d, yyyy HH:mm')} - ${e.severity || e.type}${e.symptoms?.length ? ` [${e.symptoms.join(', ')}]` : ''}${e.note ? ` - ${e.note}` : ''}`).join('\n')}\n\nDocument ID: JVALA-CCD-${Date.now()}`;
  };

  const generateMedDRAExport = () => {
    const allSymptoms: Record<string, number> = {};
    filteredEntries.forEach(e => { e.symptoms?.forEach(s => { allSymptoms[s.toLowerCase()] = (allSymptoms[s.toLowerCase()] || 0) + 1; }); });
    const rows = [['MedDRA Code', 'Preferred Term', 'Patient Term', 'Frequency', 'Report Period'],
      ...Object.entries(allSymptoms).map(([symptom, count]) => {
        const meddra = MEDDRA_CODES[symptom] || { code: 'N/A', term: symptom };
        return [meddra.code, meddra.term, symptom, count.toString(), `Last ${dateRange} days`];
      })];
    return rows.map(r => r.join(',')).join('\n');
  };

  const handleExport = () => {
    let content = '', filename = '', mimeType = '';
    switch (selectedFormat) {
      case 'fhir':
        content = JSON.stringify(generateFHIRBundle(), null, 2);
        filename = `FHIR-Export-${format(new Date(), 'yyyyMMdd')}.json`;
        mimeType = 'application/fhir+json';
        break;
      case 'ccd':
        content = generateCCDSummary();
        filename = `CCD-Summary-${format(new Date(), 'yyyyMMdd')}.txt`;
        mimeType = 'text/plain';
        break;
      case 'csv':
        const headers = ['Date', 'Type', 'Severity', 'Symptoms', 'Triggers', 'Medications', 'Notes'];
        const rows = filteredEntries.map(e => [
          format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm'), e.type, e.severity || '',
          e.symptoms?.join('; ') || '', e.triggers?.join('; ') || '', e.medications?.join('; ') || '',
          e.note?.replace(/"/g, '""') || ''
        ]);
        content = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        filename = `Health-Data-${format(new Date(), 'yyyyMMdd')}.csv`;
        mimeType = 'text/csv';
        break;
      case 'meddra':
        content = generateMedDRAExport();
        filename = `MedDRA-Export-${format(new Date(), 'yyyyMMdd')}.csv`;
        mimeType = 'text/csv';
        break;
    }
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast({ title: "Export successful", description: `Downloaded ${filename}` });
  };

  const handleSendToProvider = async () => {
    if (!recipientEmail) { toast({ title: "Please enter an email address", variant: "destructive" }); return; }
    setSending(true);
    try {
      const summary = generateCCDSummary();
      const { error } = await supabase.functions.invoke('send-health-report', {
        body: { recipientEmail, subject: `Health Summary Report - ${patientName}`, summary, patientName, dateRange }
      });
      if (error) throw error;
      toast({ title: "Report sent!", description: `Health summary sent to ${recipientEmail}` });
      setShowShareDialog(false); setRecipientEmail('');
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message || "Please try again", variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4 animate-fade-in" data-tour="exports-area">
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-11 bg-card/80 backdrop-blur-sm">
          <TabsTrigger value="share" className="text-xs gap-1.5 font-medium">
            <Share2 className="w-4 h-4" />
            Share Journey
          </TabsTrigger>
          <TabsTrigger value="clinical" className="text-xs gap-1.5 font-medium">
            <Shield className="w-4 h-4" />
            Clinical Export
          </TabsTrigger>
        </TabsList>

        {/* Share Journey Tab */}
        <TabsContent value="share" className="mt-3 space-y-4">
          {/* Journey Stats Card */}
          <Card className="overflow-hidden border-0" style={{ background: 'var(--gradient-primary)', boxShadow: '0 6px 24px hsl(var(--primary) / 0.25)' }}>
            <div className="p-5 text-white">
              <h3 className="text-lg font-bold mb-4">Your Health Journey</h3>
              
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                  <Flame className="w-5 h-5 mx-auto mb-1 text-white/80" />
                  <p className="text-2xl font-bold">{streak}</p>
                  <p className="text-[10px] text-white/70">Day Streak</p>
                </div>
                <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                  <Sparkles className="w-5 h-5 mx-auto mb-1 text-white/80" />
                  <p className="text-2xl font-bold">{totalLogs}</p>
                  <p className="text-[10px] text-white/70">Total Logs</p>
                </div>
                <div className="bg-white/15 rounded-2xl p-3 text-center backdrop-blur-sm">
                  <Trophy className="w-5 h-5 mx-auto mb-1 text-white/80" />
                  <p className="text-2xl font-bold">{earnedBadges.length}</p>
                  <p className="text-[10px] text-white/70">Badges</p>
                </div>
              </div>

              {/* Recent badges showcase */}
              {earnedBadges.length > 0 && (
                <div>
                  <p className="text-xs text-white/70 mb-2">Recent Badges</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {earnedBadges.slice(-6).reverse().map(badge => (
                      <div key={badge.id} className="flex-shrink-0 bg-white/20 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 backdrop-blur-sm">
                        <span className="text-sm">{badge.icon}</span>
                        <span className="text-[10px] font-medium text-white whitespace-nowrap">{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Share Button */}
          <Button 
            onClick={handleShareJourney} 
            disabled={generatingImage}
            className="w-full h-12 rounded-2xl font-semibold text-sm gap-2"
            style={{ background: 'var(--gradient-primary)', boxShadow: '0 4px 16px hsl(var(--primary) / 0.3)' }}
          >
            {generatingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Image className="w-4 h-4" />}
            {generatingImage ? 'Generating...' : 'Share as Image'}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Creates a beautiful shareable image of your health journey stats
          </p>
        </TabsContent>

        {/* Clinical Export Tab */}
        <TabsContent value="clinical" className="mt-3 space-y-4">
          <Card className="p-5 glass-card border-0">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Medical Export
                </h3>
                <p className="text-xs text-muted-foreground">Export health data for healthcare providers</p>
              </div>
              <Badge variant="secondary" className="text-[10px]">Clinical Grade</Badge>
            </div>

            {/* Date Range */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{filteredEntries.length} entries in this period</p>
            </div>

            {/* Format Selection */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs">Export Format</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'fhir', label: 'FHIR R4', icon: FileJson, desc: 'HL7 interop standard' },
                  { id: 'ccd', label: 'CCD', icon: FileText, desc: 'Clinical summary' },
                  { id: 'csv', label: 'CSV', icon: FileCode, desc: 'Spreadsheet format' },
                  { id: 'meddra', label: 'MedDRA', icon: FileType, desc: 'Coded symptoms' },
                ].map(fmt => (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    className={cn(
                      "p-3 rounded-2xl border text-left transition-all touch-manipulation",
                      selectedFormat === fmt.id 
                        ? "border-primary/40 bg-primary/5" 
                        : "border-border/50 bg-card/50 hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <fmt.icon className={cn("w-4 h-4", selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground")} />
                      <span className="text-xs font-semibold">{fmt.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{fmt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleExport} className="flex-1 rounded-xl" size="sm">
                <Download className="w-4 h-4 mr-2" />Download
              </Button>
              <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl">
                    <Mail className="w-4 h-4 mr-2" />Email Provider
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5 text-primary" />Send to Healthcare Provider</DialogTitle>
                    <DialogDescription>Email a health summary to your doctor or care team</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div>
                      <Label>Provider's Email</Label>
                      <Input type="email" placeholder="doctor@clinic.com" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} className="mt-1.5" />
                    </div>
                    <p className="text-xs text-muted-foreground">A summary of your last {dateRange} days of health data will be sent.</p>
                    <Button onClick={handleSendToProvider} disabled={sending || !recipientEmail} className="w-full">
                      {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                      {sending ? 'Sending...' : 'Send Report'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Compliance badges */}
            <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-border/30">
              {['HL7 FHIR R4', 'MedDRA', '21 CFR 11'].map(standard => (
                <Badge key={standard} variant="outline" className="text-[9px] px-1.5 py-0">{standard}</Badge>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Hidden shareable card for image generation */}
      <div ref={shareCardRef} style={{ display: 'none', width: 400, height: 500, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #D6006C, #892EFF)', padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ color: 'white', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>My Health Journey</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>Tracked with Jvala</div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '20px 24px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'white' }}>🔥 {streak}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Day Streak</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '20px 24px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'white' }}>{totalLogs}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Total Logs</div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '20px 24px', textAlign: 'center' as const }}>
              <div style={{ fontSize: 42, fontWeight: 800, color: 'white' }}>🏆 {earnedBadges.length}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Badges</div>
            </div>
          </div>
          <div>
            {earnedBadges.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const, justifyContent: 'center', marginBottom: 16 }}>
                {earnedBadges.slice(-4).map(b => (
                  <span key={b.id} style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 12, padding: '6px 12px', fontSize: 13, color: 'white' }}>
                    {b.icon} {b.name}
                  </span>
                ))}
              </div>
            )}
            <div style={{ textAlign: 'center' as const, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
              jvala.tech
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
