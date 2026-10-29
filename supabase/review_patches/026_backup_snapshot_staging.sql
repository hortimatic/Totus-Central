-- Keep the captured database inside Postgres instead of posting it back as JSON.
create or replace function public.totus_backup_capture_snapshot(p_run uuid,p_capture uuid)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare run_status text; existing public.ops_backup_work; captured jsonb;
begin
 if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Solo el servidor puede preparar una copia';end if;
 if p_run is null or p_capture is null then raise exception 'Reserva de copia no válida';end if;
 select status into run_status from public.ops_backup_runs where id=p_run for update;
 if not found or run_status<>'running' then raise exception 'La copia ya no está en preparación';end if;
 select * into existing from public.ops_backup_work where run_id=p_run;
 if found then
  if existing.state->>'stage' is distinct from 'capturing' then return null;end if;
  if existing.lease_until>now() and existing.state->>'capture_id' is distinct from p_capture::text then return null;end if;
  update public.ops_backup_work set state=jsonb_build_object('stage','capturing','capture_id',p_capture),lease_until=now()+interval '3 minutes',updated_at=now() where run_id=p_run;
  return existing.snapshot;
 end if;
 captured=public.totus_export_recovery_snapshot();
 insert into public.ops_backup_work(run_id,state,snapshot,lease_until)
 values(p_run,jsonb_build_object('stage','capturing','capture_id',p_capture),captured,now()+interval '3 minutes');
 return captured;
end $$;
revoke all on function public.totus_backup_capture_snapshot(uuid,uuid) from public,anon,authenticated;
grant execute on function public.totus_backup_capture_snapshot(uuid,uuid) to service_role;

create or replace function public.totus_backup_prepare_work(p_run uuid,p_path text,p_state jsonb,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare run_status text; existing public.ops_backup_work;
begin
 if coalesce((select auth.jwt()->>'role'),'')<>'service_role' then raise exception 'Solo el servidor puede preparar una copia';end if;
 if p_run is null or p_path is null or length(p_path) not between 1 and 1000 or p_path !~ '\.totusbackup$' or p_path ~ '(^|/)\.\.(/|$)'
  or jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_snapshot) is distinct from 'object'
  or p_state->>'path' is distinct from p_path or p_state->'manifest'->>'revision' is distinct from p_snapshot->>'revision'
  or coalesce(p_snapshot->>'revision','') !~ '^[0-9a-f]{64}$' or coalesce(p_snapshot->>'source_revision','') !~ '^[0-9a-f]{40}$'
  or coalesce(p_snapshot->>'project_ref','') !~ '^[a-z0-9-]{1,80}$' or p_snapshot?'database'
  or octet_length(p_state::text)>8388608 or octet_length(p_snapshot::text)>4096 then raise exception 'Preparación de copia no válida';end if;
 select status into run_status from public.ops_backup_runs where id=p_run for update;
 if not found or run_status<>'running' then raise exception 'La copia ya no está en preparación';end if;
 select * into existing from public.ops_backup_work where run_id=p_run for update;
 if not found or existing.snapshot->>'revision' is distinct from p_snapshot->>'revision' then raise exception 'Falta la captura original verificada de la copia';end if;
 if existing.state->>'stage' is distinct from 'capturing' then
  if existing.state->>'path' is distinct from p_path then raise exception 'La preparación no coincide con la copia existente';end if;
  return jsonb_build_object('run_id',existing.run_id,'state',existing.state);
 end if;
 if existing.state->>'capture_id' is distinct from p_snapshot->>'capture_id' or existing.lease_until<=now() then raise exception 'La reserva de preparación ha caducado';end if;
 update public.ops_backup_runs set storage_path=p_path,archive_manifest=jsonb_build_object('bundle_version',4),error_message='Preparando documentos por componentes' where id=p_run;
 update public.ops_backup_work set state=p_state,snapshot=snapshot||jsonb_build_object('source_revision',p_snapshot->>'source_revision','project_ref',p_snapshot->>'project_ref'),lease_until=null,updated_at=now() where run_id=p_run;
 return jsonb_build_object('run_id',p_run,'state',p_state);
end $$;
revoke all on function public.totus_backup_prepare_work(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_backup_prepare_work(uuid,text,jsonb,jsonb) to service_role;
