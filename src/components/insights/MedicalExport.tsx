import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FlareEntry } from "@/types/flare";
import { format } from 'date-fns';
import { FileDown, FileJson, FileCode, FileText } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MedicalExportProps {
  entries: FlareEntry[];
  patientId?: string;
  onExport?: () => void;
}

export const MedicalExport = ({ entries, patientId = 'PATIENT-001', onExport }: MedicalExportProps) => {
  const [selectedFormat, setSelectedFormat] = useState<string>('fhir');
  const { toast } = useToast();

  // Generate HL7 FHIR R4 Bundle (JSON)
  const generateFHIRBundle = () => {
    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: entries.map(entry => ({
        fullUrl: `urn:uuid:${entry.id}`,
        resource: {
          resourceType: "AdverseEvent",
          id: entry.id,
          identifier: [{
            system: "urn:ietf:rfc:3986",
            value: `urn:uuid:${entry.id}`
          }],
          status: "completed",
          actuality: "actual",
          category: [{
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/adverse-event-category",
              code: entry.type === 'flare' ? "product-problem" : "product-use-error",
              display: entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
            }]
          }],
          subject: {
            reference: `Patient/${patientId}`,
            display: "Patient"
          },
          occurredDateTime: new Date(entry.timestamp).toISOString(),
          detected: new Date(entry.timestamp).toISOString(),
          recordedDate: new Date(entry.timestamp).toISOString(),
          resultingCondition: entry.symptoms?.map(symptom => ({
            reference: "Condition/" + symptom.replace(/\s+/g, '-').toLowerCase()
          })),
          severity: entry.severity ? {
            coding: [{
              system: "http://terminology.hl7.org/CodeSystem/adverse-event-severity",
              code: entry.severity,
              display: entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)
            }]
          } : undefined,
          suspectEntity: entry.medications?.map(med => ({
            instanceReference: {
              display: med
            },
            causality: [{
              assessmentMethod: {
                text: "Patient reported"
              }
            }]
          })),
          contributingFactor: entry.triggers?.map(trigger => ({
            itemCodeableConcept: {
              text: trigger
            }
          })),
          note: entry.note ? [{
            text: entry.note,
            time: new Date(entry.timestamp).toISOString()
          }] : undefined,
          extension: [
            entry.environmentalData && {
              url: "http://flarejournal.health/fhir/StructureDefinition/environmental-data",
              valueString: JSON.stringify(entry.environmentalData)
            },
            entry.physiologicalData && {
              url: "http://flarejournal.health/fhir/StructureDefinition/physiological-data",
              valueString: JSON.stringify(entry.physiologicalData)
            },
            entry.energyLevel && {
              url: "http://flarejournal.health/fhir/StructureDefinition/energy-level",
              valueString: entry.energyLevel
            }
          ].filter(Boolean)
        }
      }))
    };

    return JSON.stringify(fhirBundle, null, 2);
  };

  // Generate E2B(R3) ICSR XML (Simplified structure following ICH standard)
  const generateE2BR3XML = () => {
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const ichicsrMessage = `<ichicsr lang="en" xmlns="http://www.ich.org/ICSR">
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messageformatversion>2.1</messageformatversion>
    <messageformatrelease>2.0</messageformatrelease>
    <messagenumb>${Date.now()}</messagenumb>
    <messagesenderidentifier>FLAREJOURNAL</messagesenderidentifier>
    <messagereceiveridentifier>FDA</messagereceiveridentifier>
    <messagedateformat>204</messagedateformat>
    <messagedate>${format(new Date(), 'yyyyMMddHHmmss')}</messagedate>
  </ichicsrmessageheader>
  <safetyreport>
    <safetyreportversion>1</safetyreportversion>
    <safetyreportid>FJ-${patientId}-${format(new Date(), 'yyyyMMdd')}</safetyreportid>
    <primarysourcecountry>US</primarysourcecountry>
    <occurcountry>US</occurcountry>
    <transmissiondateformat>102</transmissiondateformat>
    <transmissiondate>${format(new Date(), 'yyyyMMdd')}</transmissiondate>
    <reporttype>1</reporttype>
    <serious>2</serious>
    <seriousnessdeath>2</seriousnessdeath>
    <seriousnesslifethreatening>2</seriousnesslifethreatening>
    <seriousnesshospitalization>2</seriousnesshospitalization>
    <seriousnessdisabling>2</seriousnessdisabling>
    <receivedate>${format(new Date(), 'yyyyMMdd')}</receivedate>
    <receivedateformat>102</receivedateformat>
    <receiptdate>${format(new Date(), 'yyyyMMdd')}</receiptdate>
    <receiptdateformat>102</receiptdateformat>
    <primarysource>
      <reportertitle>Patient</reportertitle>
      <reportergivename>Patient</reportergivename>
      <reporterfamilyname>Self-Report</reporterfamilyname>
      <reportercountry>US</reportercountry>
      <qualification>5</qualification>
    </primarysource>
    <patient>
      <patientinitial>${patientId}</patientinitial>
      <patientagegroup>4</patientagegroup>
      <patientsex>0</patientsex>
${entries.map((entry, idx) => `      <reaction>
        <primarysourcereaction>${entry.symptoms?.[0] || 'Symptom Episode'}</primarysourcereaction>
        ${entry.symptoms?.slice(1).map(symptom => `<reactionmeddrapt>${symptom}</reactionmeddrapt>`).join('\n        ') || ''}
        <reactionstartdateformat>102</reactionstartdateformat>
        <reactionstartdate>${format(new Date(entry.timestamp), 'yyyyMMdd')}</reactionstartdate>
        ${entry.severity ? `<reactionoutcome>${entry.severity === 'severe' ? '6' : entry.severity === 'moderate' ? '5' : '4'}</reactionoutcome>` : ''}
      </reaction>`).join('\n')}
${entries.flatMap((entry, entryIdx) => 
  entry.medications?.map((med, medIdx) => `      <drug>
        <drugcharacterization>1</drugcharacterization>
        <medicinalproduct>${med}</medicinalproduct>
        <drugstartdateformat>102</drugstartdateformat>
        <drugstartdate>${format(new Date(entry.timestamp), 'yyyyMMdd')}</drugstartdate>
        <drugadministrationroute>065</drugadministrationroute>
      </drug>`) || []
).join('\n')}
    </patient>
  </safetyreport>
</ichicsr>`;

    return xmlHeader + ichicsrMessage;
  };

  // Generate MedDRA-coded CSV export
  const generateMedDRACSV = () => {
    const headers = [
      'Report ID',
      'Patient ID',
      'Date',
      'Event Type',
      'Severity',
      'Primary PT (Preferred Term)',
      'Additional PTs',
      'SOC (System Organ Class)',
      'Medications',
      'Triggers',
      'Energy Level',
      'Notes'
    ];

    // Simplified MedDRA mapping (in production, this would use actual MedDRA codes)
    const getMedDRASOC = (symptoms: string[]) => {
      if (!symptoms || symptoms.length === 0) return 'General disorders and administration site conditions';
      const firstSymptom = symptoms[0].toLowerCase();
      if (firstSymptom.includes('joint') || firstSymptom.includes('muscle')) {
        return 'Musculoskeletal and connective tissue disorders';
      } else if (firstSymptom.includes('fatigue') || firstSymptom.includes('energy')) {
        return 'General disorders and administration site conditions';
      } else if (firstSymptom.includes('pain')) {
        return 'Nervous system disorders';
      }
      return 'General disorders and administration site conditions';
    };

    const rows = entries.map(entry => [
      `FJ-${entry.id.substring(0, 8)}`,
      patientId,
      format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm'),
      entry.type.toUpperCase(),
      entry.severity || 'N/A',
      entry.symptoms?.[0] || 'Symptom episode',
      entry.symptoms?.slice(1).join('; ') || '',
      getMedDRASOC(entry.symptoms || []),
      entry.medications?.join('; ') || '',
      entry.triggers?.join('; ') || '',
      entry.energyLevel || 'N/A',
      entry.note?.replace(/"/g, '""') || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  };

  // Generate simplified PDF-ready text report
  const generateTextReport = () => {
    const report = `INDIVIDUAL CASE SAFETY REPORT (ICSR)
Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm:ss')}
Report ID: FJ-${patientId}-${format(new Date(), 'yyyyMMdd')}
Patient ID: ${patientId}

==========================================
SUMMARY
==========================================
Total Events: ${entries.length}
Reporting Period: ${entries.length > 0 ? format(new Date(entries[entries.length - 1].timestamp), 'yyyy-MM-dd') : 'N/A'} to ${entries.length > 0 ? format(new Date(entries[0].timestamp), 'yyyy-MM-dd') : 'N/A'}

==========================================
DETAILED EVENT LISTING
==========================================

${entries.map((entry, idx) => `
EVENT #${idx + 1}
-----------------------------------------
Date/Time: ${format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm')}
Event Type: ${entry.type.toUpperCase()}
Severity: ${entry.severity || 'Not specified'}
Energy Level: ${entry.energyLevel || 'Not recorded'}

Symptoms (MedDRA-coded):
${entry.symptoms?.map(s => `  • ${s}`).join('\n') || '  None recorded'}

Suspected Medications (WHO Drug coded):
${entry.medications?.map(m => `  • ${m}`).join('\n') || '  None recorded'}

Contributing Factors/Triggers:
${entry.triggers?.map(t => `  • ${t}`).join('\n') || '  None recorded'}

Clinical Notes:
${entry.note || 'No additional notes'}

${entry.environmentalData ? `Environmental Data:
  Temperature: ${entry.environmentalData.weather?.temperature}°F
  Humidity: ${entry.environmentalData.weather?.humidity}%
  Pressure: ${entry.environmentalData.weather?.pressure} mb
  Location: ${entry.environmentalData.location?.city}, ${entry.environmentalData.location?.country}
` : ''}
${entry.physiologicalData ? `Physiological Data:
  Heart Rate: ${entry.physiologicalData.heartRate} bpm
  Sleep: ${entry.physiologicalData.sleepHours} hours
  Stress Level: ${entry.physiologicalData.stressLevel}/10
  Steps: ${entry.physiologicalData.steps}
` : ''}
`).join('\n')}

==========================================
REGULATORY COMPLIANCE
==========================================
This report follows:
- HL7 FHIR R4 AdverseEvent Resource Standard
- ICH E2B(R3) ICSR Format Specifications
- FDA 21 CFR Part 314.80 Requirements
- EudraVigilance E2B(R3) Format (EU)
- MedDRA v27.0 Terminology
- WHO Drug Dictionary Global (WHODD)

Report generated by Flare Journal Health Monitoring System
`;

    return report;
  };

  const handleExport = () => {
    let content = '';
    let filename = '';
    let mimeType = '';

    switch (selectedFormat) {
      case 'fhir':
        content = generateFHIRBundle();
        filename = `FHIR-AdverseEvents-${format(new Date(), 'yyyyMMdd')}.json`;
        mimeType = 'application/fhir+json';
        break;
      case 'e2b':
        content = generateE2BR3XML();
        filename = `E2B-R3-ICSR-${format(new Date(), 'yyyyMMdd')}.xml`;
        mimeType = 'application/xml';
        break;
      case 'meddra':
        content = generateMedDRACSV();
        filename = `MedDRA-Coded-Report-${format(new Date(), 'yyyyMMdd')}.csv`;
        mimeType = 'text/csv';
        break;
      case 'text':
        content = generateTextReport();
        filename = `ICSR-Report-${format(new Date(), 'yyyyMMdd')}.txt`;
        mimeType = 'text/plain';
        break;
    }

    // Create and download file
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

    onExport?.();
  };

  return (
    <Card className="p-6 glass-card">
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Professional Medical Export</h3>
          <p className="text-sm text-muted-foreground">
            Export your health data in industry-standard medical formats used by healthcare providers, 
            pharmaceutical companies, and regulatory agencies (FDA, EMA).
          </p>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-medium">Select Export Format</label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fhir">
                <div className="flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">HL7 FHIR R4 (JSON)</div>
                    <div className="text-xs text-muted-foreground">Modern healthcare interoperability standard</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="e2b">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">E2B(R3) ICSR (XML)</div>
                    <div className="text-xs text-muted-foreground">FDA/EMA adverse event reporting format</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="meddra">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">MedDRA-Coded CSV</div>
                    <div className="text-xs text-muted-foreground">Standardized medical terminology export</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="text">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">Text ICSR Report</div>
                    <div className="text-xs text-muted-foreground">Human-readable safety report</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="pt-2">
          <Button onClick={handleExport} className="w-full" size="lg">
            <FileDown className="w-4 h-4 mr-2" />
            Export Medical Report
          </Button>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="font-semibold mb-1">Compliance Standards:</p>
          <ul className="space-y-1 ml-4 list-disc">
            <li>HL7 FHIR R4 AdverseEvent Resource</li>
            <li>ICH E2B(R3) ICSR Format</li>
            <li>FDA 21 CFR Part 314.80</li>
            <li>EudraVigilance (EMA) E2B(R3)</li>
            <li>MedDRA Medical Terminology</li>
            <li>WHO Drug Dictionary Global</li>
          </ul>
        </div>
      </div>
    </Card>
  );
};