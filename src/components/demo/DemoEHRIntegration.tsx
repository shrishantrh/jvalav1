import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Hospital, Shield, FileText, Pill, AlertTriangle, 
  Activity, Check, ChevronRight, Download, RefreshCw
} from "lucide-react";
import { MockEHRData, generateMockEHRData } from "@/services/mockWearableData";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DemoEHRIntegrationProps {
  onViewFull?: () => void;
}

export const DemoEHRIntegration = ({ onViewFull }: DemoEHRIntegrationProps) => {
  const [isConnected, setIsConnected] = useState(true);
  const [lastSync] = useState(new Date());
  const [ehrData] = useState<MockEHRData>(generateMockEHRData);
  const [activeTab, setActiveTab] = useState('diagnoses');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'resolved': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'normal': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'low': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'severe': return 'bg-red-100 text-red-700 border-red-200';
      case 'moderate': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'mild': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="bg-card border border-border/80 shadow-soft overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Hospital className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Electronic Health Records</CardTitle>
              <p className="text-xs text-muted-foreground">
                Connected via Epic MyChart
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            ) : (
              <Button size="sm" onClick={() => setIsConnected(true)}>
                Connect
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Privacy Notice */}
        <div className="flex items-start gap-2 p-3 bg-primary/5 border-b border-border/50">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium text-foreground">HIPAA-Compliant Data Transfer</p>
            <p className="text-muted-foreground">
              Last synced: {format(lastSync, 'MMM d, yyyy h:mm a')}
            </p>
          </div>
        </div>

        <div className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-5 h-9">
              <TabsTrigger value="diagnoses" className="text-xs px-2">
                <FileText className="w-3 h-3 mr-1 hidden sm:block" />
                Dx
              </TabsTrigger>
              <TabsTrigger value="medications" className="text-xs px-2">
                <Pill className="w-3 h-3 mr-1 hidden sm:block" />
                Meds
              </TabsTrigger>
              <TabsTrigger value="allergies" className="text-xs px-2">
                <AlertTriangle className="w-3 h-3 mr-1 hidden sm:block" />
                Allergy
              </TabsTrigger>
              <TabsTrigger value="labs" className="text-xs px-2">
                <Activity className="w-3 h-3 mr-1 hidden sm:block" />
                Labs
              </TabsTrigger>
              <TabsTrigger value="vitals" className="text-xs px-2">
                <Activity className="w-3 h-3 mr-1 hidden sm:block" />
                Vitals
              </TabsTrigger>
            </TabsList>

            <TabsContent value="diagnoses" className="mt-4 space-y-2">
              {ehrData.diagnoses.map((dx, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{dx.name}</p>
                      <p className="text-xs text-muted-foreground">ICD-10: {dx.code}</p>
                    </div>
                    <Badge className={cn("text-[10px]", getStatusColor(dx.status))}>
                      {dx.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Diagnosed: {format(new Date(dx.date), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="medications" className="mt-4 space-y-2">
              {ehrData.medications.map((med, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{med.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {med.dosage} • {med.frequency}
                      </p>
                    </div>
                    <Badge className="text-[10px] bg-blue-100 text-blue-700">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Prescribed by {med.prescriber} on {format(new Date(med.prescribedDate), 'MMM d, yyyy')}
                  </p>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="allergies" className="mt-4 space-y-2">
              {ehrData.allergies.map((allergy, i) => (
                <div key={i} className="p-3 rounded-lg bg-red-50/50 border border-red-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm text-red-900">{allergy.allergen}</p>
                      <p className="text-xs text-red-700">Reaction: {allergy.reaction}</p>
                    </div>
                    <Badge className={cn("text-[10px]", getSeverityColor(allergy.severity))}>
                      {allergy.severity}
                    </Badge>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="labs" className="mt-4 space-y-2">
              {ehrData.labResults.map((lab, i) => (
                <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-sm">{lab.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(lab.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-sm">
                        {lab.value} {lab.unit}
                      </span>
                      <Badge className={cn("text-[10px] ml-2", getStatusColor(lab.status))}>
                        {lab.status}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="vitals" className="mt-4">
              <div className="grid grid-cols-2 gap-2">
                {ehrData.vitals.map((vital, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/50 text-center">
                    <p className="text-xs text-muted-foreground">{vital.type}</p>
                    <p className="font-semibold text-lg">
                      {vital.value}
                      {vital.unit && <span className="text-xs text-muted-foreground ml-1">{vital.unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Actions */}
        <div className="p-3 border-t border-border/50 bg-muted/20 flex items-center justify-between">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <RefreshCw className="w-3 h-3" />
            Sync Records
          </Button>
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            <Download className="w-3 h-3" />
            Export FHIR
          </Button>
          {onViewFull && (
            <Button variant="default" size="sm" onClick={onViewFull} className="text-xs gap-1">
              View Full
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
