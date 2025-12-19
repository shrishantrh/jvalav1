import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.74.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WeeklyDigestData {
  userId: string;
  email: string;
  fullName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json() as WeeklyDigestData;
    const { userId, email, fullName } = body;

    if (!userId || !email) {
      throw new Error('Missing required fields: userId and email');
    }

    console.log(`Generating weekly digest for user: ${userId}`);

    // Get date range for the past week
    const weekEnd = new Date();
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Fetch user's flare entries for the week
    const { data: entries, error: entriesError } = await supabase
      .from('flare_entries')
      .select('*')
      .eq('user_id', userId)
      .gte('timestamp', weekStart.toISOString())
      .lte('timestamp', weekEnd.toISOString())
      .order('timestamp', { ascending: false });

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      throw entriesError;
    }

    // Fetch engagement data
    const { data: engagement } = await supabase
      .from('engagement')
      .select('*')
      .eq('user_id', userId)
      .single();

    // Calculate weekly stats
    const flareCount = entries?.filter(e => e.entry_type === 'flare').length || 0;
    const avgSeverity = entries?.length ? 
      entries.filter(e => e.severity).reduce((sum, e) => {
        const severityScore = e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1;
        return sum + severityScore;
      }, 0) / entries.filter(e => e.severity).length : 0;
    
    const severityLabel = avgSeverity >= 2.5 ? 'High' : avgSeverity >= 1.5 ? 'Moderate' : 'Low';

    // Get top symptoms
    const symptomCounts: Record<string, number> = {};
    entries?.forEach(e => {
      e.symptoms?.forEach((s: string) => {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      });
    });
    const topSymptoms = Object.entries(symptomCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([symptom]) => symptom);

    // Get top triggers
    const triggerCounts: Record<string, number> = {};
    entries?.forEach(e => {
      e.triggers?.forEach((t: string) => {
        triggerCounts[t] = (triggerCounts[t] || 0) + 1;
      });
    });
    const topTriggers = Object.entries(triggerCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([trigger]) => trigger);

    // Calculate logging consistency
    const daysLogged = new Set(entries?.map(e => 
      new Date(e.timestamp).toISOString().split('T')[0]
    )).size;
    const consistency = Math.round((daysLogged / 7) * 100);

    // Determine trend
    let trend = 'stable';
    let trendIcon = '➡️';
    if (entries && entries.length > 3) {
      const recentSeverity = entries.slice(0, Math.floor(entries.length / 2))
        .filter(e => e.severity)
        .reduce((sum, e) => sum + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1), 0);
      const olderSeverity = entries.slice(Math.floor(entries.length / 2))
        .filter(e => e.severity)
        .reduce((sum, e) => sum + (e.severity === 'severe' ? 3 : e.severity === 'moderate' ? 2 : 1), 0);
      
      if (recentSeverity < olderSeverity * 0.8) {
        trend = 'improving';
        trendIcon = '📈';
      } else if (recentSeverity > olderSeverity * 1.2) {
        trend = 'worsening';
        trendIcon = '📉';
      }
    }

    const patientName = fullName || 'there';
    const currentStreak = engagement?.current_streak || 0;

    // Generate email HTML
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
            .content { 
              padding: 30px; 
            }
            .stat-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .stat-box {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 20px;
              text-align: center;
            }
            .stat-value {
              font-size: 28px;
              font-weight: bold;
              color: #D6006C;
            }
            .stat-label {
              font-size: 12px;
              color: #666;
              margin-top: 5px;
            }
            .section {
              margin: 25px 0;
            }
            .section-title {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 10px;
              color: #333;
            }
            .chip {
              display: inline-block;
              background: #f0e6ff;
              color: #6428D9;
              padding: 6px 12px;
              border-radius: 20px;
              margin: 4px;
              font-size: 13px;
            }
            .trend-box {
              background: ${trend === 'improving' ? '#d4edda' : trend === 'worsening' ? '#f8d7da' : '#e2e3e5'};
              border-radius: 12px;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
            }
            .trend-icon {
              font-size: 32px;
            }
            .streak-box {
              background: linear-gradient(135deg, #fff5f8 0%, #f5f0ff 100%);
              border-radius: 12px;
              padding: 20px;
              text-align: center;
              border: 1px solid #e0d0e8;
            }
            .streak-flame {
              font-size: 36px;
            }
            .footer { 
              text-align: center; 
              padding: 20px 30px;
              background: #f8f9fa;
              border-top: 1px solid #eee;
            }
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #D6006C 0%, #892EFF 100%);
              color: white;
              padding: 12px 30px;
              border-radius: 25px;
              text-decoration: none;
              font-weight: 600;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📊 Your Weekly Health Digest</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.9;">
                ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            
            <div class="content">
              <p>Hi ${patientName}! 👋</p>
              <p>Here's your weekly health summary. Keep tracking to discover more patterns!</p>
              
              <div class="stat-grid">
                <div class="stat-box">
                  <div class="stat-value">${flareCount}</div>
                  <div class="stat-label">Flares This Week</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${severityLabel}</div>
                  <div class="stat-label">Average Severity</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${consistency}%</div>
                  <div class="stat-label">Logging Consistency</div>
                </div>
                <div class="stat-box">
                  <div class="stat-value">${entries?.length || 0}</div>
                  <div class="stat-label">Total Entries</div>
                </div>
              </div>
              
              <div class="trend-box">
                <div class="trend-icon">${trendIcon}</div>
                <div style="font-weight: 600; margin-top: 8px;">
                  Your trend is ${trend.charAt(0).toUpperCase() + trend.slice(1)}
                </div>
              </div>
              
              ${topSymptoms.length > 0 ? `
              <div class="section">
                <div class="section-title">Top Symptoms</div>
                ${topSymptoms.map(s => `<span class="chip">${s}</span>`).join('')}
              </div>
              ` : ''}
              
              ${topTriggers.length > 0 ? `
              <div class="section">
                <div class="section-title">Top Triggers</div>
                ${topTriggers.map(t => `<span class="chip">${t}</span>`).join('')}
              </div>
              ` : ''}
              
              ${currentStreak > 0 ? `
              <div class="streak-box">
                <div class="streak-flame">🔥</div>
                <div style="font-size: 24px; font-weight: bold; color: #D6006C;">${currentStreak} Day Streak!</div>
                <div style="font-size: 13px; color: #666; margin-top: 5px;">Keep it going!</div>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin-top: 30px;">
                <p style="color: #666; font-size: 14px;">Keep logging to uncover more insights about your health patterns.</p>
              </div>
            </div>
            
            <div class="footer">
              <p style="margin: 5px 0; font-size: 12px; color: #666;">
                <strong>Jvala</strong> | Personal Health Tracking
              </p>
              <p style="font-size: 11px; color: #999;">
                You're receiving this because you enabled weekly digests.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: "Jvala <onboarding@resend.dev>",
        to: [email],
        subject: `📊 Your Weekly Health Digest - ${flareCount} flares this week`,
        html: emailHtml,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Resend error:', data);
      throw new Error(`Failed to send email: ${JSON.stringify(data)}`);
    }

    console.log('Weekly digest sent successfully:', data);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: data?.id,
        stats: {
          flareCount,
          avgSeverity: severityLabel,
          consistency,
          trend
        }
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending weekly digest:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
