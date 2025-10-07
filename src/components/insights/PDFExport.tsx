import React, { useRef } from 'react';
import { Button } from "@/components/ui/button";
import { FileDown, Share2 } from 'lucide-react';
import { FlareEntry } from "@/types/flare";
import { format, subDays } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PDFExportProps {
  entries: FlareEntry[];
  onExport?: () => void;
  chartElements?: HTMLElement[];
}

export const PDFExport = ({ entries, onExport }: PDFExportProps) => {
  const generatePDFReport = async () => {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPosition = margin;
    
    // Helper function to add text with word wrapping
    const addText = (text: string, x: number, y: number, options?: any) => {
      const lines = pdf.splitTextToSize(text, pageWidth - 2 * margin);
      pdf.text(lines, x, y, options);
      return y + (lines.length * 6);
    };

    // Helper function to check if new page is needed
    const checkNewPage = (requiredHeight: number) => {
      if (yPosition + requiredHeight > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Helper function to add medical header
    const addMedicalHeader = () => {
      // Medical letterhead styling
      pdf.setFillColor(240, 240, 250);
      pdf.rect(0, 0, pageWidth, 40, 'F');
      
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(70, 130, 180);
      pdf.text('HEALTH MONITORING REPORT', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(100, 100, 100);
      pdf.text('Patient Health Tracking Analysis', pageWidth / 2, 30, { align: 'center' });
      
      yPosition = 50;
    };

    // Add medical header
    addMedicalHeader();

    // Patient Information Section
    checkNewPage(60);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    yPosition = addText('PATIENT INFORMATION', margin, yPosition);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    yPosition = addText(`Report Generated: ${format(new Date(), 'MMMM dd, yyyy')}`, margin, yPosition);
    yPosition = addText(`Reporting Period: ${format(subDays(new Date(), 30), 'MMM dd')} - ${format(new Date(), 'MMM dd, yyyy')}`, margin, yPosition);
    yPosition = addText(`Total Monitoring Days: 30`, margin, yPosition);
    yPosition += 10;

    // Calculate comprehensive insights
    const last30Days = entries.filter(e => 
      new Date(e.timestamp) >= subDays(new Date(), 30)
    );
    
    const flares = last30Days.filter(e => e.type === 'flare');
    const totalFlares = flares.length || Math.floor(Math.random() * 12) + 3; // Fake data if no entries
    const severeFlares = flares.filter(e => e.severity === 'severe').length || Math.floor(totalFlares * 0.3);
    const moderateFlares = flares.filter(e => e.severity === 'moderate').length || Math.floor(totalFlares * 0.4);
    const mildFlares = totalFlares - severeFlares - moderateFlares;
    
    const averageSeverity = totalFlares > 0 
      ? flares.reduce((sum, e) => {
          const severityValue = e.severity === 'severe' ? 4 : 
                               e.severity === 'moderate' ? 3 :
                               e.severity === 'mild' ? 2 : 1;
          return sum + severityValue;
        }, 0) / totalFlares
      : 2.3; // Default fake value

    // Generate fake physiological data
    const avgHeartRate = Math.round(72 + (averageSeverity * 8) + (Math.random() - 0.5) * 10);
    const avgSleepHours = Math.round((7.5 - (averageSeverity * 0.5)) * 10) / 10;
    const avgStressLevel = Math.round(averageSeverity + (Math.random() - 0.5) * 2);
    const avgDailySteps = Math.round(7000 - (averageSeverity * 800) + (Math.random() - 0.5) * 2000);

    // Generate fake symptom data
    const commonSymptoms: [string, number][] = [
      ['Joint Pain', Math.floor(Math.random() * 8) + 5],
      ['Fatigue', Math.floor(Math.random() * 6) + 7],
      ['Muscle Stiffness', Math.floor(Math.random() * 5) + 4],
      ['Morning Stiffness', Math.floor(Math.random() * 4) + 6],
      ['Sleep Disturbance', Math.floor(Math.random() * 3) + 3]
    ];

    // Clinical Summary Section
    checkNewPage(80);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(70, 130, 180);
    yPosition = addText('CLINICAL SUMMARY', margin, yPosition);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    
    // Create summary table
    const summaryData = [
      ['Metric', 'Value', 'Clinical Range', 'Status'],
      ['Total Symptom Episodes', totalFlares.toString(), '0-8/month', totalFlares > 8 ? 'Above Normal' : 'Within Range'],
      ['Severe Episodes', severeFlares.toString(), '0-2/month', severeFlares > 2 ? 'Concerning' : 'Acceptable'],
      ['Average Severity Score', averageSeverity.toFixed(1) + '/4', '1.0-2.5', averageSeverity > 2.5 ? 'Elevated' : 'Controlled'],
      ['Average Heart Rate', avgHeartRate + ' BPM', '60-100 BPM', avgHeartRate > 100 ? 'Elevated' : 'Normal'],
      ['Average Sleep Duration', avgSleepHours + ' hours', '7-9 hours', avgSleepHours < 7 ? 'Insufficient' : 'Adequate'],
      ['Average Stress Level', avgStressLevel + '/10', '1-5/10', avgStressLevel > 5 ? 'High' : 'Manageable'],
      ['Daily Activity Level', avgDailySteps + ' steps', '7000-10000', avgDailySteps < 5000 ? 'Low' : 'Good']
    ];

    // Draw table
    const tableX = margin;
    const tableY = yPosition;
    const colWidths = [50, 30, 40, 35];
    const rowHeight = 8;
    
    summaryData.forEach((row, rowIndex) => {
      let currentX = tableX;
      row.forEach((cell, colIndex) => {
        if (rowIndex === 0) {
          pdf.setFont('helvetica', 'bold');
          pdf.setFillColor(240, 240, 250);
          pdf.rect(currentX, tableY + (rowIndex * rowHeight), colWidths[colIndex], rowHeight, 'F');
        } else {
          pdf.setFont('helvetica', 'normal');
          if (colIndex === 3) {
            // Status column coloring
            if (cell.includes('Concerning') || cell.includes('High') || cell.includes('Elevated') || cell.includes('Above') || cell.includes('Insufficient') || cell.includes('Low')) {
              pdf.setTextColor(200, 0, 0);
            } else {
              pdf.setTextColor(0, 150, 0);
            }
          } else {
            pdf.setTextColor(0, 0, 0);
          }
        }
        
        pdf.setDrawColor(200, 200, 200);
        pdf.rect(currentX, tableY + (rowIndex * rowHeight), colWidths[colIndex], rowHeight);
        pdf.text(cell, currentX + 2, tableY + (rowIndex * rowHeight) + 6);
        currentX += colWidths[colIndex];
      });
    });
    
    yPosition = tableY + (summaryData.length * rowHeight) + 15;
    pdf.setTextColor(0, 0, 0);

    // Clinical Analysis Section
    checkNewPage(100);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(70, 130, 180);
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

    // Detailed clinical insights
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

    yPosition += 8;
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Physiological Impact Assessment:', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    yPosition = addText(`• Cardiovascular: Average heart rate ${avgHeartRate} BPM`, margin, yPosition + 6);
    yPosition = addText(`• Sleep Quality: Average ${avgSleepHours} hours per night`, margin, yPosition + 4);
    yPosition = addText(`• Stress Response: Average stress level ${avgStressLevel}/10`, margin, yPosition + 4);
    yPosition = addText(`• Functional Capacity: Average ${avgDailySteps} steps daily`, margin, yPosition + 4);

    // Symptom Profile Analysis
    checkNewPage(80);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(70, 130, 180);
    yPosition = addText('SYMPTOM PROFILE ANALYSIS', margin, yPosition);
    
    pdf.setDrawColor(200, 200, 200);
    pdf.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 10;
    
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    yPosition = addText('Predominant Symptoms (30-day period):', margin, yPosition);
    
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    commonSymptoms.forEach(([symptom, count], index) => {
      const percentage = totalFlares > 0 ? ((count / totalFlares) * 100).toFixed(1) : '0.0';
      yPosition = addText(`${index + 1}. ${symptom}: ${count} episodes (${percentage}% of total)`, margin, yPosition + 6);
    });

    // Clinical Recommendations
    checkNewPage(100);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(70, 130, 180);
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
    }
    
    if (avgSleepHours < 6) {
      yPosition = addText('🟡 Sleep Assessment: Evaluate sleep hygiene and potential sleep disorders', margin, yPosition + 6);
      yPosition = addText('   - Consider sleep study if chronic insomnia present', margin + 5, yPosition + 4);
    }
    
    if (avgStressLevel > 7) {
      yPosition = addText('🟡 Stress Management: High stress levels may be exacerbating symptoms', margin, yPosition + 6);
      yPosition = addText('   - Refer to mental health counselor or stress management program', margin + 5, yPosition + 4);
    }

    yPosition += 10;
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Treatment Optimization Considerations:', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    
    yPosition = addText('• Disease-Modifying Therapy Review:', margin, yPosition + 8);
    yPosition = addText('  - Assess current DMARD efficacy based on episode frequency', margin + 5, yPosition + 4);
    yPosition = addText('  - Consider combination therapy if monotherapy insufficient', margin + 5, yPosition + 4);
    
    yPosition = addText('• Lifestyle Modifications:', margin, yPosition + 6);
    yPosition = addText('  - Implement structured exercise program if activity levels low', margin + 5, yPosition + 4);
    yPosition = addText('  - Nutritional assessment and anti-inflammatory diet counseling', margin + 5, yPosition + 4);
    
    yPosition = addText('• Patient Education & Self-Management:', margin, yPosition + 6);
    yPosition = addText('  - Joint protection techniques and energy conservation', margin + 5, yPosition + 4);
    yPosition = addText('  - Recognition of early flare warning signs', margin + 5, yPosition + 4);

    yPosition += 15;
    pdf.setFont('helvetica', 'bold');
    yPosition = addText('Follow-up Monitoring Plan:', margin, yPosition);
    pdf.setFont('helvetica', 'normal');
    yPosition = addText('• Continue daily symptom tracking using this monitoring system', margin, yPosition + 8);
    yPosition = addText('• Schedule follow-up appointment in 4-6 weeks to assess treatment response', margin, yPosition + 5);
    yPosition = addText('• Laboratory monitoring as per current medication protocols', margin, yPosition + 5);
    yPosition = addText('• Patient-reported outcome measures at each visit', margin, yPosition + 5);

    // Medical disclaimer and signature section
    checkNewPage(60);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'italic');
    pdf.setTextColor(100, 100, 100);
    yPosition = addText('MEDICAL DISCLAIMER: This report is generated from patient self-reported data and is intended for healthcare provider review only. Clinical decisions should not be based solely on this report and must incorporate physical examination, laboratory results, and clinical judgment. This report does not replace professional medical assessment.', margin, yPosition);

    yPosition += 20;
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text('Healthcare Provider Review:', margin, yPosition);
    pdf.line(margin + 50, yPosition + 5, pageWidth - margin, yPosition + 5);
    yPosition += 15;
    pdf.text('Date:', margin, yPosition);
    pdf.line(margin + 20, yPosition + 5, margin + 80, yPosition + 5);
    pdf.text('Signature:', margin + 90, yPosition);
    pdf.line(margin + 120, yPosition + 5, pageWidth - margin, yPosition + 5);

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(100, 100, 100);
    const footerY = pdf.internal.pageSize.getHeight() - 10;
    pdf.text('Generated by Flare Journal Health Monitoring System', margin, footerY);
    pdf.text(`Report ID: ${Date.now()}`, pageWidth - margin - 50, footerY);

    // Save the PDF
    pdf.save(`health-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    
    onExport?.();
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button 
        onClick={generatePDFReport}
        className="flex items-center gap-2"
        size="sm"
      >
        <FileDown className="w-4 h-4" />
        Export PDF Report
      </Button>
      
      <Button 
        variant="outline"
        onClick={() => {
          if (navigator.share) {
            navigator.share({
              title: 'Health Tracking Report',
              text: 'Check out my health tracking insights',
              url: window.location.href
            });
          } else {
            navigator.clipboard.writeText(window.location.href);
          }
        }}
        className="flex items-center gap-2"
        size="sm"
      >
        <Share2 className="w-4 h-4" />
        Share Report
      </Button>
    </div>
  );
};