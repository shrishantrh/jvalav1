import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, Sparkles } from "lucide-react";

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId: _userId }: EHRIntegrationProps) => {
  return (
    <Card className="glass-card border-0 rounded-3xl">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Hospital className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold">Medical Records</p>
              <p className="text-[10px] text-muted-foreground">EHR & FHIR integration</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Medical records sync is coming soon. We're finalizing secure integrations with major health systems.
        </p>
      </CardContent>
    </Card>
  );
};
