import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlareEntry } from "@/types/flare";
import { PremiumInsightsCharts } from "@/components/insights/PremiumInsightsCharts";
import { CleanInsights } from "@/components/insights/CleanInsights";
import { CommunityHotspots } from "@/components/insights/CommunityHotspots";
import { UserFlareMap } from "@/components/insights/UserFlareMap";
import { PharmacovigilanceDashboard } from "@/components/pharmacovigilance/PharmacovigilanceDashboard";
import {
  BarChart3,
  Brain,
  MapPin,
  Shield,
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
      <Card className="p-6 text-center bg-card/80 backdrop-blur-sm border-border/50">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h3 className="text-base font-medium mb-1">No data yet</h3>
        <p className="text-sm text-muted-foreground">Start logging to see your insights</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tabs - now 3 tabs without Export */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList data-tour="trends-area" className="grid w-full grid-cols-4 h-10 bg-card/80 backdrop-blur-sm">
          <TabsTrigger value="ai" className="text-xs gap-1.5">
            <Brain className="w-4 h-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="safety" className="text-xs gap-1.5">
            <Shield className="w-4 h-4" />
            Safety
          </TabsTrigger>
          <TabsTrigger value="charts" className="text-xs gap-1.5">
            <BarChart3 className="w-4 h-4" />
            Charts
          </TabsTrigger>
          <TabsTrigger value="local" className="text-xs gap-1.5">
            <MapPin className="w-4 h-4" />
            Map
          </TabsTrigger>
        </TabsList>

        <div className="mt-3">
          <TabsContent value="ai" className="mt-0">
            <CleanInsights 
              entries={entries} 
              userConditions={userConditions}
              onAskAI={onAskAI || onStartProtocol}
            />
          </TabsContent>

          <TabsContent value="safety" className="mt-0">
            {user && <PharmacovigilanceDashboard userId={user.id} />}
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
        </div>
      </Tabs>
    </div>
  );
};
