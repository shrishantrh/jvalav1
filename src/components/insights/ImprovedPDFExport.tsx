import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Share2, Mail, Loader2, Copy, Check } from 'lucide-react';
import { FlareEntry } from "@/types/flare";
import { format, subDays, eachDayOfInterval } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface ImprovedPDFExportProps {
  entries: FlareEntry[];
  chartRefs: React.RefObject<HTMLDivElement>[];
}

export const ImprovedPDFExport = ({ entries, chartRefs }: ImprovedPDFExportProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const generateSimplePDF = async (forSharing = false) => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;

      // Helper to check page overflow
      const checkNewPage = (height: number) => {
        if (yPosition + height > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Header with professional styling
      pdf.setFillColor(139, 39, 66); // Primary maroon color
      pdf.rect(0, 0, pageWidth, 35, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('HEALTH MONITORING REPORT', pageWidth / 2, 18, { align: 'center' });
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Patient Health Tracking Summary', pageWidth / 2, 26, { align: 'center' });
      
      yPosition = 45;
      pdf.setTextColor(0, 0, 0);

      // Report Info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Report Date:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(format(new Date(), 'MMMM dd, yyyy'), margin + 35, yPosition);
      yPosition += 6;
      
      pdf.setFont('helvetica', 'bold');
      pdf.text('Period:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${format(subDays(new Date(), 30), 'MMM dd')} - ${format(new Date(), 'MMM dd, yyyy')}`, margin + 35, yPosition);
      yPosition += 10;

      // Summary Statistics
      const last30Days = entries.filter(e => new Date(e.timestamp) >= subDays(new Date(), 30));
      const flares = last30Days.filter(e => e.type === 'flare');
      
      pdf.setFillColor(245, 245, 250);
      pdf.rect(margin, yPosition, pageWidth - 2 * margin, 35, 'F');
      yPosition += 8;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('30-Day Summary', margin + 3, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const summaryItems = [
        `Total Entries: ${last30Days.length}`,
        `Flare Episodes: ${flares.length}`,
        `Severe Flares: ${flares.filter(f => f.severity === 'severe').length}`,
        `Average per week: ${(flares.length / 4.3).toFixed(1)}`
      ];

      summaryItems.forEach((item, idx) => {
        const xPos = margin + 3 + (idx % 2) * 85;
        const yPos = yPosition + Math.floor(idx / 2) * 6;
        pdf.text(item, xPos, yPos);
      });

      yPosition += 25;

      // Capture and add charts
      if (chartRefs && chartRefs.length > 0) {
        for (const chartRef of chartRefs) {
          if (chartRef.current) {
            checkNewPage(80);
            
            try {
              const canvas = await html2canvas(chartRef.current, {
                scale: 2,
                backgroundColor: '#ffffff'
              });
              
              const imgData = canvas.toDataURL('image/png');
              const imgWidth = pageWidth - 2 * margin;
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              
              if (yPosition + imgHeight > pageHeight - margin) {
                pdf.addPage();
                yPosition = margin;
              }
              
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 120));
              yPosition += Math.min(imgHeight, 120) + 10;
            } catch (error) {
              console.error('Error capturing chart:', error);
            }
          }
        }
      }

      // Clinical Notes Section
      checkNewPage(40);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 39, 66);
      pdf.text('CLINICAL OBSERVATIONS', margin, yPosition);
      yPosition += 8;
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'normal');
      
      const observations = [
        `Disease Activity: ${flares.length > 10 ? 'High - Consider treatment review' : flares.length > 5 ? 'Moderate - Monitor closely' : 'Good control'}`,
        `Pattern: ${flares.filter(f => f.severity === 'severe').length > 3 ? 'Frequent severe episodes noted' : 'Manageable symptom pattern'}`,
        `Recommendation: ${flares.length > 10 ? 'Schedule consultation within 1-2 weeks' : 'Continue current monitoring'}`,
      ];

      observations.forEach(obs => {
        checkNewPage(15);
        const lines = pdf.splitTextToSize(obs, pageWidth - 2 * margin);
        pdf.text(lines, margin, yPosition);
        yPosition += (lines.length * 5) + 3;
      });

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const footerY = pdf.internal.pageSize.getHeight() - 10;
      pdf.text('Flare Journal - Professional Health Monitoring System', margin, footerY);
      pdf.text(`Report ID: ${Date.now()}`, pageWidth - margin - 50, footerY);

      if (forSharing) {
        const pdfBlob = pdf.output('blob');
        return pdfBlob;
      } else {
        pdf.save(`health-summary-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
        
        // Log export
        await supabase.from('report_exports').insert({
          user_id: user?.id,
          export_type: 'simple_pdf',
          metadata: { entries_count: last30Days.length, flares_count: flares.length }
        });
        
        toast({ title: "PDF exported successfully" });
      }
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: "Export failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareReport = async () => {
    setIsExporting(true);
    try {
      // Generate password
      const password = Math.random().toString(36).slice(-8).toUpperCase();
      
      // Generate PDF blob
      const pdfBlob = await generateSimplePDF(true) as Blob;
      
      // Hash password
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Upload to storage
      const fileName = `${user?.id}/${Date.now()}-health-report.pdf`;
      const { error: uploadError } = await supabase.storage
        .from('health-reports')
        .upload(fileName, pdfBlob);

      if (uploadError) throw uploadError;

      // Create share record
      const shareToken = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const { error: insertError } = await supabase
        .from('report_exports')
        .insert({
          user_id: user?.id,
          export_type: 'simple_pdf',
          file_path: fileName,
          password_hash: passwordHash,
          share_token: shareToken,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) throw insertError;

      const url = `${window.location.origin}/shared-report?token=${shareToken}`;
      setShareUrl(url);
      setSharePassword(password);
      setShareDialogOpen(true);
      
      toast({ title: "Share link created", description: "Share link and password with recipient" });
    } catch (error) {
      console.error('Share error:', error);
      toast({ title: "Share failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleEmailReport = async () => {
    if (!email || !shareUrl) return;
    
    setIsExporting(true);
    try {
      const { error } = await supabase.functions.invoke('send-health-report', {
        body: {
          toEmail: email,
          reportUrl: shareUrl,
          password: sharePassword,
          exportType: 'simple_pdf'
        }
      });

      if (error) throw error;

      toast({ title: "Email sent successfully", description: `Report sent to ${email}` });
      setEmailDialogOpen(false);
      setEmail('');
    } catch (error) {
      console.error('Email error:', error);
      toast({ title: "Email failed", description: "Please try again", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button 
        onClick={() => generateSimplePDF(false)}
        disabled={isExporting}
        className="flex items-center gap-2"
        size="sm"
      >
        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
        Export PDF with Charts
      </Button>
      
      <Button 
        onClick={handleShareReport}
        disabled={isExporting}
        variant="outline"
        className="flex items-center gap-2"
        size="sm"
      >
        {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
        Create Secure Share Link
      </Button>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>🔐 Secure Share Link Created</DialogTitle>
            <DialogDescription>
              Share this password-protected link with healthcare providers or authorized individuals
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Share URL</Label>
              <div className="flex gap-2 mt-1">
                <Input value={shareUrl} readOnly className="text-sm" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(shareUrl)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Access Password</Label>
              <div className="flex gap-2 mt-1">
                <Input value={sharePassword} readOnly className="font-mono text-lg font-bold" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(sharePassword)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Recipient needs this password to access the report. Expires in 30 days.
              </p>
            </div>
            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" variant="secondary">
                  <Mail className="w-4 h-4 mr-2" />
                  Email This Report
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send via Email</DialogTitle>
                  <DialogDescription>
                    Send the secure link and password to a healthcare provider
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Recipient Email</Label>
                    <Input 
                      type="email" 
                      placeholder="doctor@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleEmailReport} disabled={!email || isExporting} className="w-full">
                    {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                    Send Email
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
