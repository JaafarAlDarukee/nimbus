-- The top bar shows "checked 4m ago": signed-in users may read when the radar last finished,
-- without being able to read the admin-only checker_runs table itself.
create function public.radar_last_checked() returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(finished_at) from public.checker_runs;
$$;

revoke execute on function public.radar_last_checked() from public, anon;
grant execute on function public.radar_last_checked() to authenticated;
