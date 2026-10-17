-- Going paid (owner, 17 Oct 2026): anyone can sign up and use Nimbus free for 2 days (5 jobs,
-- 2 CVs), then it locks until they pay £5 once (Stripe payment link). Admins always have access.

-- Access per person. Users can't write these (column grants below stay as they were); Stripe's
-- webhook (service role) and admins (functions below) can.
alter table public.profiles
  add column paid_at timestamptz,
  add column trial_ends_at timestamptz not null default (now() + interval '2 days'),
  -- When the radar last told this person their trial ended (sent once)
  add column trial_notice_at timestamptz;

-- Everyone already on Nimbus starts their 2 days today
update public.profiles set trial_ends_at = now() + interval '2 days';

-- Payments recorded by the Stripe webhook (for Admin's totals)
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_pence integer not null,
  currency text not null default 'gbp',
  stripe_session text unique,
  created_at timestamptz not null default now()
);
alter table public.payments enable row level security;
create policy "Admins read payments" on public.payments
  for select to authenticated using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
grant select on public.payments to authenticated;

-- Small settings the owner edits on Admin: the Stripe payment link and the private channel's
-- invite link (the invite is only readable by people who have paid).
create table public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
create policy "Signed-in users read settings" on public.app_settings
  for select to authenticated using (
    key <> 'channel_invite'
    or exists (select 1 from public.profiles p where p.id = auth.uid() and (p.is_admin or p.paid_at is not null))
  );
create policy "Admins write settings" on public.app_settings
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
grant select, insert, update on public.app_settings to authenticated;
insert into public.app_settings (key) values ('stripe_link'), ('channel_invite') on conflict do nothing;

-- Admin: everyone on Nimbus with their access state (emails come from auth.users)
create function public.admin_members()
returns table (id uuid, email text, first_name text, created_at timestamptz, onboarded_at timestamptz,
               trial_ends_at timestamptz, paid_at timestamptz, is_admin boolean, applications text, heard_from text)
language sql
security definer
set search_path = ''
as $$
  select p.id, u.email::text, p.first_name, p.created_at, p.onboarded_at, p.trial_ends_at, p.paid_at, p.is_admin,
         p.preferences->>'applications', p.preferences->>'heardFrom'
  from public.profiles p
  join auth.users u on u.id = p.id
  where exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin)
  order by p.created_at desc;
$$;
revoke execute on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

-- Admin: mark someone as paid (cash, a friend) or undo it
create function public.admin_set_paid(target uuid, paid boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles me where me.id = auth.uid() and me.is_admin) then
    raise exception 'admins only';
  end if;
  update public.profiles set paid_at = case when paid then coalesce(paid_at, now()) else null end where id = target;
end;
$$;
revoke execute on function public.admin_set_paid(uuid, boolean) from public, anon;
grant execute on function public.admin_set_paid(uuid, boolean) to authenticated;
