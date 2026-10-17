-- A Telegram reminder about 12 hours before the free trial ends, sent once (radar/notify/personal.py)
alter table public.profiles add column if not exists trial_reminder_at timestamptz;

-- The contact email on the public Privacy and Terms pages, set on Admin. Only this one setting is
-- readable without signing in.
insert into public.app_settings (key) values ('support_email') on conflict do nothing;
create policy "Anyone reads the contact email" on public.app_settings
  for select to anon using (key = 'support_email');
grant select on public.app_settings to anon;
