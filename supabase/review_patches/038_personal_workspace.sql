-- Extend the existing backed-up profile JSON; no new table or broader read policy.
begin;
create or replace function private.totus_save_account(p_user_id uuid,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs jsonb; saved jsonb; revision bigint; pair record; actor_email text; target_email text; merged jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_team_member(),false) then raise exception 'Tu cuenta no tiene acceso activo.';end if;
 if p_user_id is null or (p_user_id<>auth.uid() and not coalesce(private.is_admin(),false)) then raise exception 'Solo administración puede editar el perfil de otro usuario.';end if;
 if p_config is null or jsonb_typeof(p_config)<>'object' then raise exception 'Perfil no válido.';end if;
 perform private.totus_chat_write_lock();
 select coalesce(ui_preferences,'{}'::jsonb),email into prefs,target_email from public.profiles where id=p_user_id for update;
 if not found or not exists(select 1 from public.team_members where lower(email)=lower(target_email)) then raise exception 'No se encontró el perfil de un usuario del equipo.';end if;
 revision=coalesce((prefs#>>'{account,revision}')::bigint,0);
 if p_expected_revision is distinct from revision then raise exception 'El perfil cambió en otra ventana. Actualiza antes de guardar.';end if;
 -- Older clients do not send notes. A profile/photo update must preserve them.
 merged=coalesce(prefs#>'{account,config}','{}'::jsonb)||p_config;
 for pair in select key,value from jsonb_each(merged) loop
  if pair.key not in ('display_name','phone','photo','notes') or jsonb_typeof(pair.value)<>'string' then raise exception 'Campo de perfil no permitido.';end if;
  if pair.key='display_name' and length(pair.value#>>'{}')>90 then raise exception 'El nombre es demasiado largo.';end if;
  if pair.key='phone' and length(pair.value#>>'{}')>40 then raise exception 'El teléfono es demasiado largo.';end if;
  if pair.key='notes' and length(pair.value#>>'{}')>10000 then raise exception 'Las notas son demasiado largas.';end if;
  if pair.key='photo' and (length(pair.value#>>'{}')>350000 or ((pair.value#>>'{}')<>'' and (pair.value#>>'{}') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')) then raise exception 'La foto no es válida.';end if;
 end loop;
 saved=jsonb_build_object('config',merged,'revision',revision+1);
 update public.profiles set ui_preferences=jsonb_set(prefs,'{account}',saved,true) where id=p_user_id;
 select email into actor_email from public.profiles where id=auth.uid();
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(auth.uid(),actor_email,'administracion',case when p_user_id=auth.uid() then 'perfil_personal_guardado' else 'perfil_usuario_guardado' end,jsonb_build_object('target_user_id',p_user_id,'target_email',target_email,'revision',revision+1));
 return saved;
end $$;
create or replace function private.totus_save_my_account(p_config jsonb,p_expected_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_save_account(auth.uid(),p_config,p_expected_revision)$$;
create or replace function public.totus_admin_save_account(p_user_id uuid,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'Solo administración puede gestionar perfiles.';end if;
 return private.totus_save_account(p_user_id,p_config,p_expected_revision);
end $$;
revoke all on function private.totus_save_account(uuid,jsonb,bigint),private.totus_save_my_account(jsonb,bigint),public.totus_admin_save_account(uuid,jsonb,bigint) from public,anon;
grant execute on function private.totus_save_account(uuid,jsonb,bigint),private.totus_save_my_account(jsonb,bigint),public.totus_admin_save_account(uuid,jsonb,bigint) to authenticated;
commit;
