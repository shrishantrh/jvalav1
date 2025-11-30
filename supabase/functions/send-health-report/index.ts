import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const body = await req.json();
    
    // Support both old format (toEmail, reportUrl, password) and new format (recipientEmail, summary)
    const toEmail = body.toEmail || body.recipientEmail;
    const summary = body.summary || body.reportUrl || '';
    const patientName = body.patientName || 'Patient';
    const dateRange = body.dateRange || '30';
    const exportType = body.exportType || 'health_summary';

    console.log('Sending health report email to:', toEmail);
    
    if (!toEmail) {
      throw new Error('Missing required field: recipient email');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0;
              padding: 0;
              background: #f5f5f5;
            }
            .container { 
              max-width: 600px; 
              margin: 0 auto; 
              background: #ffffff;
            }
            .header { 
              background: linear-gradient(135deg, #D6006C 0%, #892EFF 100%); 
              color: white; 
              padding: 30px; 
              text-align: center; 
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
            }
            .header p {
              margin: 8px 0 0 0;
              opacity: 0.9;
              font-size: 14px;
            }
            .content { 
              padding: 30px; 
            }
            .summary-box {
              background: #f8f9fa;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
              font-family: 'Courier New', monospace;
              font-size: 12px;
              white-space: pre-wrap;
              max-height: 400px;
              overflow-y: auto;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #eee;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              border-top: 1px solid #eee;
            }
            .footer p {
              margin: 5px 0;
              font-size: 12px;
              color: #666;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #D6006C; 
              padding: 12px 15px; 
              margin: 20px 0; 
              font-size: 13px;
              color: #856404; 
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📋 Health Summary Report</h1>
              <p>Generated from Jvala Health Tracker</p>
            </div>
            <div class="content">
              <p>A health tracking report has been shared with you.</p>
              
              <div class="info-row">
                <span><strong>Patient:</strong></span>
                <span>${patientName}</span>
              </div>
              <div class="info-row">
                <span><strong>Report Period:</strong></span>
                <span>Last ${dateRange} days</span>
              </div>
              <div class="info-row">
                <span><strong>Report Type:</strong></span>
                <span>${exportType.replace(/_/g, ' ')}</span>
              </div>
              
              <div class="summary-box">${summary.substring(0, 5000)}</div>
              
              <div class="warning">
                <strong>⚕️ Medical Information Notice:</strong><br>
                This report contains health information for clinical review. 
                Data is self-reported by the patient using Jvala health tracking app.
              </div>
            </div>
            <div class="footer">
              <p><strong>Jvala</strong> | Personal Health Tracking</p>
              <p>This is an automated message. Do not reply directly.</p>
              <p style="font-size: 11px; color: #999; margin-top: 10px;">
                If you received this in error, please disregard.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Jvala <onboarding@resend.dev>",
        to: [toEmail],
        subject: `Health Report - ${patientName} (${dateRange} days)`,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
    }

    console.log('Email sent successfully:', data);

    return new Response(
      JSON.stringify({ success: true, messageId: data?.id }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending health report:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: error.message === 'Unauthorized' ? 401 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
