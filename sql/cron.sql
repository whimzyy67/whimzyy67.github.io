-- Run ONCE in Supabase > SQL Editor, AFTER the function is deployed.
-- 1) Replace YOUR_PROJECT_URL with your project URL, for example https://abcdxyz.supabase.co (no slash at the end)
-- 2) Replace YOUR_CRON_SECRET with the CRON_SECRET from push-setup.txt
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ select net.http_post(
       url     := 'YOUR_PROJECT_URL/functions/v1/send-reminders',
       headers := '{"Content-Type":"application/json","x-cron-secret":"YOUR_CRON_SECRET"}'::jsonb,
       body    := '{}'::jsonb
     ) $$
);
