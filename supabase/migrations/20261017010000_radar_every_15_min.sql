-- Alerts as soon as possible (owner, 17 Oct): the priority radar every 15 minutes instead of 30.
-- Minutes chosen not to collide with the full run at :50 every 6 hours.
select cron.unschedule('nimbus-radar-priority');
select cron.schedule('nimbus-radar-priority', '2,17,32,47 * * * *', $$select public.dispatch_radar('radar-priority.yml')$$);
