-- Create a cron job to run process-reminders every hour
-- This will check all users' reminder times and send notifications/emails
SELECT cron.schedule(
  'process-reminders-hourly',
  '0 * * * *', -- Run at the start of every hour
  $$
  SELECT
    net.http_post(
      url:='https://rvhpwjhemwvvdtnzmobs.supabase.co/functions/v1/process-reminders',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ2aHB3amhlbXd2dmR0bnptb2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODAyMDgsImV4cCI6MjA3NTM1NjIwOH0.2g2DDjiaxZh9TDRLPm8OhyxeNj4NkSX91YoJbdgFvNM"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);