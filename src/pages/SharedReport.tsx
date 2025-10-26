import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, FileText, AlertTriangle } from 'lucide-react';

const SharedReport = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  const token = searchParams.get('token');

  const handleAccess = async () => {
    if (!token || !password) {
      setError('Please enter the access password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Call the edge function with token and password as query params
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-shared-report?token=${token}&password=${password}`,
        {
          method: 'GET',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to access report');
      }

      // Get the PDF blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      console.error('Access error:', err);
      setError(err.message || 'Invalid password or expired link');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-destructive" />
          <h1 className="text-2xl font-medical mb-2">Invalid Share Link</h1>
          <p className="text-muted-foreground">
            This link appears to be invalid or incomplete.
          </p>
        </Card>
      </div>
    );
  }

  if (pdfUrl) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <div className="container max-w-4xl mx-auto p-4">
          <Card className="p-6 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-medical">Secure Health Report</h1>
                  <p className="text-sm text-muted-foreground">Password-protected medical document (One-time access)</p>
                </div>
              </div>
              <Button onClick={() => window.print()}>
                Print Report
              </Button>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <iframe
              src={pdfUrl}
              className="w-full h-[calc(100vh-200px)]"
              title="Health Report"
            />
          </Card>
          <Alert className="mt-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Note: This link has been used and is no longer valid. The report was automatically deleted for security.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-medical mb-2">🔐 Secure Health Report</h1>
          <p className="text-muted-foreground">
            Enter the password to access this protected medical document (One-time access)
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <Label htmlFor="password">Access Password</Label>
            <Input
              id="password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter 8-character password"
              onKeyDown={(e) => e.key === 'Enter' && handleAccess()}
              className="font-mono text-lg"
            />
            <p className="text-xs text-muted-foreground mt-2">
              The password was provided to you via email or by the person who shared this report
            </p>
          </div>

          <Button 
            onClick={handleAccess}
            disabled={loading || !password}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Access Report
              </>
            )}
          </Button>
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground text-center">
          <p>⚕️ This is a protected medical document</p>
          <p className="mt-1">Unauthorized access or distribution is prohibited</p>
          <p className="mt-1 text-destructive font-medium">This link is valid for ONE-TIME use only</p>
        </div>
      </Card>
    </div>
  );
};

export default SharedReport;
