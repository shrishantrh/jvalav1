import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, ShieldOff } from "lucide-react";

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId }: EHRIntegrationProps) => {
  return (
    <Card className="opacity-60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Medical Records</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <ShieldOff className="w-3 h-3 mr-1" />
            Disabled
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">
          EHR integration has been disabled for security hardening. 
          This feature will return once encryption-at-rest is implemented.
        </p>
      </CardContent>
    </Card>
  );
};
