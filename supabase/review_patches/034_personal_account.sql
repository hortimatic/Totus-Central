-- Personal display profile; never changes identity, roles, grants or business records.
begin;
create or replace function private.totus_save_my_account(p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs jsonb; saved jsonb; revision bigint; pair record; actor_email text;
begin
 if auth.uid() is null or not coalesce(private.is_team_member(),false) then raise exception 'Tu cuenta no tiene acceso activo.';end if;
 if p_config is null or jsonb_typeof(p_config)<>'object' then raise exception 'Perfil no válido.';end if;
 for pair in select key,value from jsonb_each(p_config) loop
  if pair.key not in ('display_name','phone','photo') or jsonb_typeof(pair.value)<>'string' then raise exception 'Campo de perfil no permitido.';end if;
  if pair.key='display_name' and length(pair.value#>>'{}')>90 then raise exception 'El nombre es demasiado largo.';end if;
  if pair.key='phone' and length(pair.value#>>'{}')>40 then raise exception 'El teléfono es demasiado largo.';end if;
  if pair.key='photo' and (length(pair.value#>>'{}')>350000 or ((pair.value#>>'{}')<>'' and (pair.value#>>'{}') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')) then raise exception 'La foto no es válida.';end if;
 end loop;
 perform private.totus_chat_write_lock();
 select coalesce(ui_preferences,'{}'::jsonb),email into prefs,actor_email from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'No se encontró tu perfil.';end if;
 revision=coalesce((prefs#>>'{account,revision}')::bigint,0);
 if p_expected_revision is distinct from revision then raise exception 'Tu perfil cambió en otra ventana. Actualiza antes de guardar.';end if;
 saved=jsonb_build_object('config',p_config,'revision',revision+1);
 update public.profiles set ui_preferences=jsonb_set(prefs,'{account}',saved,true) where id=auth.uid();
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(auth.uid(),actor_email,'administracion','perfil_personal_guardado',jsonb_build_object('revision',revision+1));
 return saved;
end $$;
create or replace function public.totus_save_my_account(p_config jsonb,p_expected_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_save_my_account(p_config,p_expected_revision)$$;
revoke all on function private.totus_save_my_account(jsonb,bigint),public.totus_save_my_account(jsonb,bigint) from public,anon;
grant execute on function private.totus_save_my_account(jsonb,bigint),public.totus_save_my_account(jsonb,bigint) to authenticated;
commit;
