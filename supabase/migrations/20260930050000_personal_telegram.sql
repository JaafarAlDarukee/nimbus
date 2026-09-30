-- Personal Telegram alerts: linked chats, "Not for me", reminders sent.

-- One channel row per user and kind, so linking again updates it
create unique index notification_channels_user_channel_uidx on public.notification_channels (user_id, channel);

-- "Not for me" (Telegram button): kept out of that user's For you and alerts
create table public.hidden_opportunities (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

alter table public.hidden_opportunities enable row level security;
grant select, insert, delete on public.hidden_opportunities to authenticated;
grant all on public.hidden_opportunities to service_role;

create policy "Users manage own hidden roles" on public.hidden_opportunities
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Calendar "Remind me the day before": when the reminder went out
alter table public.calendar_events add column reminded_at timestamptz;
