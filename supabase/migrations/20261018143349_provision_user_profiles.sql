-- A profile supplies author foreign keys; authorization remains in team_members.
-- Never promote roles from user-editable Auth metadata.
create or replace function private.totus_provision_auth_profile()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.profiles(id,email,full_name,role,active)
  values(new.id,lower(new.email),coalesce((select tm.full_name from public.team_members tm where lower(tm.email)=lower(new.email) limit 1),''),'pendiente',false)
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function private.totus_provision_auth_profile() from public,anon,authenticated;
create trigger totus_provision_auth_profile_tg after insert on auth.users
for each row execute function private.totus_provision_auth_profile();

insert into public.profiles(id,email,full_name,role,active)
select u.id,lower(u.email),coalesce(tm.full_name,''),'pendiente',false
from auth.users u left join public.team_members tm on lower(tm.email)=lower(u.email)
where not exists(select 1 from public.profiles p where p.id=u.id)
on conflict(id) do nothing;
