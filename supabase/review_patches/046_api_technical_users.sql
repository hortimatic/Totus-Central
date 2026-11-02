begin;
create table if not exists private.totus_api_provisions(id uuid primary key,requested_by uuid not null,name text not null,role text not null,email text not null unique,auth_id uuid,created_at timestamptz not null default now(),finished_at timestamptz);
alter table private.totus_api_provisions enable row level security;
revoke all on private.totus_api_provisions from public,anon,authenticated;
create or replace function public.totus_api_prepare_actor(p_id uuid,p_owner uuid,p_name text,p_role text,p_password text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.totus_api_provisions;credentials jsonb;begin
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where u.id=p_owner and t.active and t.role='admin' and private.totus_module_can(t.email,'configuracion','edit')) then raise exception 'Administración no autorizada para preparar usuarios.';end if;
 if length(btrim(p_name)) not between 1 and 120 or not exists(select 1 from public.ops_roles where code=p_role) or length(p_password)<>64 then raise exception 'Nombre, rol o credencial no válidos.';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_api_provision_'||p_id,0));
 select * into r from private.totus_api_provisions where id=p_id for update;
 if found then
  if r.requested_by<>p_owner or r.name<>btrim(p_name) or r.role<>p_role then raise exception 'Solicitud utilizada con otros datos.';end if;
 else
  insert into private.totus_api_provisions(id,requested_by,name,role,email) values(p_id,p_owner,btrim(p_name),p_role,'integration-'||p_id||'@totuscentral.invalid') returning * into r;
  perform vault.create_secret(jsonb_build_object('email',r.email,'password',p_password)::text,'totus_api_provision_'||p_id,'Pending technical account; never disclose');
 end if;
 if r.finished_at is not null then return jsonb_build_object('complete',true,'actor',jsonb_build_object('id',r.auth_id,'email',r.email,'name',r.name,'role',r.role));end if;
 select decrypted_secret::jsonb into credentials from vault.decrypted_secrets where name='totus_api_provision_'||p_id;
 if credentials is null then raise exception 'La preparación no conserva su credencial. Revisión administrativa necesaria.';end if;
 return jsonb_build_object('complete',false,'credentials',credentials,'name',r.name,'role',r.role);
end;$$;
create or replace function public.totus_api_finish_actor(p_id uuid,p_owner uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.totus_api_provisions;uid uuid;credentials jsonb;begin
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where u.id=p_owner and t.active and t.role='admin' and private.totus_module_can(t.email,'configuracion','edit')) then raise exception 'Administración no autorizada.';end if;
 select * into strict r from private.totus_api_provisions where id=p_id and requested_by=p_owner for update;
 if r.finished_at is not null then return jsonb_build_object('id',r.auth_id,'email',r.email,'name',r.name,'role',r.role);end if;
 select id into uid from auth.users where lower(email)=r.email and raw_app_meta_data->>'totus_integration'='true' and raw_app_meta_data->>'totus_provision_id'=p_id::text;
 if uid is null then raise exception 'La cuenta todavía no se ha creado. Puedes reintentar la misma solicitud.';end if;
 select decrypted_secret::jsonb into credentials from vault.decrypted_secrets where name='totus_api_provision_'||p_id;
 if credentials is null then raise exception 'Falta la credencial de preparación.';end if;
 insert into public.team_members(email,full_name,role,active) values(r.email,r.name,r.role,true) on conflict(email) do update set full_name=excluded.full_name,role=excluded.role,active=true;
 insert into public.profiles(id,email) values(uid,r.email) on conflict(id) do update set email=excluded.email;
 perform public.totus_api_store_actor(uid,credentials->>'password');
 delete from vault.secrets where name='totus_api_provision_'||p_id;
 update private.totus_api_provisions set auth_id=uid,finished_at=now() where id=p_id;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail) values(p_owner,(select email from auth.users where id=p_owner),'administracion','api_usuario_creado',jsonb_build_object('user_id',uid,'role',r.role));
 return jsonb_build_object('id',uid,'email',r.email,'name',r.name,'role',r.role);
end;$$;
revoke all on function public.totus_api_prepare_actor(uuid,uuid,text,text,text),public.totus_api_finish_actor(uuid,uuid) from public,anon,authenticated;
grant execute on function public.totus_api_prepare_actor(uuid,uuid,text,text,text),public.totus_api_finish_actor(uuid,uuid) to service_role;
do $$declare definition text;begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 if position('''roles''' in definition)=0 then
  definition=replace(definition,'''actors'',(select','''roles'',(select jsonb_agg(jsonb_build_object(''code'',code,''name'',name) order by sort_order) from public.ops_roles),''pending_users'',(select coalesce(jsonb_agg(jsonb_build_object(''id'',id,''name'',name,''role'',role)),''[]''::jsonb) from private.totus_api_provisions where finished_at is null and requested_by=auth.uid()),''actors'',(select');
  execute definition;
 end if;
end$$;
commit;
