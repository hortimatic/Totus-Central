-- Integration check for staging or an isolated local database; persists nothing.
begin;
do $$
declare test_id uuid:=gen_random_uuid(); p public.profiles;
begin
  insert into auth.users(id,email,raw_user_meta_data)
  values(test_id,'profile-trigger-test@qa.invalid','{"role":"admin","active":true}'::jsonb);
  select * into p from public.profiles where id=test_id;
  if not found then raise exception 'Auth account has no author profile'; end if;
  if p.role<>'pendiente' or p.active then raise exception 'Untrusted Auth metadata granted access'; end if;
  if exists(select 1 from public.team_members where email='profile-trigger-test@qa.invalid') then
    raise exception 'Profile provisioning must not grant team membership';
  end if;
end;
$$;
select 'PASS: new Auth accounts receive author profiles without granting access from metadata' as verification;
rollback;
