-- Owner, 19 Oct: the companies on the watchlist are checked every 5 minutes, and a morning digest.
alter table public.profiles add column if not exists digest_sent_on date;
select cron.schedule('nimbus-radar-watch', '*/5 * * * *', $$select public.dispatch_radar('radar-watch.yml')$$);
