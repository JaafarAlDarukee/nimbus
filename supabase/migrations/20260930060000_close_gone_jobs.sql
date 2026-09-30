-- Jobs employers take down were never closed. After each full radar run (which reads every job on
-- every board), close:
--  - jobs whose closing date passed more than a day ago
--  - jobs from alert emails, 30 days after they arrived (emails are never "seen again")
--  - jobs not seen for 3 days on a board that was read successfully in the last 12 hours
-- A job that comes back is reopened by the radar (seen again → status open).
create function public.close_gone_opportunities() returns integer
language sql
security definer
set search_path = ''
as $$
  with closed as (
    update public.opportunities o
    set status = 'closed'
    where o.status = 'open'
      and (
        o.closes_at < now() - interval '1 day'
        or (o.source_kind = 'inbox' and o.first_seen_at < now() - interval '30 days')
        or (
          coalesce(o.source_kind, '') <> 'inbox'
          and o.last_seen_at < now() - interval '3 days'
          and exists (
            select 1 from public.sources s
            where s.id = o.source_id and s.last_success_at > now() - interval '12 hours'
          )
        )
      )
    returning 1
  )
  select count(*)::integer from closed;
$$;

revoke execute on function public.close_gone_opportunities() from public, anon, authenticated;
grant execute on function public.close_gone_opportunities() to service_role;
