-- Adzuna is back (more UK employers), labelled "via Adzuna". Its API only lists the last few days,
-- so an Adzuna ad isn't "gone" when it stops appearing: it closes 30 days after it was found,
-- like alert-email jobs. When the employer's own site has the same job, the Adzuna copy closes.
create or replace function public.close_gone_opportunities() returns integer
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
        or (o.source_kind in ('inbox', 'adzuna') and o.first_seen_at < now() - interval '30 days')
        or (
          coalesce(o.source_kind, '') not in ('inbox', 'adzuna')
          and o.last_seen_at < now() - interval '3 days'
          and exists (
            select 1 from public.sources s
            where s.id = o.source_id and s.last_success_at > now() - interval '12 hours'
          )
        )
        or (
          o.source_kind = 'adzuna'
          and exists (
            select 1 from public.opportunities d
            where d.status = 'open' and d.source_kind <> 'adzuna'
              and lower(d.title) = lower(o.title)
              and split_part(lower(d.company_name), ' ', 1) = split_part(lower(o.company_name), ' ', 1)
          )
        )
      )
    returning 1
  )
  select count(*)::integer from closed;
$$;

-- Bring back the Adzuna ads closed on 30 Sep (the clean-up re-checks them against today's rules)
update public.opportunities
set status = 'open'
where source_kind = 'adzuna' and status = 'closed' and first_seen_at > now() - interval '30 days';
