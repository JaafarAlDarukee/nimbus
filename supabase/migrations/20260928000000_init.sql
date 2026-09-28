-- Nimbus initial schema
--
-- Two kinds of data:
--   1. Shared reference data (companies, opportunities, news). Written only by the
--      radar using the service role key; every signed-in user can read it.
--   2. Per-user data (profiles, channels, tracker, calendar, alerts). Row level
--      security makes each row visible to its owner only.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared reference data
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.companies (id) on delete set null,
  website text,
  country text not null default 'GB',
  regions text[] not null default '{}',
  sectors text[] not null default '{}',
  -- Where the group offers roles abroad, e.g. {japan, middle_east, europe, north_america}
  global_mobility text[] not null default '{}',
  worth_it_score smallint not null default 50 check (worth_it_score between 0 and 100),
  tier text not null default 'standard' check (tier in ('priority', 'standard', 'low')),
  -- null = not known yet
  hosts_students boolean,
  ats text,
  ats_slug text,
  careers_url text,
  early_careers_url text,
  news_url text,
  -- Published routes only: [{type: email|form|page, value, label, source_url}]
  published_contacts jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

create table public.company_aliases (
  company_id uuid not null references public.companies (id) on delete cascade,
  alias text not null,
  primary key (company_id, alias)
);

create table public.recruiting_routes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  kind text not null check (kind in (
    'own_ats', 'parent_portal', 'agency', 'rpo', 'scheme', 'job_board',
    'talent_pool', 'speculative_email', 'contact_form'
  )),
  label text,
  url text,
  notes text,
  created_at timestamptz not null default now()
);

create index recruiting_routes_company_idx on public.recruiting_routes (company_id);

-- Everything the radar checks, with change-detection markers
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies (id) on delete cascade,
  kind text not null check (kind in (
    'greenhouse', 'lever', 'smartrecruiters', 'workable', 'ashby', 'workday',
    'successfactors', 'rss', 'sitemap', 'page', 'adzuna', 'reed', 'jooble',
    'inbox', 'news'
  )),
  url text not null,
  check_every_minutes integer not null default 120 check (check_every_minutes > 0),
  enabled boolean not null default true,
  last_checked_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  etag text,
  last_modified text,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (kind, url)
);

create index sources_company_idx on public.sources (company_id);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  -- Dedupe key: hash of normalised company + title + location
  fingerprint text not null unique,
  company_id uuid references public.companies (id) on delete set null,
  -- Name as shown by the source; the company may not be matched yet
  company_name text not null,
  title text not null,
  kind text not null default 'unknown' check (kind in (
    'placement', 'internship', 'spring_week', 'insight', 'grad_scheme',
    'graduate_job', 'research', 'apprenticeship', 'scholarship', 'event',
    'speculative', 'other', 'unknown'
  )),
  disciplines text[] not null default '{}',
  skills text[] not null default '{}',
  location_text text,
  country text,
  city text,
  remote boolean,
  apply_url text not null,
  published_contacts jsonb not null default '[]',
  description text,
  posted_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  closes_at timestamptz,
  rolling boolean,
  status text not null default 'open' check (status in ('open', 'closed')),
  source_id uuid references public.sources (id) on delete set null,
  source_kind text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index opportunities_first_seen_idx on public.opportunities (first_seen_at desc);
create index opportunities_company_idx on public.opportunities (company_id);
create index opportunities_kind_idx on public.opportunities (kind);

create table public.company_news (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  title text not null,
  url text not null unique,
  published_at timestamptz,
  source text,
  hiring_signal boolean not null default false,
  first_seen_at timestamptz not null default now()
);

create index company_news_company_idx on public.company_news (company_id);

-- One row per radar run, for the status page and the 3-hour report
create table public.checker_runs (
  id uuid primary key default gen_random_uuid(),
  runner text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  sources_checked integer not null default 0,
  sources_failed integer not null default 0,
  new_opportunities integer not null default 0,
  max_detection_delay_minutes integer,
  errors jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- Per-user data
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  -- Opportunity kinds, disciplines, locations, followed companies
  preferences jsonb not null default '{}',
  alert_settings jsonb not null default
    '{"instant_min_score": 70, "daily_digest": true, "weekly_digest": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone accepts an invite
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Where each user receives alerts; config holds e.g. {chat_id} or {phone, callmebot_key}
create table public.notification_channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null check (channel in ('telegram', 'whatsapp', 'email', 'push')),
  config jsonb not null default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index notification_channels_user_idx on public.notification_channels (user_id);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  company_id uuid references public.companies (id) on delete set null,
  -- Used for speculative or manually added entries
  title text,
  stage text not null default 'saved' check (stage in (
    'saved', 'speculative', 'applied', 'online_test', 'video_interview',
    'assessment_centre', 'interview', 'offer', 'accepted',
    'rejected', 'ghosted', 'withdrawn', 'declined'
  )),
  applied_at timestamptz,
  last_update_at timestamptz not null default now(),
  next_follow_up_at timestamptz,
  contact_notes text,
  notes text,
  cv_version text,
  created_at timestamptz not null default now(),
  check (opportunity_id is not null or company_id is not null or title is not null)
);

create index applications_user_idx on public.applications (user_id);
create unique index applications_user_opportunity_uidx
  on public.applications (user_id, opportunity_id) where opportunity_id is not null;

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid references public.applications (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  kind text not null check (kind in (
    'deadline', 'online_test', 'interview', 'assessment_centre',
    'follow_up', 'likely_opening', 'other'
  )),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  remind boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

create index calendar_events_user_idx on public.calendar_events (user_id, starts_at);

create table public.alerts_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  channel text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, opportunity_id, channel)
);

-- ---------------------------------------------------------------------------
-- Access rules
-- ---------------------------------------------------------------------------

-- Nothing is readable without signing in
revoke all on all tables in schema public from anon;

alter table public.companies enable row level security;
alter table public.company_aliases enable row level security;
alter table public.recruiting_routes enable row level security;
alter table public.sources enable row level security;
alter table public.opportunities enable row level security;
alter table public.company_news enable row level security;
alter table public.checker_runs enable row level security;
alter table public.profiles enable row level security;
alter table public.notification_channels enable row level security;
alter table public.applications enable row level security;
alter table public.calendar_events enable row level security;
alter table public.alerts_sent enable row level security;

-- Shared reference data: read-only for signed-in users
grant select on public.companies, public.company_aliases, public.recruiting_routes,
  public.opportunities, public.company_news to authenticated;

create policy "Signed-in users read companies" on public.companies
  for select to authenticated using (true);
create policy "Signed-in users read company aliases" on public.company_aliases
  for select to authenticated using (true);
create policy "Signed-in users read recruiting routes" on public.recruiting_routes
  for select to authenticated using (true);
create policy "Signed-in users read opportunities" on public.opportunities
  for select to authenticated using (true);
create policy "Signed-in users read company news" on public.company_news
  for select to authenticated using (true);

-- Radar internals: admins only (status page)
grant select on public.sources, public.checker_runs to authenticated;

create policy "Admins read sources" on public.sources
  for select to authenticated using (public.is_admin());
create policy "Admins read checker runs" on public.checker_runs
  for select to authenticated using (public.is_admin());

-- Profiles: own row only, and nobody can make themselves admin
revoke update on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, preferences, alert_settings) on public.profiles to authenticated;

create policy "Users read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Users update own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Per-user tables: full control of own rows only
grant select, insert, update, delete on public.notification_channels,
  public.applications, public.calendar_events to authenticated;

create policy "Users manage own channels" on public.notification_channels
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own applications" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own calendar" on public.calendar_events
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Alert log: users can see what was sent to them; only the server writes it
grant select on public.alerts_sent to authenticated;

create policy "Users read own alerts" on public.alerts_sent
  for select to authenticated using (user_id = (select auth.uid()));

-- The radar and server functions use the service role, which bypasses RLS
grant all on all tables in schema public to service_role;

-- Live dashboard updates when new opportunities arrive
alter publication supabase_realtime add table public.opportunities;
