-- The owner's own Telegram channels, one per field (owner, 17 Oct). The bot registers a channel when
-- the owner (a Nimbus admin) adds it as an admin there; Admin picks its field; the radar posts every
-- new UK and Ireland role whose subjects fit. Chat IDs live here, never in the repo.
create table public.telegram_channels (
  chat_id text primary key,
  title text not null default '',
  field text check (field in ('engineering', 'medical', 'business', 'computing', 'science', 'creative')),
  added_at timestamptz not null default now()
);
alter table public.telegram_channels enable row level security;
create policy "Admins manage field channels" on public.telegram_channels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.telegram_channels to authenticated;
