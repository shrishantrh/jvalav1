import React, { useRef, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2 } from 'lucide-react';
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

      // Helper function to add text with word wrapping
      const addText = (text: string, x: number, y: number) => {
        const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
        pdf.text(lines, x, y);
        return y + (lines.length * 6);
      };

      // Header with professional styling
      pdf.setFillColor(139, 39, 66);
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

      // Calculate comprehensive insights
      const last30Days = entries.filter(e => 
        new Date(e.timestamp) >= subDays(new Date(), 30)
      );
      
      const flares = last30Days.filter(e => e.type === 'flare');
      const totalFlares = flares.length;
      const severeFlares = flares.filter(e => e.severity === 'severe').length;
      const moderateFlares = flares.filter(e => e.severity === 'moderate').length;
      const mildFlares = totalFlares - severeFlares - moderateFlares;
      
      const averageSeverity = totalFlares > 0 
        ? flares.reduce((sum, e) => {
            const severityValue = e.severity === 'severe' ? 4 : 
                                 e.severity === 'moderate' ? 3 :
                                 e.severity === 'mild' ? 2 : 1;
            return sum + severityValue;
          }, 0) / totalFlares
        : 0;

      // Summary Statistics
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
        `Flare Episodes: ${totalFlares}`,
        `Severe Flares: ${severeFlares}`,
        `Average per week: ${(totalFlares / 4.3).toFixed(1)}`
      ];

      summaryItems.forEach((item, idx) => {
        const xPos = margin + 3 + (idx % 2) * 85;
        const yPos = yPosition + Math.floor(idx / 2) * 6;
        pdf.text(item, xPos, yPos);
      });

      yPosition += 25;

      // Clinical Analysis Section
      checkNewPage(100);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 39, 66);
      yPosition = addText('CLINICAL ANALYSIS & INSIGHTS', margin, yPosition);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      yPosition = addText('Disease Activity Assessment:', margin, yPosition);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');

      const flareFrequency = totalFlares / 30;
      if (flareFrequency > 1) {
        yPosition = addText(`• High disease activity detected: ${flareFrequency.toFixed(1)} episodes per day`, margin, yPosition + 8);
        yPosition = addText('  Clinical Significance: Suggests suboptimal disease control', margin + 5, yPosition + 4);
        yPosition = addText('  Recommendation: Immediate rheumatology consultation for treatment optimization', margin + 5, yPosition + 4);
      } else if (flareFrequency > 0.5) {
        yPosition = addText(`• Moderate disease activity: ${(flareFrequency * 7).toFixed(1)} episodes per week`, margin, yPosition + 8);
        yPosition = addText('  Clinical Significance: Acceptable but room for improvement', margin + 5, yPosition + 4);
        yPosition = addText('  Recommendation: Review current medications and lifestyle factors', margin + 5, yPosition + 4);
      } else {
        yPosition = addText(`• Good disease control: ${totalFlares} episodes in 30-day period`, margin, yPosition + 8);
        yPosition = addText('  Clinical Significance: Disease well-controlled with current regimen', margin + 5, yPosition + 4);
        yPosition = addText('  Recommendation: Continue current management strategy', margin + 5, yPosition + 4);
      }

      if (totalFlares > 0) {
        yPosition += 8;
        pdf.setFont('helvetica', 'bold');
        yPosition = addText('Severity Distribution Analysis:', margin, yPosition);
        pdf.setFont('helvetica', 'normal');
        yPosition = addText(`• Severe episodes: ${severeFlares} (${((severeFlares/totalFlares)*100).toFixed(1)}%)`, margin, yPosition + 6);
        yPosition = addText(`• Moderate episodes: ${moderateFlares} (${((moderateFlares/totalFlares)*100).toFixed(1)}%)`, margin, yPosition + 4);
        yPosition = addText(`• Mild episodes: ${mildFlares} (${((mildFlares/totalFlares)*100).toFixed(1)}%)`, margin, yPosition + 4);

        if (severeFlares > 3) {
          yPosition += 6;
          pdf.setTextColor(200, 0, 0);
          yPosition = addText(`⚠ CLINICAL ALERT: ${severeFlares} severe episodes exceed acceptable threshold`, margin, yPosition);
          pdf.setTextColor(0, 0, 0);
          yPosition = addText('  Urgent Assessment Required: Schedule immediate consultation', margin + 5, yPosition + 4);
        }
      }

      // Capture and add charts
      if (chartRefs && chartRefs.length > 0) {
        for (let i = 0; i < chartRefs.length; i++) {
          const chartRef = chartRefs[i];
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
              
              pdf.setFontSize(12);
              pdf.setFont('helvetica', 'bold');
              pdf.text(`Chart ${i + 1}`, margin, yPosition);
              yPosition += 8;
              
              pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, Math.min(imgHeight, 120));
              yPosition += Math.min(imgHeight, 120) + 10;
            } catch (error) {
              console.error('Error capturing chart:', error);
            }
          }
        }
      }

      // Clinical Recommendations
      checkNewPage(100);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(139, 39, 66);
      yPosition = addText('CLINICAL RECOMMENDATIONS', margin, yPosition);
      
      pdf.setDrawColor(200, 200, 200);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(0, 0, 0);
      yPosition = addText('Immediate Actions Required:', margin, yPosition);
      
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      
      if (severeFlares > 3) {
        yPosition = addText('🔴 URGENT: Schedule rheumatology consultation within 1-2 weeks', margin, yPosition + 8);
        yPosition = addText('   - Consider rescue therapy or medication adjustment', margin + 5, yPosition + 4);
      } else {
        yPosition = addText('• Continue current monitoring and treatment plan', margin, yPosition + 8);
      }

      yPosition += 10;
      pdf.setFont('helvetica', 'bold');
      yPosition = addText('Follow-up Monitoring Plan:', margin, yPosition);
      pdf.setFont('helvetica', 'normal');
      yPosition = addText('• Continue daily symptom tracking using this monitoring system', margin, yPosition + 8);
      yPosition = addText('• Schedule follow-up appointment in 4-6 weeks to assess treatment response', margin, yPosition + 5);
      yPosition = addText('• Laboratory monitoring as per current medication protocols', margin, yPosition + 5);

      // Medical disclaimer
      checkNewPage(40);
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 100, 100);
      yPosition = addText('MEDICAL DISCLAIMER: This report is generated from patient self-reported data and is intended for healthcare provider review only. Clinical decisions should not be based solely on this report.', margin, yPosition);

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
          metadata: { entries_count: last30Days.length, flares_count: totalFlares }
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
      const { data, error } = await supabase.functions.invoke('send-health-report', {
        body: {
          toEmail: email,
          reportUrl: shareUrl,
          password: sharePassword,
          exportType: 'simple_pdf'
        }
      });

      if (error) {
        toast({ 
          title: "⚠️ Email Service Limitation", 
          description: "Resend requires domain verification. You can only send to verified email addresses (like shatt@illinois.edu) until you verify your own domain at resend.com/domains. This is a Resend security requirement, not an app limitation.",
          variant: "destructive",
          duration: 12000
        });
        return;
      }

      toast({ 
        title: "✅ Email sent successfully", 
        description: `Report sent to ${email}`,
      });
      setEmailDialogOpen(false);
      setEmail('');
    } catch (error: any) {
      console.error('Email error:', error);
      toast({ 
        title: "Email failed", 
        description: "Unable to send email. Please try again.",
        variant: "destructive"
      });
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
        Export Simple PDF with Charts
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
              Share this password-protected link with healthcare providers or authorized individuals (One-time use)
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
              <Label className="text-sm font-medium">Access Password (One-time use)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={sharePassword} readOnly className="font-mono text-lg font-bold" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(sharePassword)}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Recipient needs this password to access the report. Link expires after first use or in 30 days.
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
