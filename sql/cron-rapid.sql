-- Already filled in with your project URL and CRON_SECRET: paste all of it into the SQL Editor and click Run. Run it once.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ select net.http_post(
       url     := 'https://wzosavpwrgpiejnqwymj.supabase.co/functions/v1/rapid-service',
       headers := '{"Content-Type":"application/json","x-cron-secret":"66c2e2e6b4eec6193b2ad9685f4e2a88ab417dfb89b5f655"}'::jsonb,
       body    := '{}'::jsonb
     ) $$
);
