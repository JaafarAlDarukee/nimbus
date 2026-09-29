-- The first account ever created becomes the admin (the person who set Nimbus up), so no
-- email address has to be written into this public repository.
create or replace function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, is_admin)
  values (
    new.id,
    split_part(new.email, '@', 1),
    not exists (select 1 from public.profiles where is_admin)
  );
  return new;
end;
$$;
