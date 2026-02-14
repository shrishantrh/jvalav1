import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("Supabase config missing");

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { type, email } = await req.json();

    if (!type || !email) {
      return new Response(JSON.stringify({ error: "Missing type or email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let actionLink: string;
    let subject: string;
    let htmlContent: string;

    if (type === "signup") {
      // Generate email confirmation link via admin API
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        options: {
          redirectTo: "https://jvala.tech/confirm-email",
        },
      });

      if (error) {
        console.error("generateLink signup error:", error);
        throw new Error(error.message);
      }

      actionLink = data.properties?.action_link || "";
      if (!actionLink) throw new Error("No action link generated");

      subject = "Verify your email — Jvala";
      htmlContent = buildVerificationEmail(actionLink);

    } else if (type === "recovery") {
      // Generate password recovery link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: "https://jvala.tech/reset-password",
        },
      });

      if (error) {
        console.error("generateLink recovery error:", error);
        throw new Error(error.message);
      }

      actionLink = data.properties?.action_link || "";
      if (!actionLink) throw new Error("No action link generated");

      subject = "Reset your password — Jvala";
      htmlContent = buildResetEmail(actionLink);

    } else {
      return new Response(JSON.stringify({ error: "Invalid type. Use 'signup' or 'recovery'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Resend from the verified login.jvala.tech subdomain
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Jvala <noreply@login.jvala.tech>",
        to: [email],
        subject,
        html: htmlContent,
      }),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      console.error("Resend error:", JSON.stringify(resendData));
      throw new Error(resendData.message || `Resend API error: ${resendResponse.status}`);
    }

    console.log("Email sent successfully:", resendData.id);

    return new Response(
      JSON.stringify({ success: true, messageId: resendData.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-auth-email error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ===== Email HTML Templates =====

function buildVerificationEmail(actionLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
</head>
<body style="margin:0;padding:0;background:#F3F0FF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#D6006C,#892EFF);padding:32px;text-align:center;">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;margin:0 auto 12px;line-height:48px;font-size:24px;color:#fff;">✉</div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Verify Your Email</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                Welcome to Jvala! Please confirm your email address to activate your account and start tracking your health.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#D6006C,#892EFF);color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;">
                      Confirm Email Address
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;line-height:1.5;">
                This link expires in 24 hours. If you didn't create a Jvala account, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#D1D5DB;word-break:break-all;">
                If the button doesn't work, copy this link:<br>${actionLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #F3F4F6;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Jvala Health · <a href="https://jvala.tech" style="color:#D6006C;text-decoration:none;">jvala.tech</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmail(actionLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin:0;padding:0;background:#F3F0FF;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#D6006C,#892EFF);padding:32px;text-align:center;">
              <div style="width:48px;height:48px;background:rgba(255,255,255,0.2);border-radius:12px;margin:0 auto 12px;line-height:48px;font-size:24px;color:#fff;">🔑</div>
              <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;">Reset Your Password</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
                We received a request to reset the password for your Jvala account. Click the button below to choose a new password.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${actionLink}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#D6006C,#892EFF);color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:700;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;color:#9CA3AF;line-height:1.5;">
                This link expires in 15 minutes. If you didn't request a password reset, you can safely ignore this email.
              </p>
              <p style="margin:0;font-size:12px;color:#D1D5DB;word-break:break-all;">
                If the button doesn't work, copy this link:<br>${actionLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 24px;text-align:center;border-top:1px solid #F3F4F6;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} Jvala Health · <a href="https://jvala.tech" style="color:#D6006C;text-decoration:none;">jvala.tech</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
