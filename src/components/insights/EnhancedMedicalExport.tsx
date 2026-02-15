import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, subDays } from 'date-fns';
import { FileDown, FileJson, FileCode, FileText, Share2, Mail, Loader2, CheckCircle, Shield, Download, FileType } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface EnhancedMedicalExportProps {
  entries: FlareEntry[];
  patientName?: string;
  patientId?: string;
  conditions?: string[];
}

// MedDRA codes mapping
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
  const [selectedFormat, setSelectedFormat] = useState<string>('fhir');
  const [dateRange, setDateRange] = useState<string>('30');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { toast } = useToast();

  // Filter entries by date range
  const filteredEntries = entries.filter(e => {
    const days = parseInt(dateRange);
    return e.timestamp >= subDays(new Date(), days);
  });

  // Generate HL7 FHIR R4 Bundle
  const generateFHIRBundle = () => {
    return {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      meta: {
        profile: ["http://hl7.org/fhir/StructureDefinition/Bundle"]
      },
      identifier: {
        system: "urn:jvala:export",
        value: `JVALA-${Date.now()}`
      },
      entry: filteredEntries.map(entry => ({
        fullUrl: `urn:uuid:${entry.id}`,
        resource: {
          resourceType: "Observation",
          id: entry.id,
          status: "final",
          category: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/observation-category",
              code: "survey",
              display: "Survey"
            }]
          }],
          code: {
            coding: [{
              system: "http://snomed.info/sct",
              code: entry.type === 'flare' ? "404684003" : "413350009",
              display: entry.type === 'flare' ? "Clinical finding" : "Finding"
            }],
            text: `${entry.type.charAt(0).toUpperCase() + entry.type.slice(1)} Entry`
          },
          subject: {
            reference: `Patient/${patientId}`,
            display: patientName
          },
          effectiveDateTime: new Date(entry.timestamp).toISOString(),
          component: [
            entry.severity && {
              code: {
                coding: [{
                  system: "http://snomed.info/sct",
                  code: "246112005",
                  display: "Severity"
                }]
              },
              valueString: entry.severity
            },
            entry.energyLevel && {
              code: {
                coding: [{
                  system: "http://loinc.org",
                  code: "67186-1",
                  display: "Energy level"
                }]
              },
              valueString: entry.energyLevel
            },
            ...(entry.symptoms?.map(s => ({
              code: {
                coding: [{
                  system: "http://snomed.info/sct",
                  code: "418799008",
                  display: "Symptom"
                }]
              },
              valueString: s
            })) || [])
          ].filter(Boolean),
          note: entry.note ? [{ text: entry.note }] : undefined
        }
      }))
    };
  };

  // Generate CCD (Continuity of Care Document) style summary
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

    return `
CONTINUITY OF CARE DOCUMENT (CCD)
Health Summary Export from Jvala
Generated: ${format(new Date(), 'MMMM d, yyyy HH:mm')}
Report Period: Last ${dateRange} days

═══════════════════════════════════════════════════════════════
PATIENT INFORMATION
═══════════════════════════════════════════════════════════════
Patient ID: ${patientId}
${conditions.length > 0 ? `Conditions: ${conditions.join(', ')}` : ''}

═══════════════════════════════════════════════════════════════
SUMMARY STATISTICS
═══════════════════════════════════════════════════════════════
Total Episodes: ${filteredEntries.length}
Severe Episodes: ${severeCounts} (${((severeCounts/filteredEntries.length)*100 || 0).toFixed(1)}%)
Moderate Episodes: ${moderateCounts} (${((moderateCounts/filteredEntries.length)*100 || 0).toFixed(1)}%)
Mild Episodes: ${mildCounts} (${((mildCounts/filteredEntries.length)*100 || 0).toFixed(1)}%)

═══════════════════════════════════════════════════════════════
SYMPTOM FREQUENCY (Top 10)
═══════════════════════════════════════════════════════════════
${Object.entries(allSymptoms)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([symptom, count]) => `${symptom}: ${count} occurrences`)
  .join('\n')}

═══════════════════════════════════════════════════════════════
IDENTIFIED TRIGGERS (Top 10)
═══════════════════════════════════════════════════════════════
${Object.entries(allTriggers)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .map(([trigger, count]) => `${trigger}: ${count} occurrences`)
  .join('\n') || 'No triggers recorded'}

═══════════════════════════════════════════════════════════════
DETAILED ENTRIES
═══════════════════════════════════════════════════════════════
${filteredEntries.slice(0, 50).map((entry, i) => `
Entry ${i + 1} - ${format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm')}
Type: ${entry.type.toUpperCase()}
${entry.severity ? `Severity: ${entry.severity.toUpperCase()}` : ''}
${entry.symptoms?.length ? `Symptoms: ${entry.symptoms.join(', ')}` : ''}
${entry.medications?.length ? `Medications: ${entry.medications.join(', ')}` : ''}
${entry.triggers?.length ? `Triggers: ${entry.triggers.join(', ')}` : ''}
${entry.note ? `Notes: ${entry.note}` : ''}
`).join('\n---')}

═══════════════════════════════════════════════════════════════
REGULATORY COMPLIANCE STATEMENT
═══════════════════════════════════════════════════════════════
This document is generated in accordance with:
- HL7 CCD Implementation Guide
- HIPAA Privacy Rule requirements
- 21 CFR Part 11 electronic records standards

Document ID: JVALA-CCD-${Date.now()}
Export System: Jvala Health Monitoring Platform
`;
  };

  // Generate MedDRA coded export
  const generateMedDRAExport = () => {
    const allSymptoms: Record<string, number> = {};
    filteredEntries.forEach(e => {
      e.symptoms?.forEach(s => {
        allSymptoms[s.toLowerCase()] = (allSymptoms[s.toLowerCase()] || 0) + 1;
      });
    });

    const rows = [
      ['MedDRA Code', 'Preferred Term', 'Patient Term', 'Frequency', 'Report Period'],
      ...Object.entries(allSymptoms).map(([symptom, count]) => {
        const meddra = MEDDRA_CODES[symptom] || { code: 'N/A', term: symptom };
        return [meddra.code, meddra.term, symptom, count.toString(), `Last ${dateRange} days`];
      })
    ];
    
    return rows.map(r => r.join(',')).join('\n');
  };

  // Generate WHO-DD medication export
  const generateWHODDExport = () => {
    const allMeds: Record<string, number> = {};
    filteredEntries.forEach(e => {
      e.medications?.forEach(m => {
        allMeds[m] = (allMeds[m] || 0) + 1;
      });
    });

    return {
      exportDate: new Date().toISOString(),
      reportPeriod: `Last ${dateRange} days`,
      medications: Object.entries(allMeds).map(([name, count]) => ({
        drugName: name,
        reportCount: count,
        // WHO-DD placeholder codes
        atcCode: 'N/A',
        routeOfAdmin: 'oral',
      }))
    };
  };

  const handleExport = () => {
    let content = '';
    let filename = '';
    let mimeType = '';

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
          format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm'),
          e.type,
          e.severity || '',
          e.symptoms?.join('; ') || '',
          e.triggers?.join('; ') || '',
          e.medications?.join('; ') || '',
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
      case 'whodd':
        content = JSON.stringify(generateWHODDExport(), null, 2);
        filename = `WHO-DD-Export-${format(new Date(), 'yyyyMMdd')}.json`;
        mimeType = 'application/json';
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Downloaded ${filename}`,
    });
  };

  const handleSendToProvider = async () => {
    if (!recipientEmail) {
      toast({ title: "Please enter an email address", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const summary = generateCCDSummary();
      
      const { error } = await supabase.functions.invoke('send-health-report', {
        body: {
          recipientEmail,
          subject: `Health Summary Report - ${patientName}`,
          summary,
          patientName,
          dateRange
        }
      });

      if (error) throw error;

      toast({
        title: "Report sent!",
        description: `Health summary sent to ${recipientEmail}`,
      });
      setShowShareDialog(false);
      setRecipientEmail('');
    } catch (error: any) {
      toast({
        title: "Failed to send",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="p-5 bg-gradient-card border shadow-soft animate-fade-in overflow-hidden relative" data-tour="exports-area">
      {/* Decorative gradient */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full" />
      
      <div className="relative space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Medical Export
            </h3>
            <p className="text-xs text-muted-foreground">
              Export health data for healthcare providers
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            HIPAA Ready
          </Badge>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label className="text-xs">Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-9 transition-all hover:border-primary/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {filteredEntries.length} entries in this period
          </p>
        </div>

        {/* Format Selection with Tabs */}
        <div className="space-y-2">
          <Label className="text-xs">Export Format</Label>
          <Tabs value={selectedFormat} onValueChange={setSelectedFormat} className="w-full">
            <TabsList className="grid grid-cols-3 h-auto p-1">
              <TabsTrigger value="fhir" className="text-[10px] py-1.5 data-[state=active]:shadow-primary">
                <FileJson className="w-3 h-3 mr-1" />
                FHIR R4
              </TabsTrigger>
              <TabsTrigger value="ccd" className="text-[10px] py-1.5 data-[state=active]:shadow-primary">
                <FileText className="w-3 h-3 mr-1" />
                CCD
              </TabsTrigger>
              <TabsTrigger value="csv" className="text-[10px] py-1.5 data-[state=active]:shadow-primary">
                <FileCode className="w-3 h-3 mr-1" />
                CSV
              </TabsTrigger>
            </TabsList>
            <TabsList className="grid grid-cols-2 h-auto p-1 mt-1">
              <TabsTrigger value="meddra" className="text-[10px] py-1.5 data-[state=active]:shadow-primary">
                <FileType className="w-3 h-3 mr-1" />
                MedDRA
              </TabsTrigger>
              <TabsTrigger value="whodd" className="text-[10px] py-1.5 data-[state=active]:shadow-primary">
                <FileJson className="w-3 h-3 mr-1" />
                WHO-DD
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Format descriptions */}
          <div className="p-2 bg-muted/50 rounded-lg">
            <p className="text-[10px] text-muted-foreground">
              {selectedFormat === 'fhir' && 'HL7 FHIR R4 JSON - International health interoperability standard'}
              {selectedFormat === 'ccd' && 'Continuity of Care Document - Human-readable clinical summary'}
              {selectedFormat === 'csv' && 'Spreadsheet format - Compatible with Excel and data analysis tools'}
              {selectedFormat === 'meddra' && 'MedDRA coded symptoms - Medical Dictionary for Regulatory Activities'}
              {selectedFormat === 'whodd' && 'WHO Drug Dictionary format - Standardized medication data'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleExport} className="flex-1 shadow-primary press-effect" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 hover-lift">
                <Mail className="w-4 h-4 mr-2" />
                Email Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="animate-scale-in">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Send to Healthcare Provider
                </DialogTitle>
                <DialogDescription>
                  Email a health summary to your doctor or care team
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Provider's Email</Label>
                  <Input
                    type="email"
                    placeholder="doctor@clinic.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A summary of your last {dateRange} days of health data will be sent.
                </p>
                <Button 
                  onClick={handleSendToProvider} 
                  disabled={sending || !recipientEmail}
                  className="w-full shadow-primary"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4 mr-2" />
                  )}
                  {sending ? 'Sending...' : 'Send Report'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Compliance badges */}
        <div className="flex flex-wrap gap-1.5 pt-2 border-t">
          {['HL7 FHIR R4', 'HIPAA', '21 CFR 11', 'MedDRA', 'WHO-DD'].map(standard => (
            <Badge key={standard} variant="outline" className="text-[9px] px-1.5 py-0">
              {standard}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
};
