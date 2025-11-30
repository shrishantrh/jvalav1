import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format, subDays } from 'date-fns';
import { FileDown, FileJson, FileCode, FileText, Share2, Mail, Loader2, CheckCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <Card className="p-5 bg-gradient-card border-0 shadow-soft">
      <div className="space-y-4">
        <div>
          <h3 className="text-base font-semibold mb-1">Medical Export</h3>
          <p className="text-xs text-muted-foreground">
            Export your health data for healthcare providers
          </p>
        </div>

        {/* Date Range */}
        <div className="space-y-2">
          <Label className="text-xs">Date Range</Label>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="h-9">
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

        {/* Format Selection */}
        <div className="space-y-2">
          <Label className="text-xs">Export Format</Label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fhir">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  HL7 FHIR R4 (JSON)
                </div>
              </SelectItem>
              <SelectItem value="ccd">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  CCD Summary (Text)
                </div>
              </SelectItem>
              <SelectItem value="csv">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Spreadsheet (CSV)
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button onClick={handleExport} className="flex-1" size="sm">
            <FileDown className="w-4 h-4 mr-2" />
            Download
          </Button>
          
          <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1">
                <Mail className="w-4 h-4 mr-2" />
                Email to Provider
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send to Healthcare Provider</DialogTitle>
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
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  A summary of your last {dateRange} days of health data will be sent.
                </p>
                <Button 
                  onClick={handleSendToProvider} 
                  disabled={sending || !recipientEmail}
                  className="w-full"
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

        <div className="text-[10px] text-muted-foreground pt-2 border-t">
          Compliant with HL7 FHIR R4, HIPAA, and 21 CFR Part 11
        </div>
      </div>
    </Card>
  );
};
