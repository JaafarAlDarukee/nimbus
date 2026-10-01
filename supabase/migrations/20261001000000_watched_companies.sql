-- Companies page: which employers Nimbus actually watches, and open roles counted in the UK.

-- The employer each board belongs to (the radar fills it in on every run)
alter table public.sources add column company_name text;

-- Employers with a board that was read successfully in the last day, and how (Workday, Greenhouse...)
create function public.watched_companies() returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(company_name, kinds), '{}'::jsonb)
  from (
    select company_name, jsonb_agg(distinct kind) as kinds
    from public.sources
    where company_name is not null
      and kind not in ('inbox', 'adzuna')
      and last_success_at > now() - interval '1 day'
    group by company_name
  ) watched;
$$;

revoke execute on function public.watched_companies() from public, anon;
grant execute on function public.watched_companies() to authenticated;

-- Open roles per employer: [in the UK, anywhere]
create or replace function public.open_roles_by_company() returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(company_name, jsonb_build_array(uk, n)), '{}'::jsonb)
  from (
    select company_name, count(*) filter (where country = 'GB') as uk, count(*) as n
    from public.opportunities
    where status = 'open'
    group by company_name
  ) counts;
$$;
