-- Explicit permanent removal after the reversible trash step. Never deletes chat or documents.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
create or replace function private.totus_task_purge(p_task_id uuid,p_task_version timestamptz,p_confirmation text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_task_actor();t public.ops_tasks;n_events integer;n_occurrences integer;
begin
 if auth.uid() is null or actor is null or not private.totus_module_can(actor,'tareas','delete') then raise exception 'No tienes permiso para eliminar definitivamente tareas.';end if;
 if p_confirmation is distinct from 'ELIMINAR TAREA' then raise exception 'Escribe ELIMINAR TAREA para confirmar.';end if;
 perform private.totus_chat_write_lock();
 select * into strict t from public.ops_tasks where id=p_task_id for update;
 if not private.totus_task_manage(t) then raise exception 'No puedes gestionar esta tarea.';end if;
 if t.deleted_at is null then raise exception 'Envía primero la tarea a Eliminadas.';end if;
 if t.updated_at is distinct from p_task_version then raise exception 'La tarea ha cambiado. Actualiza antes de continuar.';end if;
 select count(*) into n_events from public.ops_task_events where task_id=t.id;
 select count(*) into n_occurrences from public.ops_task_occurrences where task_id=t.id;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(auth.uid(),actor,'tareas','task_purged',jsonb_build_object('task_id',t.id,'title',t.title,'occurrences_removed',n_occurrences,'events_removed',n_events,'documents_preserved',true));
 delete from public.ops_task_events where task_id=t.id;
 delete from public.ops_task_occurrences where task_id=t.id;
 delete from public.ops_tasks where id=t.id;
 return jsonb_build_object('id',t.id,'purged',true,'documents_preserved',true);
end;$$;
create or replace function public.totus_task_purge(p_task_id uuid,p_task_version timestamptz,p_confirmation text) returns jsonb
language sql security invoker set search_path='' as $$select private.totus_task_purge(p_task_id,p_task_version,p_confirmation)$$;
revoke all on function private.totus_task_purge(uuid,timestamptz,text),public.totus_task_purge(uuid,timestamptz,text) from public,anon;
grant execute on function private.totus_task_purge(uuid,timestamptz,text),public.totus_task_purge(uuid,timestamptz,text) to authenticated;
commit;
