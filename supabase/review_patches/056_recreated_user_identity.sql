begin;
-- A new account may reuse an email after purge; an old JWT must not inherit it.
create or replace function private.is_team_member() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members tm join auth.users u
 on u.id=auth.uid() and lower(u.email)=lower(tm.email)
 where tm.active and tm.deleted_at is null and tm.purged_at is null and u.deleted_at is null);
$$;
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(auth.role(),'')='service_role' or exists(
 select 1 from public.team_members tm join auth.users u
 on u.id=auth.uid() and lower(u.email)=lower(tm.email)
 where tm.active and tm.role='admin' and tm.deleted_at is null and tm.purged_at is null and u.deleted_at is null);
$$;
-- Administrative connectors identify their own active actor, whose normal
-- module permissions are identical to those required by an authenticated UI.
create or replace function private.totus_stock_actor(p_action text,p_email text default null)
returns text language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if auth.uid() is not null then
  if not private.totus_can('documentos',p_action) then raise exception 'No tienes permiso para esta operación';end if;
  actor=lower(auth.jwt()->>'email');
 elsif auth.role()='service_role' or (session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null) then
  actor=lower(btrim(coalesce(p_email,'')));
  if actor='' then raise exception 'Indica p_actor_email con la cuenta propia activa que realiza el cotejo.';end if;
  if not private.totus_module_can(actor,'documentos',p_action) or not exists(
   select 1 from public.team_members where lower(email)=actor and active and deleted_at is null and purged_at is null
  ) then raise exception 'La cuenta indicada está retirada o no tiene permiso para esta operación en Recepciones.';end if;
 else raise exception 'Sesión requerida';end if;
 return actor;
end$$;
revoke all on function private.is_team_member(),private.is_admin(),private.totus_stock_actor(text,text) from public,anon;
grant execute on function private.is_team_member(),private.is_admin() to authenticated,service_role;
commit;
