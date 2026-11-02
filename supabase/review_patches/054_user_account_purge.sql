begin;
alter table public.team_members add column if not exists purged_at timestamptz;
alter table public.team_members add column if not exists purge_auth_id uuid;
create or replace function public.totus_prepare_user_purge(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.team_members;mail text=lower(btrim(p_email));uid uuid;begin
 perform pg_advisory_xact_lock(hashtextextended('totus-user-retirement',0));
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administración puede eliminar definitivamente usuarios.';end if;
 if mail=lower(auth.jwt()->>'email') then raise exception 'No puedes eliminar tu propia cuenta.';end if;
 select * into target from public.team_members where email=mail for update;
 if not found then raise exception 'Usuario no encontrado.';end if;
 if target.active or target.deleted_at is null then raise exception 'Primero retira el acceso del usuario.';end if;
 if exists(select 1 from private.totus_api_connections where actor_email=mail) then raise exception 'Elimina primero las conexiones asignadas a este usuario desde APIs.';end if;
 uid=target.purge_auth_id;
 if uid is null then select id into uid from auth.users where lower(email)=mail;end if;
 update public.team_members set purge_auth_id=uid,auth_cleanup_pending=true where email=mail;
 return jsonb_build_object('auth_id',uid);
end$$;
create or replace function public.totus_finish_user_purge(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.team_members;mail text=lower(btrim(p_email));begin
 perform pg_advisory_xact_lock(hashtextextended('totus-user-retirement',0));
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administración puede eliminar definitivamente usuarios.';end if;
 if mail=lower(auth.jwt()->>'email') then raise exception 'No puedes eliminar tu propia cuenta.';end if;
 select * into target from public.team_members where email=mail for update;
 if not found or target.active or target.deleted_at is null then raise exception 'Primero retira el acceso del usuario.';end if;
 if exists(select 1 from private.totus_api_connections where actor_email=mail) then raise exception 'Elimina primero las conexiones asignadas a este usuario desde APIs.';end if;
 if exists(select 1 from auth.users where (id=target.purge_auth_id or lower(email)=mail) and deleted_at is null) then raise exception 'La eliminación de autenticación todavía no está confirmada.';end if;
 delete from vault.secrets where name in ('totus_api_actor_'||target.purge_auth_id,case mail when 'codex@totuscentral.invalid' then 'totus_codex_credentials' when 'chatgpt@totuscentral.invalid' then 'totus_assistant_credentials' when 'totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else '' end);
 update public.team_members set purged_at=coalesce(purged_at,clock_timestamp()),auth_cleanup_pending=false,updated_at=clock_timestamp() where email=mail;
 delete from public.ops_user_permissions where email=mail;
 insert into public.team_user_audit_log(actor_email,target_email,action,status,detail) values(lower(auth.jwt()->>'email'),mail,'user_purged','ok','Cuenta y credenciales eliminadas; referencias históricas conservadas.');
 return jsonb_build_object('purged',true,'history_preserved',true);
end$$;
revoke all on function public.totus_prepare_user_purge(text),public.totus_finish_user_purge(text) from public,anon;
grant execute on function public.totus_prepare_user_purge(text),public.totus_finish_user_purge(text) to authenticated;
do $$declare definition text;begin
 select pg_get_functiondef('public.totus_restore_user(text)'::regprocedure) into definition;
 definition=replace(definition,'update public.team_members t set deleted_at=null', 'if exists(select 1 from public.team_members where email=target_mail and (purged_at is not null or purge_auth_id is not null)) then raise exception ''La cuenta se ha eliminado definitivamente y no se puede recuperar.'';end if; update public.team_members t set deleted_at=null');
 execute definition;
end$$;
commit;
