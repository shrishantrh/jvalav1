import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { FileJson, FileCode, FileText, Share2, Loader2, Shield, Download, FileType, Trophy, Flame, Sparkles, Calendar, Bell } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEngagement } from "@/hooks/useEngagement";
import { useAuth } from "@/hooks/useAuth";
import { ALL_BADGES } from "@/data/allBadges";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import appIcon from "@/assets/app-icon.png";

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
  const [generatingImage, setGeneratingImage] = useState(false);
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

  // Native share helper
  const nativeShare = async (files: File[], title: string, text: string) => {
    if (navigator.share && navigator.canShare?.({ files })) {
      await navigator.share({ files, title, text });
    } else if (files.length > 0) {
      // Fallback: download
      const url = URL.createObjectURL(files[0]);
      const a = document.createElement('a');
      a.href = url;
      a.download = files[0].name;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "File saved!", description: "Share sheet not available — downloaded instead" });
    }
  };

  // Generate shareable image using canvas (no html2canvas needed)
  const handleShareJourney = async () => {
    haptics.medium();
    setGeneratingImage(true);
    try {
      const summary = `My Health Journey — Jvala\n\n🔥 ${streak} Day Streak\n✨ ${totalLogs} Total Logs\n🏆 ${earnedBadges.length} Badges Earned${earnedBadges.length > 0 ? `\n\nRecent Badges:\n${earnedBadges.slice(-4).reverse().map(b => `${b.icon} ${b.name}`).join('\n')}` : ''}\n\nTracked with Jvala — jvala.tech`;
      const blob = new Blob([summary], { type: 'text/plain' });
      const file = new File([blob], `Jvala-Journey-${format(new Date(), 'yyyyMMdd')}.txt`, { type: 'text/plain' });
      await nativeShare([file], 'My Health Journey', summary);
    } catch (e) {
      console.error('Share failed:', e);
      toast({ title: "Couldn't share", variant: "destructive" });
    } finally {
      setGeneratingImage(false);
    }
  };

  // FHIR Bundle generator
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

  const getExportData = () => {
    let content = '', filename = '', mimeType = '';
    switch (selectedFormat) {
      case 'fhir':
        content = JSON.stringify(generateFHIRBundle(), null, 2);
        filename = `FHIR-Export-${format(new Date(), 'yyyyMMdd')}.json`;
        mimeType = 'application/json';
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
    return { content, filename, mimeType };
  };

  const handleDownload = () => {
    const { content, filename, mimeType } = getExportData();
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast({ title: "Export downloaded", description: filename });
  };

  const handleShareClinical = async () => {
    haptics.light();
    const { content, filename, mimeType } = getExportData();
    const blob = new Blob([content], { type: mimeType });
    const file = new File([blob], filename, { type: mimeType });
    await nativeShare([file], `Jvala Health Export`, `Health data export — ${filename}`);
  };

  // Weekly digest notification logic
  const [digestDismissed, setDigestDismissed] = useState(() => {
    try {
      const dismissed = localStorage.getItem('jvala_digest_dismissed');
      if (!dismissed) return false;
      // Show again after 7 days
      return Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000;
    } catch { return false; }
  });

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEntries = entries.filter(e => {
    const ts = new Date(e.timestamp);
    return ts >= weekStart && ts <= weekEnd;
  });
  const showDigest = !digestDismissed && thisWeekEntries.length >= 3;

  const handleDismissDigest = () => {
    setDigestDismissed(true);
    try { localStorage.setItem('jvala_digest_dismissed', String(Date.now())); } catch {}
  };

  const handleShareDigest = async () => {
    haptics.light();
    const summary = `Weekly Health Digest — ${format(weekStart, 'MMM d')} to ${format(weekEnd, 'MMM d, yyyy')}\n\nTotal Entries: ${thisWeekEntries.length}\nFlares: ${thisWeekEntries.filter(e => e.type === 'flare').length}\nStreak: ${streak} days\n\nGenerated by Jvala`;
    const blob = new Blob([summary], { type: 'text/plain' });
    const file = new File([blob], `Weekly-Digest-${format(new Date(), 'yyyyMMdd')}.txt`, { type: 'text/plain' });
    await nativeShare([file], 'Weekly Health Digest', summary);
  };

  return (
    <div className="space-y-4 animate-fade-in" data-tour="exports-area">
      {/* Weekly Digest Notification */}
      {showDigest && (
        <Card className="glass-card border-0 rounded-3xl overflow-hidden border-l-4 border-l-primary/40">
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4.5 h-4.5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">Weekly Digest Ready</p>
                  <p className="text-[10px] text-muted-foreground">{format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d')}</p>
                </div>
              </div>
              <button onClick={handleDismissDigest} className="text-xs text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="text-center glass-card py-2 rounded-xl">
                <p className="text-lg font-bold text-primary">{thisWeekEntries.length}</p>
                <p className="text-[9px] text-muted-foreground">Entries</p>
              </div>
              <div className="text-center glass-card py-2 rounded-xl">
                <p className="text-lg font-bold text-primary">{thisWeekEntries.filter(e => e.type === 'flare').length}</p>
                <p className="text-[9px] text-muted-foreground">Flares</p>
              </div>
              <div className="text-center glass-card py-2 rounded-xl">
                <p className="text-lg font-bold text-primary">{streak}</p>
                <p className="text-[9px] text-muted-foreground">Streak</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleShareDigest} size="sm" className="flex-1 h-10 rounded-xl text-xs font-semibold gap-1.5">
                <Share2 className="w-3.5 h-3.5" /> Share
              </Button>
              <Button onClick={handleDismissDigest} variant="outline" size="sm" className="flex-1 h-10 rounded-xl text-xs font-semibold glass-card border-0">
                <Download className="w-3.5 h-3.5 mr-1.5" /> Save
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(v) => { haptics.selection(); setActiveTab(v); }} className="w-full">
        <TabsList className="grid w-full grid-cols-2 glass-card border-0 rounded-2xl p-1.5 h-11">
          <TabsTrigger value="share" className="text-xs gap-1.5 font-semibold rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Share2 className="w-4 h-4" />
            Share Journey
          </TabsTrigger>
          <TabsTrigger value="clinical" className="text-xs gap-1.5 font-semibold rounded-xl data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            <Shield className="w-4 h-4" />
            Clinical Export
          </TabsTrigger>
        </TabsList>

        {/* ── Share Journey Tab ── */}
        <TabsContent value="share" className="mt-4 space-y-4">
          <Card className="glass-card border-0 rounded-3xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-primary" />
                    </div>
                    Your Health Journey
                  </h3>
                  <p className="text-xs text-muted-foreground ml-10">Share your progress with others</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/8 text-primary border-0">
                  {streak} day streak
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2.5 mb-5">
                {[
                  { icon: <Flame className="w-4 h-4 text-primary" />, value: streak, label: 'Day Streak' },
                  { icon: <Sparkles className="w-4 h-4 text-primary" />, value: totalLogs, label: 'Total Logs' },
                  { icon: <Trophy className="w-4 h-4 text-primary" />, value: earnedBadges.length, label: 'Badges' },
                ].map((stat, i) => (
                  <div key={i} className="glass-card text-center py-3 rounded-2xl">
                    <div className="flex justify-center mb-1">{stat.icon}</div>
                    <p className="text-xl font-extrabold">{stat.value}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Recent badges */}
              {earnedBadges.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Recent Badges</p>
                  <div className="grid grid-cols-2 gap-2">
                    {earnedBadges.slice(-4).reverse().map(badge => (
                      <div key={badge.id} className="glass-card rounded-xl px-3 py-2 flex items-center gap-2">
                        <span className="text-base">{badge.icon}</span>
                        <span className="text-[11px] font-medium truncate">{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Share button — same style as clinical */}
              <Button onClick={() => { haptics.medium(); handleShareJourney(); }} className="w-full h-12 rounded-2xl font-semibold" size="sm" disabled={generatingImage}>
                {generatingImage ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                Share
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ── Clinical Export Tab ── */}
        <TabsContent value="clinical" className="mt-4 space-y-4">
          <Card className="glass-card border-0 rounded-3xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold mb-1 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-primary" />
                    </div>
                    Medical Export
                  </h3>
                  <p className="text-xs text-muted-foreground ml-10">Export for healthcare providers</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/8 text-primary border-0">Clinical Grade</Badge>
              </div>

              {/* Date Range */}
              <div className="space-y-2 mb-5">
                <Label className="text-xs font-medium">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="h-11 rounded-xl glass-card border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{filteredEntries.length} entries in this period</p>
              </div>

              {/* Format Selection */}
              <div className="space-y-2 mb-5">
                <Label className="text-xs font-medium">Export Format</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'fhir', label: 'FHIR R4', icon: FileJson, desc: 'HL7 interop standard' },
                    { id: 'ccd', label: 'CCD', icon: FileText, desc: 'Clinical summary' },
                    { id: 'csv', label: 'CSV', icon: FileCode, desc: 'Spreadsheet format' },
                    { id: 'meddra', label: 'MedDRA', icon: FileType, desc: 'Coded symptoms' },
                  ].map(fmt => (
                    <button
                      key={fmt.id}
                      onClick={() => { haptics.selection(); setSelectedFormat(fmt.id); }}
                      className={cn(
                        "p-3.5 rounded-2xl text-left transition-all press-effect",
                        selectedFormat === fmt.id 
                          ? "glass-card border-primary/30 bg-primary/8 shadow-sm" 
                          : "glass-card border-transparent hover:bg-muted/20"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <fmt.icon className={cn("w-4 h-4", selectedFormat === fmt.id ? "text-primary" : "text-muted-foreground")} />
                        <span className="text-xs font-bold">{fmt.label}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{fmt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Single share action */}
              <Button onClick={() => { haptics.medium(); handleShareClinical(); }} className="w-full h-12 rounded-2xl font-semibold" size="sm">
                <Share2 className="w-4 h-4 mr-2" />
                Share Export
              </Button>

              {/* Compliance badges */}
              <div className="flex flex-wrap gap-1.5 pt-4 mt-4 border-t border-border/20">
                {['HL7 FHIR R4', 'MedDRA', '21 CFR 11'].map(standard => (
                  <Badge key={standard} variant="outline" className="text-[9px] px-2 py-0.5 rounded-full border-border/30">{standard}</Badge>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
