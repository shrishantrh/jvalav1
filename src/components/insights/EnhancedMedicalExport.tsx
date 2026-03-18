import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, subDays } from 'date-fns';
import { FileJson, FileCode, FileText, Share2, Loader2, Shield, Download, FileType, Trophy, Flame, Sparkles } from 'lucide-react';
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
    haptics.light();
    setGeneratingImage(true);
    try {
      const canvas = document.createElement('canvas');
      const w = 1080, h = 1920;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#D6006C');
      grad.addColorStop(0.5, '#892EFF');
      grad.addColorStop(1, '#6428D9');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Decorative circles
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.15, 300, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.7, 400, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Title
      ctx.fillStyle = '#fff';
      ctx.font = '800 72px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('My Health Journey', w / 2, 280);

      ctx.font = '400 36px system-ui, -apple-system, sans-serif';
      ctx.globalAlpha = 0.7;
      ctx.fillText('Tracked with Jvala', w / 2, 340);
      ctx.globalAlpha = 1;

      // Stats cards
      const cardY = 480;
      const cardW = 280;
      const cardH = 200;
      const gap = 40;
      const startX = (w - (cardW * 3 + gap * 2)) / 2;

      const stats = [
        { emoji: '🔥', value: String(streak), label: 'Day Streak' },
        { emoji: '✨', value: String(totalLogs), label: 'Total Logs' },
        { emoji: '🏆', value: String(earnedBadges.length), label: 'Badges' },
      ];

      stats.forEach((stat, i) => {
        const x = startX + i * (cardW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        const r = 28;
        ctx.beginPath();
        ctx.roundRect(x, cardY, cardW, cardH, r);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.font = '400 48px system-ui';
        ctx.fillText(stat.emoji, x + cardW / 2, cardY + 60);
        ctx.font = '800 64px system-ui';
        ctx.fillText(stat.value, x + cardW / 2, cardY + 130);
        ctx.font = '400 28px system-ui';
        ctx.globalAlpha = 0.7;
        ctx.fillText(stat.label, x + cardW / 2, cardY + 170);
        ctx.globalAlpha = 1;
      });

      // Badges section
      if (earnedBadges.length > 0) {
        ctx.font = '600 32px system-ui';
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#fff';
        ctx.fillText('Recent Achievements', w / 2, 800);
        ctx.globalAlpha = 1;

        const badgesToShow = earnedBadges.slice(-6).reverse();
        const badgeH = 72;
        const badgeGap = 16;
        const badgeStartY = 840;

        badgesToShow.forEach((badge, i) => {
          const row = Math.floor(i / 3);
          const col = i % 3;
          const bw = 300;
          const totalW = bw * 3 + badgeGap * 2;
          const bx = (w - totalW) / 2 + col * (bw + badgeGap);
          const by = badgeStartY + row * (badgeH + badgeGap);

          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, badgeH, 20);
          ctx.fill();

          ctx.fillStyle = '#fff';
          ctx.font = '400 32px system-ui';
          ctx.textAlign = 'left';
          ctx.fillText(`${badge.icon}  ${badge.name}`, bx + 20, by + 45);
          ctx.textAlign = 'center';
        });
      }

      // App icon at bottom
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = appIcon;
        });
        const iconSize = 100;
        const iconX = (w - iconSize) / 2;
        const iconY = h - 260;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(iconX, iconY, iconSize, iconSize, 22);
        ctx.clip();
        ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        ctx.restore();
      } catch {}

      // Bottom text
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = 0.8;
      ctx.font = '600 34px system-ui';
      ctx.fillText('jvala.tech', w / 2, h - 140);
      ctx.globalAlpha = 0.5;
      ctx.font = '400 26px system-ui';
      ctx.fillText('Download on the App Store', w / 2, h - 95);
      ctx.globalAlpha = 1;

      // Convert to blob and share
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(b => resolve(b!), 'image/png');
      });

      const file = new File([blob], 'jvala-journey.png', { type: 'image/png' });
      await nativeShare(
        [file],
        'My Health Journey',
        `I've been on a ${streak}-day streak tracking my health with Jvala! 🔥`
      );
    } catch (e) {
      console.error('Share failed:', e);
      toast({ title: "Couldn't generate image", variant: "destructive" });
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

  return (
    <div className="space-y-4 animate-fade-in" data-tour="exports-area">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 glass-card border-0 rounded-2xl p-1">
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
          <Card className="overflow-hidden border-0 rounded-3xl" style={{ background: 'var(--gradient-primary)', boxShadow: '0 8px 32px hsl(var(--primary) / 0.3)' }}>
            <div className="p-6 text-white relative overflow-hidden">
              {/* Decorative orbs */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-white/5 blur-3xl" />

              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-5">Your Health Journey</h3>
                
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { icon: <Flame className="w-5 h-5" />, value: streak, label: 'Day Streak' },
                    { icon: <Sparkles className="w-5 h-5" />, value: totalLogs, label: 'Total Logs' },
                    { icon: <Trophy className="w-5 h-5" />, value: earnedBadges.length, label: 'Badges' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white/15 backdrop-blur-md rounded-2xl p-3.5 text-center border border-white/10">
                      <div className="text-white/70 flex justify-center mb-1">{stat.icon}</div>
                      <p className="text-2xl font-extrabold">{stat.value}</p>
                      <p className="text-[10px] text-white/60 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent badges — max 4, no scroll */}
                {earnedBadges.length > 0 && (
                  <div>
                    <p className="text-xs text-white/50 mb-2 font-medium">Recent Badges</p>
                    <div className="grid grid-cols-2 gap-2">
                      {earnedBadges.slice(-4).reverse().map(badge => (
                        <div key={badge.id} className="bg-white/12 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 border border-white/8">
                          <span className="text-base">{badge.icon}</span>
                          <span className="text-[11px] font-medium text-white/90 truncate">{badge.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Share Button — uses native share sheet */}
          <button 
            onClick={handleShareJourney} 
            disabled={generatingImage}
            className="w-full h-14 rounded-2xl font-semibold text-base gap-2.5 flex items-center justify-center text-primary-foreground press-effect transition-all disabled:opacity-50"
            style={{ background: 'var(--gradient-primary)', boxShadow: '0 6px 20px hsl(var(--primary) / 0.35)' }}
          >
            {generatingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
            {generatingImage ? 'Generating...' : 'Share as Image'}
          </button>

          <p className="text-xs text-center text-muted-foreground/60">
            Creates a shareable image and opens the share sheet
          </p>
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
                      onClick={() => setSelectedFormat(fmt.id)}
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

              {/* Action Buttons */}
              <div className="flex gap-2.5">
                <Button onClick={handleDownload} className="flex-1 h-12 rounded-2xl font-semibold" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button onClick={handleShareClinical} variant="outline" size="sm" className="flex-1 h-12 rounded-2xl font-semibold glass-card border-0">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>

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
