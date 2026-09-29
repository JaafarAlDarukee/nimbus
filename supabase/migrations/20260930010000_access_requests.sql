-- Invite by approval: anyone can ask for access with their email; an admin approves or
-- declines. Supabase Auth runs hook_before_user_created before creating ANY account, and it
-- refuses every email that hasn't been approved, so the website can't be bypassed.

create table public.access_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  -- When the admin was told about it on Telegram
  notified_at timestamptz
);

create unique index access_requests_email_uidx on public.access_requests (lower(email));

alter table public.access_requests enable row level security;

-- Anyone (signed in or not) may ask; they can't read or change requests
grant insert (email) on public.access_requests to anon, authenticated;
create policy "Anyone can request access" on public.access_requests
  for insert to anon, authenticated with check (status = 'pending');

-- Admins see and decide requests
grant select, update (status, decided_at) on public.access_requests to authenticated;
create policy "Admins read access requests" on public.access_requests
  for select to authenticated using (public.is_admin());
create policy "Admins decide access requests" on public.access_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

grant all on public.access_requests to service_role;

create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_email text := lower(event -> 'user' ->> 'email');
begin
  if exists (
    select 1 from public.access_requests r
    where lower(r.email) = new_email and r.status = 'approved'
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'This email has not been approved for Nimbus yet.')
  );
end;
$$;

revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
