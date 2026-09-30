-- What the Tracker, Calendar, Companies, CV studio and Profile screens need.

-- Tracker: roles added by hand name their company, and every row can carry a next step and a due date
alter table public.applications
  add column company_name text,
  add column next_step text,
  add column due_on date;

-- CV studio: details ticked "save for the next CV" (name, contact, education, skills, experience)
alter table public.profiles add column cv_details jsonb;
grant update (cv_details) on public.profiles to authenticated;

-- CV studio: one CV per job
create table public.cv_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  title text not null default '',
  company text not null default '',
  link text not null default '',
  jd text not null default '',
  jd_name text,
  mode text check (mode in ('upload', 'build')),
  cv_name text,
  -- Text read from an uploaded CV; the built CV lives in cv
  cv_text text,
  cv jsonb,
  step int not null default 1 check (step between 1 and 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cv_jobs_user_idx on public.cv_jobs (user_id, created_at);
create unique index cv_jobs_user_opportunity_uidx on public.cv_jobs (user_id, opportunity_id)
  where opportunity_id is not null;

alter table public.cv_jobs enable row level security;
grant select, insert, update, delete on public.cv_jobs to authenticated;
grant all on public.cv_jobs to service_role;

create policy "Users manage own CV jobs" on public.cv_jobs
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Companies: "Missing a company?" suggestions, read by the admin
create table public.company_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

alter table public.company_suggestions enable row level security;
grant select, insert on public.company_suggestions to authenticated;
grant all on public.company_suggestions to service_role;

create policy "Users suggest companies" on public.company_suggestions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users read own suggestions, admins read all" on public.company_suggestions
  for select to authenticated using (user_id = (select auth.uid()) or public.is_admin());

-- Companies: open roles per employer name in one object (the page matches names itself;
-- a plain select would stop at the API's 1,000-row limit)
create function public.open_roles_by_company() returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(company_name, n), '{}'::jsonb)
  from (
    select company_name, count(*) as n
    from public.opportunities
    where status = 'open'
    group by company_name
  ) counts;
$$;

revoke execute on function public.open_roles_by_company() from public, anon;
grant execute on function public.open_roles_by_company() to authenticated;
