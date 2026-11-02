begin;
create or replace function public.totus_api_call(p_id uuid,p_revision bigint,p_call uuid,p_result jsonb default null) returns void language plpgsql security definer set search_path='' as $$
declare c private.totus_api_connections;
begin
 select * into strict c from private.totus_api_connections where id=p_id for update;
 if c.revision is distinct from p_revision then raise exception 'La conexión ha cambiado durante la petición.';end if;
 if p_result is null then
  if exists(select 1 from private.totus_api_calls where id=p_call) then raise exception 'La petición ya fue iniciada. No se repetirá.';end if;
  if (case when c.baseline_day=current_date then c.baseline_calls else 0 end)+(select count(*) from private.totus_api_calls where connection_id=p_id and created_at>=date_trunc('day',now()))>=c.daily_limit then raise exception 'Límite diario local alcanzado.';end if;
  insert into private.totus_api_calls(id,connection_id,revision) values(p_call,p_id,p_revision);
 else
  update private.totus_api_calls set finished_at=now(),ok=coalesce((p_result->>'ok')::boolean,false),input_tokens=(p_result->>'input_tokens')::bigint,output_tokens=(p_result->>'output_tokens')::bigint where id=p_call and connection_id=p_id and revision=p_revision and finished_at is null;
  if not found then raise exception 'La petición no está pendiente.';end if;
  if coalesce((p_result->>'ok')::boolean,false) then
   update private.totus_api_connections set verified_revision=revision,verified_at=now() where id=p_id;
  elsif coalesce((p_result->>'verification_failed')::boolean,false) then
   update private.totus_api_connections set enabled=false,verified_revision=null,verified_at=null,updated_at=clock_timestamp() where id=p_id;
   update private.totus_ai_config set enabled=case when connection_id=p_id then false else enabled end,revision=revision+1,verified_revision=case when connection_id=p_id then null when verified_revision=revision then revision+1 else null end where id and (connection_id=p_id or reader_connection_id=p_id);
  end if;
 end if;
end;$$;
revoke all on function public.totus_api_call(uuid,bigint,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_api_call(uuid,bigint,uuid,jsonb) to service_role;

commit;
