begin;
alter table public.team_members add column if not exists deleted_at timestamptz;
alter table public.team_members add column if not exists auth_cleanup_pending boolean not null default false;
create or replace function public.totus_retire_user(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.team_members;target_mail text=lower(btrim(p_email));begin
 perform pg_advisory_xact_lock(hashtextextended('totus-user-retirement',0));
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administración puede eliminar usuarios.';end if;
 if target_mail=lower(auth.jwt()->>'email') then raise exception 'No puedes eliminar tu propia cuenta.';end if;
 select * into target from public.team_members t where t.email=target_mail for update;
 if not found then raise exception 'Usuario no encontrado.';end if;
 if target.active and target.role='admin' and (select count(*) from public.team_members where role='admin' and active)<=1 then raise exception 'No puedes dejar el sistema sin ningún administrador activo.';end if;
 update public.team_members t set active=false,deleted_at=coalesce(t.deleted_at,clock_timestamp()),auth_cleanup_pending=true,updated_at=clock_timestamp() where t.email=target_mail;
 update private.totus_api_connections set enabled=false,verified_revision=null,revision=revision+1,updated_at=clock_timestamp() where actor_email=target_mail;
 update private.totus_ai_config set enabled=false,verified_revision=null,revision=revision+1 where id and connection_id in (select id from private.totus_api_connections where actor_email=target_mail);
 update private.totus_ai_jobs set status='cancelled',finished_at=clock_timestamp(),last_error='Se ha retirado el acceso del usuario.' where status in ('pending','working') and (actor_email=target_mail or requested_email=target_mail);
 insert into public.team_user_audit_log(actor_email,target_email,action,status,detail) values(lower(auth.jwt()->>'email'),target_mail,'user_retired','ok','Acceso retirado; identidad, documentos e historial conservados.');
 return jsonb_build_object('email',target_mail,'retired',true,'history_preserved',true);
end $$;
revoke all on function public.totus_retire_user(text) from public,anon;
grant execute on function public.totus_retire_user(text) to authenticated;
create or replace function public.totus_restore_user(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare target_mail text=lower(btrim(p_email));begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administración puede recuperar usuarios.';end if;
 update public.team_members t set deleted_at=null,active=true,auth_cleanup_pending=false,updated_at=clock_timestamp() where t.email=target_mail and t.deleted_at is not null;
 if not found then raise exception 'El usuario no está eliminado.';end if;
 insert into public.team_user_audit_log(actor_email,target_email,action,status,detail) values(lower(auth.jwt()->>'email'),target_mail,'user_restored','ok','Usuario recuperado; conexiones conservadas desactivadas.');
 return jsonb_build_object('restored',true);
end $$;
revoke all on function public.totus_restore_user(text) from public,anon;
grant execute on function public.totus_restore_user(text) to authenticated;
commit;
