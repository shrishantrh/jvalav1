import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlareEntry } from "@/types/flare";
import { PremiumInsightsCharts } from "@/components/insights/PremiumInsightsCharts";
import { EnhancedMedicalExport } from "@/components/insights/EnhancedMedicalExport";
import { UsefulInsights } from "@/components/insights/UsefulInsights";
import { CommunityHotspots } from "@/components/insights/CommunityHotspots";
import { UserFlareMap } from "@/components/insights/UserFlareMap";
import {
  BarChart3,
  Download,
  Brain,
  MapPin,
  Sparkles
} from 'lucide-react';
import { useAuth } from "@/hooks/useAuth";

interface MedicationLog {
  id: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  takenAt: Date;
}

interface RevampedInsightsProps {
  entries: FlareEntry[];
  userConditions?: string[];
  medicationLogs?: MedicationLog[];
  onLogMedication?: (log: Omit<MedicationLog, 'id' | 'takenAt'>) => void;
  userMedications?: string[];
  onStartProtocol?: (recommendation: string) => void;
  onAskAI?: (prompt: string) => void;
}

export const RevampedInsights = ({ 
  entries, 
  userConditions = [], 
  medicationLogs = [], 
  onLogMedication, 
  userMedications = [],
  onStartProtocol,
  onAskAI
}: RevampedInsightsProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('ai');

  if (entries.length === 0) {
    return (
      <Card className="p-6 text-center glass-card">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-medium mb-1">No data yet</h3>
        <p className="text-xs text-muted-foreground">Start logging to see your insights</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-9">
          <TabsTrigger value="ai" className="text-[10px] gap-1">
            <Brain className="w-3 h-3" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-[10px] gap-1">
            <BarChart3 className="w-3 h-3" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="local" className="text-[10px] gap-1">
            <MapPin className="w-3 h-3" />
            Map
          </TabsTrigger>
          <TabsTrigger value="export" className="text-[10px] gap-1">
            <Download className="w-3 h-3" />
            Export
          </TabsTrigger>
        </TabsList>

        <div className="mt-3">
          <TabsContent value="ai" className="mt-0">
            <UsefulInsights 
              entries={entries} 
              userConditions={userConditions} 
              onAskAI={onAskAI || onStartProtocol}
            />
          </TabsContent>

          <TabsContent value="charts" className="mt-0">
            <PremiumInsightsCharts entries={entries} />
          </TabsContent>

          <TabsContent value="local" className="mt-0">
            <div className="space-y-4">
              <UserFlareMap entries={entries} />
              <CommunityHotspots entries={entries} userConditions={userConditions} />
            </div>
          </TabsContent>

          <TabsContent value="export" className="mt-0">
            <EnhancedMedicalExport entries={entries} conditions={userConditions} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
