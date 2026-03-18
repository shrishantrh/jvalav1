import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, Sparkles } from "lucide-react";

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId: _userId }: EHRIntegrationProps) => {
  return (
    <Card className="glass-card border-0 rounded-3xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Medical Records</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
            <Sparkles className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          Medical records sync is coming soon for launch-safe rollout.
        </p>
      </CardContent>
    </Card>
  );
};
