-- Prepare a component backup atomically. No new access is granted to browsers.
create or replace function public.totus_backup_prepare_work(p_run uuid,p_path text,p_state jsonb,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare run_status text; existing public.ops_backup_work;
begin
 if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Solo el servidor puede preparar una copia';end if;
 if p_run is null or p_path is null or length(p_path) not between 1 and 1000 or p_path !~ '\.totusbackup$' or p_path ~ '(^|/)\.\.(/|$)'
  or jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_snapshot) is distinct from 'object'
  or p_state->>'path' is distinct from p_path or p_state->'manifest'->>'revision' is distinct from p_snapshot->>'revision'
  or coalesce(p_snapshot->>'revision','') !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(p_snapshot->'database') is distinct from 'object'
  or octet_length(p_state::text)>8388608 or octet_length(p_snapshot::text)>41943040 then raise exception 'Preparación de copia no válida';end if;
 select status into run_status from public.ops_backup_runs where id=p_run for update;
 if not found or run_status<>'running' then raise exception 'La copia ya no está en preparación';end if;
 select * into existing from public.ops_backup_work where run_id=p_run;
 if found then
  if existing.state->>'path' is distinct from p_path or existing.snapshot->>'revision' is distinct from p_snapshot->>'revision' then raise exception 'La preparación no coincide con la copia existente';end if;
  return jsonb_build_object('run_id',existing.run_id,'state',existing.state);
 end if;
 update public.ops_backup_runs set storage_path=p_path,archive_manifest=jsonb_build_object('bundle_version',4),error_message='Preparando documentos por componentes' where id=p_run;
 insert into public.ops_backup_work(run_id,state,snapshot) values(p_run,p_state,p_snapshot) returning * into existing;
 return jsonb_build_object('run_id',existing.run_id,'state',existing.state);
end $$;
revoke all on function public.totus_backup_prepare_work(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_backup_prepare_work(uuid,text,jsonb,jsonb) to service_role;
