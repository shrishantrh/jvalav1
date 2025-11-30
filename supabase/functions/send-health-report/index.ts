import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

// Resend API client
class ResendClient {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async send(emailData: any) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailData),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { error: data };
    }
    
    return { data, error: null };
  }
}

const resend = new ResendClient(Deno.env.get("RESEND_API_KEY") ?? '');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendReportRequest {
  toEmail: string;
  reportUrl: string;
  password: string;
  exportType: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const toEmail = body.toEmail;
    const reportUrl = body.reportUrl;
    const password = body.password;
    const exportType = body.exportType || 'health_report';

    console.log('Sending health report email to:', toEmail, 'type:', exportType);
    
    if (!toEmail || !reportUrl || !password) {
      throw new Error('Missing required fields: toEmail, reportUrl, password');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8B2742 0%, #6B1E3A 50%, #4A2055 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
            .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 12px 12px; }
            .button { display: inline-block; background: #8B2742; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: 600; }
            .password-box { background: #f5f5f5; border-left: 4px solid #8B2742; padding: 15px; margin: 20px 0; border-radius: 4px; }
            .password { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; color: #8B2742; letter-spacing: 2px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin: 15px 0; color: #856404; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin: 0; font-size: 28px;">🏥 Health Report Shared</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Secure Medical Document Access</p>
            </div>
            <div class="content">
              <p>You've received a health monitoring report from Flare Journal.</p>
              
              <p><strong>Report Type:</strong> ${exportType === 'simple_pdf' ? 'Patient Summary Report' : 
                exportType === 'medical_pdf' ? 'Comprehensive Clinical Report' :
                exportType === 'hl7_fhir' ? 'HL7 FHIR R4 Bundle' :
                exportType === 'e2b_icsr' ? 'E2B(R3) ICSR Report' : 
                'MedDRA-Coded Analysis'}</p>
              
              <div class="password-box">
                <p style="margin: 0 0 8px 0;"><strong>🔐 Access Password:</strong></p>
                <p class="password">${password}</p>
                <p style="margin: 12px 0 0 0; font-size: 13px; color: #666;">
                  <em>Keep this password confidential. It's required to view the report.</em>
                </p>
              </div>
              
              <div style="text-align: center;">
                <a href="${reportUrl}" class="button">Access Secure Report</a>
              </div>
              
              <div class="warning">
                <strong>⚕️ Medical Confidentiality Notice:</strong><br>
                This report contains protected health information (PHI). Only authorized healthcare providers and designated individuals should access this content. Unauthorized disclosure may violate HIPAA regulations.
              </div>
              
              <p style="margin-top: 25px; font-size: 14px; color: #666;">
                <strong>Security Features:</strong><br>
                ✓ Password-protected access<br>
                ✓ Encrypted storage<br>
                ✓ Time-limited availability (30 days)<br>
                ✓ Audit trail maintained
              </p>
            </div>
            <div class="footer">
              <p><strong>Flare Journal</strong> | Professional Health Monitoring System</p>
              <p style="font-size: 12px; color: #999;">
                This email contains confidential medical information.<br>
                If you received this in error, please delete it immediately.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const { data, error } = await resend.send({
      from: "Jvala <onboarding@resend.dev>",
      to: [toEmail],
      subject: `🏥 Secure Health Report - ${(exportType || 'Health Report').replace(/_/g, ' ').toUpperCase()}`,
      html: emailHtml,
    });

    if (error) {
      console.error('Resend error:', error);
      throw error;
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
