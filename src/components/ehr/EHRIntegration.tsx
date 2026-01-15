import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hospital, Link2, Shield } from "lucide-react";

interface EHRIntegrationProps {
  userId: string;
}

export const EHRIntegration = ({ userId }: EHRIntegrationProps) => {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Hospital className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Medical Records</CardTitle>
          </div>
          <Badge className="text-xs bg-muted text-muted-foreground">
            Coming Soon
          </Badge>
        </div>
        <CardDescription className="text-xs">
          Import your health records from hospitals and clinics
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Privacy Notice */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5">
          <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="text-xs">
            <p className="font-medium">Your data stays private</p>
            <p className="text-muted-foreground">
              Records will be encrypted. Only you can access them.
            </p>
          </div>
        </div>

        {/* Coming Soon Message */}
        <div className="p-6 rounded-lg border border-dashed bg-muted/20 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-muted flex items-center justify-center">
            <Link2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <h4 className="font-medium text-sm mb-1">EHR Integration</h4>
          <p className="text-xs text-muted-foreground mb-3">
            We're working on connecting to major healthcare providers so you can automatically import your medical records.
          </p>
          <div className="flex flex-wrap justify-center gap-1">
            {['Epic', 'Cerner', 'Athena', 'Allscripts'].map(provider => (
              <Badge key={provider} variant="outline" className="text-[10px] text-muted-foreground">
                {provider}
              </Badge>
            ))}
          </div>
        </div>

        {/* What will be imported */}
        <div className="pt-3 border-t space-y-2">
          <h4 className="text-xs font-medium">What will be available:</h4>
          <div className="flex flex-wrap gap-1">
            {['Diagnoses', 'Medications', 'Lab Results', 'Allergies', 'Vitals'].map(item => (
              <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};