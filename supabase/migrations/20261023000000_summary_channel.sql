-- A private channel just for the morning summary (owner, 23 Oct), chosen with buttons in Telegram.
alter table public.telegram_channels drop constraint if exists telegram_channels_field_check;
alter table public.telegram_channels add constraint telegram_channels_field_check
  check (field in ('engineering', 'medical', 'business', 'computing', 'science', 'creative', 'summary'));
