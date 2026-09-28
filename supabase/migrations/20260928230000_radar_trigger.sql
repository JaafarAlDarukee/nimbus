-- Reliable radar trigger
--
-- GitHub's own scheduler delays or skips runs when it's busy, which could break the
-- "alert within 3 hours" promise. So the database starts the radar itself: pg_cron fires on a
-- timer and pg_net calls GitHub's "run this workflow" API. GitHub's schedules stay as a backup.
--
-- Needs a GitHub fine-grained token (this repo only, Actions: read and write) saved in
-- Supabase Vault under the name 'github_dispatch_token'. Until then the jobs do nothing.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create function public.dispatch_radar(workflow text) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  token text;
begin
  select decrypted_secret into token
  from vault.decrypted_secrets
  where name = 'github_dispatch_token';

  if token is null then
    raise notice 'github_dispatch_token is not in Vault yet; radar not started';
    return null;
  end if;

  return net.http_post(
    url := format('https://api.github.com/repos/JaafarAlDarukee/nimbus/actions/workflows/%s/dispatches', workflow),
    body := '{"ref": "main"}'::jsonb,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'Content-Type', 'application/json',
      'User-Agent', 'nimbus-supabase-cron'
    )
  );
end;
$$;

-- Only the database itself (cron) may call this, never the website's users
revoke execute on function public.dispatch_radar(text) from public, anon, authenticated;

-- UK priority check every 30 minutes; worldwide scan every 6 hours (off-peak minutes)
select cron.schedule('nimbus-radar-priority', '5,35 * * * *', $$select public.dispatch_radar('radar-priority.yml')$$);
select cron.schedule('nimbus-radar-full', '50 */6 * * *', $$select public.dispatch_radar('radar-full.yml')$$);
