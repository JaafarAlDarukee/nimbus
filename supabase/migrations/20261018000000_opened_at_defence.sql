-- Owner, 18 Oct.
-- 1. When a role really opened. Job-site emails (Gradcracker, Bright Network...) often send roles
--    that opened weeks ago, so the time Nimbus found one isn't when it opened. opened_at is the
--    employer's posted date when known, and the earliest date the same role was seen at the same
--    employer (under a near-identical title). The website sorts by it; "Just opened" and alerts use it.
-- 2. Defence, nuclear and weapons roles are kept with a flag instead of being dropped: hidden unless
--    a user turns them on in Profile ("if someone wants defence jobs, BAE, Babcock, let it be visible").

alter table public.opportunities add column if not exists opened_at timestamptz;
alter table public.opportunities add column if not exists defence boolean not null default false;

update public.opportunities set opened_at = least(coalesce(posted_at, first_seen_at), first_seen_at) where opened_at is null;
create index if not exists opportunities_opened_at on public.opportunities (opened_at desc);

-- "Caterpillar UK Ltd" and "Caterpillar" are the same employer
create or replace function public.company_key(name text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(coalesce(name, '')),
    '\m(ltd|limited|plc|llp|inc|group|uk|gmbh|co|the|and|ireland|services|holdings)\M', ' ', 'g'), '[^a-z0-9]+', ' ', 'g'))
$$;

-- The words of a title, without years and little words
create or replace function public.title_words(title text) returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct w), '{}') from regexp_split_to_table(lower(coalesce(title, '')), '[^a-z0-9]+') as w
  where length(w) > 1 and w !~ '^20[0-9][0-9]$' and w not in ('and', 'the', 'of', 'for', 'in', 'at', 'to', 'an', 'with', 'or')
$$;

-- Near-identical: at least 5 words, and 90% of the shorter title's words are in the other
-- ("Manufacturing Engineering (12 Month Placement Scheme)" ~ "12 Month Industrial Placement Scheme -
-- Manufacturing Engineering - Technical Services"), so different roles at one employer stay apart
create or replace function public.similar_titles(a text[], b text[]) returns boolean language sql immutable as $$
  select least(cardinality(a), cardinality(b)) >= 5
    and cardinality(array(select unnest(a) intersect select unnest(b))) >= 0.9 * least(cardinality(a), cardinality(b))
$$;

create index if not exists opportunities_company_word on public.opportunities (split_part(public.company_key(company_name), ' ', 1));

-- Called by the radar for the rows it just saved; returns each row's opened_at
create or replace function public.set_opened_at(ids uuid[]) returns table (id uuid, opened_at timestamptz)
language sql security definer set search_path = public as $$
  with fresh as (
    select o.id, public.company_key(o.company_name) as ckey, public.title_words(o.title) as words, o.first_seen_at,
           least(coalesce(o.posted_at, o.first_seen_at), o.first_seen_at) as base
    from public.opportunities o
    where o.id = any(ids)
  ), earliest as (
    select f.id, least(f.base, min(p.opened_at)) as opened
    from fresh f
    left join public.opportunities p
      on p.id <> f.id
      and f.ckey <> '' and f.ckey not like 'via %'
      and split_part(public.company_key(p.company_name), ' ', 1) = split_part(f.ckey, ' ', 1)
      and (public.company_key(p.company_name) = f.ckey
           or public.company_key(p.company_name) like f.ckey || ' %'
           or f.ckey like public.company_key(p.company_name) || ' %')
      and p.first_seen_at between f.first_seen_at - interval '120 days' and f.first_seen_at
      and p.opened_at is not null
      and public.similar_titles(public.title_words(p.title), f.words)
    group by f.id, f.base
  )
  update public.opportunities o set opened_at = e.opened from earliest e where o.id = e.id
  returning o.id, o.opened_at
$$;
revoke execute on function public.set_opened_at(uuid[]) from public, anon, authenticated;
grant execute on function public.set_opened_at(uuid[]) to service_role;
