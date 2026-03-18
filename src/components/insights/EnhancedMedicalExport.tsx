import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FlareEntry } from '@/types/flare';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import {
  FileJson,
  FileCode,
  FileText,
  Share2,
  Loader2,
  Shield,
  FileType,
  Trophy,
  Flame,
  Sparkles,
  Calendar,
  CheckCircle2,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEngagement } from '@/hooks/useEngagement';
import { useAuth } from '@/hooks/useAuth';
import { ALL_BADGES } from '@/data/allBadges';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface EnhancedMedicalExportProps {
  entries: FlareEntry[];
  patientName?: string;
  patientId?: string;
  conditions?: string[];
}

const MEDDRA_CODES: Record<string, { code: string; term: string }> = {
  headache: { code: '10019211', term: 'Headache' },
  migraine: { code: '10027599', term: 'Migraine' },
  fatigue: { code: '10016256', term: 'Fatigue' },
  nausea: { code: '10028813', term: 'Nausea' },
  dizziness: { code: '10013573', term: 'Dizziness' },
  'joint pain': { code: '10023222', term: 'Arthralgia' },
  'muscle pain': { code: '10028411', term: 'Myalgia' },
  rash: { code: '10037844', term: 'Rash' },
  itching: { code: '10037087', term: 'Pruritus' },
  swelling: { code: '10042674', term: 'Swelling' },
};

const EXPORT_FORMATS = [
  { id: 'fhir', label: 'FHIR R4', icon: FileJson, desc: 'HL7 interoperability JSON' },
  { id: 'ccd', label: 'CCD', icon: FileText, desc: 'Clinical summary document' },
  { id: 'csv', label: 'CSV', icon: FileCode, desc: 'Spreadsheet-ready rows' },
  { id: 'meddra', label: 'MedDRA', icon: FileType, desc: 'Coded symptom frequency' },
] as const;

type ExportFormat = (typeof EXPORT_FORMATS)[number]['id'];

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const tokenHsl = (name: string, fallback: string) => {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!value) return fallback;
    return `hsl(${value})`;
  } catch {
    return fallback;
  }
};

export const EnhancedMedicalExport = ({
  entries,
  patientName = 'Patient',
  patientId = 'PATIENT-001',
}: EnhancedMedicalExportProps) => {
  const [activeTab, setActiveTab] = useState<string>('share');
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('fhir');
  const [dateRange, setDateRange] = useState<string>('30');
  const [generatingImage, setGeneratingImage] = useState(false);
  const [sharingClinical, setSharingClinical] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { getEngagement } = useEngagement();
  const [engagement, setEngagement] = useState<any>(null);

  React.useEffect(() => {
    if (!user) return;
    getEngagement(user.id).then(setEngagement);
  }, [user, getEngagement]);

  const filteredEntries = useMemo(() => {
    const days = Number.parseInt(dateRange, 10);
    return entries.filter((e) => new Date(e.timestamp) >= subDays(new Date(), Number.isNaN(days) ? 30 : days));
  }, [entries, dateRange]);

  const earnedBadges = ALL_BADGES.filter((b) => engagement?.badges?.includes(b.id));
  const streak = engagement?.current_streak || 0;
  const totalLogs = engagement?.total_logs || 0;

  const nativeShare = async (files: File[], title: string, text: string) => {
    if (navigator.share && navigator.canShare?.({ files })) {
      await navigator.share({ files, title, text });
      return;
    }

    if (files.length > 0) {
      const url = URL.createObjectURL(files[0]);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = files[0].name;
      anchor.click();
      URL.revokeObjectURL(url);
      toast({ title: 'File saved', description: 'Share sheet unavailable, so we downloaded it instead.' });
    }
  };

  const buildJourneyImage = async (): Promise<File> => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_context_unavailable');

    const bgStart = tokenHsl('--background', 'hsl(0 0% 100%)');
    const bgEnd = tokenHsl('--muted', 'hsl(330 25% 96%)');
    const primary = tokenHsl('--primary', 'hsl(330 100% 42%)');
    const accent = tokenHsl('--accent', 'hsl(270 100% 55%)');
    const foreground = tokenHsl('--foreground', 'hsl(18 14% 28%)');
    const mutedForeground = tokenHsl('--muted-foreground', 'hsl(18 10% 45%)');

    const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    background.addColorStop(0, bgStart);
    background.addColorStop(1, bgEnd);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const header = ctx.createLinearGradient(90, 90, 990, 390);
    header.addColorStop(0, primary);
    header.addColorStop(1, accent);
    drawRoundedRect(ctx, 90, 90, 900, 300, 48);
    ctx.fillStyle = header;
    ctx.fill();

    ctx.fillStyle = 'hsl(0 0% 100%)';
    ctx.font = '700 56px Manrope, system-ui, sans-serif';
    ctx.fillText('My Health Journey', 150, 210);
    ctx.font = '500 30px Manrope, system-ui, sans-serif';
    ctx.fillText(`Generated ${format(new Date(), 'MMM d, yyyy')}`, 150, 264);

    const statCards = [
      { label: 'Day Streak', value: String(streak) },
      { label: 'Total Logs', value: String(totalLogs) },
      { label: 'Badges', value: String(earnedBadges.length) },
    ];

    statCards.forEach((stat, index) => {
      const x = 90 + index * 300;
      drawRoundedRect(ctx, x, 440, 280, 210, 32);
      ctx.fillStyle = 'hsl(0 0% 100% / 0.9)';
      ctx.fill();
      ctx.fillStyle = foreground;
      ctx.font = '800 58px Manrope, system-ui, sans-serif';
      ctx.fillText(stat.value, x + 30, 542);
      ctx.font = '600 26px Manrope, system-ui, sans-serif';
      ctx.fillStyle = mutedForeground;
      ctx.fillText(stat.label, x + 30, 598);
    });

    drawRoundedRect(ctx, 90, 700, 900, 470, 34);
    ctx.fillStyle = 'hsl(0 0% 100% / 0.85)';
    ctx.fill();

    ctx.fillStyle = foreground;
    ctx.font = '700 36px Manrope, system-ui, sans-serif';
    ctx.fillText('Recent Milestones', 130, 776);

    const milestoneLines = earnedBadges.length
      ? earnedBadges
          .slice(-5)
          .reverse()
          .map((badge, index) => `${index + 1}. ${badge.name}`)
      : ['1. Keep logging daily to unlock your first badge'];

    ctx.font = '500 28px Manrope, system-ui, sans-serif';
    ctx.fillStyle = mutedForeground;
    milestoneLines.forEach((line, index) => {
      ctx.fillText(line, 130, 850 + index * 62);
    });

    ctx.fillStyle = foreground;
    ctx.font = '700 28px Manrope, system-ui, sans-serif';
    ctx.fillText('Tracked with Jvala', 130, 1230);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
    if (!blob) throw new Error('image_generation_failed');

    return new File([blob], `Jvala-Journey-${format(new Date(), 'yyyyMMdd')}.png`, {
      type: 'image/png',
    });
  };

  const generateFHIRBundle = () => ({
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    meta: { profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'] },
    identifier: { system: 'urn:jvala:export', value: `JVALA-${Date.now()}` },
    entry: filteredEntries.map((entry) => ({
      fullUrl: `urn:uuid:${entry.id}`,
      resource: {
        resourceType: 'Observation',
        id: entry.id,
        status: 'final',
        category: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                code: 'survey',
                display: 'Survey',
              },
            ],
          },
        ],
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: entry.type === 'flare' ? '404684003' : '413350009',
              display: entry.type === 'flare' ? 'Clinical finding' : 'Finding',
            },
          ],
          text: `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Entry`,
        },
        subject: { reference: `Patient/${patientId}`, display: patientName },
        effectiveDateTime: new Date(entry.timestamp).toISOString(),
        component: [
          entry.severity && {
            code: { coding: [{ system: 'http://snomed.info/sct', code: '246112005', display: 'Severity' }] },
            valueString: entry.severity,
          },
          ...(entry.symptoms?.map((symptom) => ({
            code: { coding: [{ system: 'http://snomed.info/sct', code: '418799008', display: 'Symptom' }] },
            valueString: symptom,
          })) || []),
        ].filter(Boolean),
        note: entry.note ? [{ text: entry.note }] : undefined,
      },
    })),
  });

  const generateCCDSummary = () => {
    const severeCounts = filteredEntries.filter((e) => e.severity === 'severe').length;
    const moderateCounts = filteredEntries.filter((e) => e.severity === 'moderate').length;
    const mildCounts = filteredEntries.filter((e) => e.severity === 'mild').length;
    const allSymptoms: Record<string, number> = {};
    const allTriggers: Record<string, number> = {};

    filteredEntries.forEach((entry) => {
      entry.symptoms?.forEach((symptom) => {
        allSymptoms[symptom] = (allSymptoms[symptom] || 0) + 1;
      });
      entry.triggers?.forEach((trigger) => {
        allTriggers[trigger] = (allTriggers[trigger] || 0) + 1;
      });
    });

    return `CONTINUITY OF CARE DOCUMENT (CCD)\nHealth Summary Export from Jvala\nGenerated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}\nReport Period: Last ${dateRange} days\n\nSUMMARY STATISTICS\nTotal Episodes: ${filteredEntries.length}\nSevere: ${severeCounts} | Moderate: ${moderateCounts} | Mild: ${mildCounts}\n\nTOP SYMPTOMS\n${Object.entries(allSymptoms)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([symptom, count]) => `${symptom}: ${count}`)
      .join('\n')}\n\nTOP TRIGGERS\n${Object.entries(allTriggers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([trigger, count]) => `${trigger}: ${count}`)
      .join('\n') || 'None recorded'}\n\nDETAILED ENTRIES\n${filteredEntries
      .slice(0, 50)
      .map(
        (entry, index) =>
          `${index + 1}. ${format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm')} - ${entry.severity || entry.type}${
            entry.symptoms?.length ? ` [${entry.symptoms.join(', ')}]` : ''
          }${entry.note ? ` - ${entry.note}` : ''}`
      )
      .join('\n')}\n\nDocument ID: JVALA-CCD-${Date.now()}`;
  };

  const generateMedDRAExport = () => {
    const allSymptoms: Record<string, number> = {};
    filteredEntries.forEach((entry) => {
      entry.symptoms?.forEach((symptom) => {
        const normalized = symptom.toLowerCase();
        allSymptoms[normalized] = (allSymptoms[normalized] || 0) + 1;
      });
    });

    const rows = [
      ['MedDRA Code', 'Preferred Term', 'Patient Term', 'Frequency', 'Report Period'],
      ...Object.entries(allSymptoms).map(([symptom, count]) => {
        const meddra = MEDDRA_CODES[symptom] || { code: 'N/A', term: symptom };
        return [meddra.code, meddra.term, symptom, count.toString(), `Last ${dateRange} days`];
      }),
    ];

    return rows.map((row) => row.join(',')).join('\n');
  };

  const getExportData = () => {
    let content = '';
    let filename = '';
    let mimeType = '';

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
      case 'csv': {
        const headers = ['Date', 'Type', 'Severity', 'Symptoms', 'Triggers', 'Medications', 'Notes'];
        const rows = filteredEntries.map((entry) => [
          format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm'),
          entry.type,
          entry.severity || '',
          entry.symptoms?.join('; ') || '',
          entry.triggers?.join('; ') || '',
          entry.medications?.join('; ') || '',
          entry.note?.replace(/"/g, '""') || '',
        ]);
        content = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');
        filename = `Health-Data-${format(new Date(), 'yyyyMMdd')}.csv`;
        mimeType = 'text/csv';
        break;
      }
      case 'meddra':
        content = generateMedDRAExport();
        filename = `MedDRA-Export-${format(new Date(), 'yyyyMMdd')}.csv`;
        mimeType = 'text/csv';
        break;
      default:
        break;
    }

    return { content, filename, mimeType };
  };

  const handleShareJourney = async () => {
    haptics.medium();
    setGeneratingImage(true);

    try {
      const file = await buildJourneyImage();
      await nativeShare([file], 'My Health Journey', 'Shared from Jvala');
      haptics.success();
    } catch (error) {
      console.error('Journey share failed:', error);
      haptics.warning();
      toast({ title: "Couldn't generate image", description: 'Please try again.', variant: 'destructive' });
    } finally {
      setGeneratingImage(false);
    }
  };

  const handleShareClinical = async () => {
    haptics.medium();
    setSharingClinical(true);

    try {
      const { content, filename, mimeType } = getExportData();
      const blob = new Blob([content], { type: mimeType });
      const file = new File([blob], filename, { type: mimeType });
      await nativeShare([file], 'Jvala Health Export', `Health data export — ${filename}`);
      haptics.success();
    } catch (error) {
      console.error('Clinical share failed:', error);
      haptics.warning();
      toast({ title: 'Share failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSharingClinical(false);
    }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const thisWeekEntries = entries.filter((entry) => {
    const ts = new Date(entry.timestamp);
    return ts >= weekStart && ts <= weekEnd;
  });

  return (
    <div className="space-y-3 animate-fade-in" data-tour="exports-area">
      {thisWeekEntries.length >= 3 && (
        <Card className="glass-card border-0 rounded-3xl overflow-hidden border-l-4 border-l-primary/40">
          <div className="p-3.5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold">Weekly Digest Ready</p>
                  <p className="text-[10px] text-muted-foreground">
                    {format(weekStart, 'MMM d')} — {format(weekEnd, 'MMM d')}
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-primary/8 text-primary border-0">
                {thisWeekEntries.length} entries
              </Badge>
            </div>
          </div>
        </Card>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          haptics.selection();
          setActiveTab(value);
        }}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2 h-10 bg-card/80 backdrop-blur-sm">
          <TabsTrigger value="share" className="text-xs gap-1.5">
            <Share2 className="w-4 h-4" />
            Share Journey
          </TabsTrigger>
          <TabsTrigger value="clinical" className="text-xs gap-1.5">
            <Shield className="w-4 h-4" />
            Clinical Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="share" className="mt-3 space-y-3">
          <Card className="glass-card border-0 rounded-3xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Trophy className="w-3.5 h-3.5 text-primary" />
                    </div>
                    Your Health Journey
                  </h3>
                  <p className="text-[11px] text-muted-foreground ml-9">Generate and share an image snapshot.</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/8 text-primary border-0">
                  {streak} day streak
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { icon: Flame, value: streak, label: 'Streak' },
                  { icon: Sparkles, value: totalLogs, label: 'Logs' },
                  { icon: Trophy, value: earnedBadges.length, label: 'Badges' },
                ].map((stat) => (
                  <div key={stat.label} className="glass-card text-center py-2.5 rounded-2xl">
                    <stat.icon className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                    <p className="text-lg font-extrabold leading-none">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-none">{stat.label}</p>
                  </div>
                ))}
              </div>

              {earnedBadges.length > 0 && (
                <div className="mb-4">
                  <p className="text-[11px] text-muted-foreground mb-2 font-medium">Recent Badges</p>
                  <div className="grid grid-cols-2 gap-2">
                    {earnedBadges.slice(-4).reverse().map((badge) => (
                      <div key={badge.id} className="glass-card rounded-xl px-2.5 py-2 flex items-center gap-2">
                        <Trophy className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[11px] font-medium truncate">{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={handleShareJourney}
                className="w-full h-11 rounded-xl font-semibold"
                size="sm"
                disabled={generatingImage}
              >
                {generatingImage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                Share Image
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="clinical" className="mt-3 space-y-3">
          <Card className="glass-card border-0 rounded-3xl overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                    </div>
                    Medical Export
                  </h3>
                  <p className="text-[11px] text-muted-foreground ml-9">Share clinical files with providers.</p>
                </div>
                <Badge variant="secondary" className="text-[10px] bg-primary/8 text-primary border-0">
                  Clinical Grade
                </Badge>
              </div>

              <div className="space-y-1.5 mb-4">
                <Label className="text-xs font-medium">Date Range</Label>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="h-10 rounded-xl glass-card border-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="365">Last year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">{filteredEntries.length} entries included</p>
              </div>

              <div className="space-y-1.5 mb-4">
                <Label className="text-xs font-medium">Export Format</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_FORMATS.map((formatOption) => (
                    <button
                      key={formatOption.id}
                      onClick={() => {
                        haptics.selection();
                        setSelectedFormat(formatOption.id);
                      }}
                      className={cn(
                        'p-3 rounded-xl text-left transition-all press-effect border',
                        selectedFormat === formatOption.id
                          ? 'glass-card border-primary/40 bg-primary/12 ring-1 ring-primary/30'
                          : 'glass-card border-border/30 hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <formatOption.icon className={cn('w-4 h-4', selectedFormat === formatOption.id ? 'text-primary' : 'text-muted-foreground')} />
                          <span className="text-xs font-bold">{formatOption.label}</span>
                        </div>
                        {selectedFormat === formatOption.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{formatOption.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleShareClinical}
                className="w-full h-11 rounded-xl font-semibold"
                size="sm"
                disabled={sharingClinical}
              >
                {sharingClinical ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4 mr-2" />
                )}
                Share Export
              </Button>

              <div className="flex flex-wrap gap-1.5 pt-3 mt-3 border-t border-border/20">
                {['HL7 FHIR R4', 'MedDRA', '21 CFR 11'].map((standard) => (
                  <Badge key={standard} variant="outline" className="text-[9px] px-2 py-0.5 rounded-full border-border/30">
                    {standard}
                  </Badge>
                ))}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
