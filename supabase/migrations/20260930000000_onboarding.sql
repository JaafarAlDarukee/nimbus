-- Onboarding: name and completion on the profile, private CV storage, Telegram connect codes.
-- The answers themselves (field, degrees, year, industries, types, locations) live in
-- profiles.preferences (jsonb), which users can already update for their own row.

alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column onboarded_at timestamptz;

grant update (first_name, last_name, onboarded_at) on public.profiles to authenticated;

-- Discord joins the alert channels
alter table public.notification_channels drop constraint notification_channels_channel_check;
alter table public.notification_channels
  add constraint notification_channels_channel_check
  check (channel in ('telegram', 'whatsapp', 'email', 'push', 'discord'));

-- One-time codes for linking Telegram: the website creates one, the user opens
-- t.me/NimbusRadarBot?start=<code>, and the bot matches the code to the account.
create table public.telegram_links (
  code text primary key default replace(gen_random_uuid()::text, '-', ''),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);

alter table public.telegram_links enable row level security;
grant select, insert on public.telegram_links to authenticated;
grant all on public.telegram_links to service_role;

create policy "Users create own Telegram codes" on public.telegram_links
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users read own Telegram codes" on public.telegram_links
  for select to authenticated using (user_id = (select auth.uid()));

-- Private CV storage: each user may only touch files inside their own folder (<user id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cvs', 'cvs', false, 5242880,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do nothing;

create policy "Users manage own CVs" on storage.objects
  for all to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = (select auth.uid())::text);
