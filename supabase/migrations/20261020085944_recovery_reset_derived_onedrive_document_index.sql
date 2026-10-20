CREATE OR REPLACE FUNCTION public.totus_commit_recovery(p_job uuid, p_payload jsonb, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare job public.ops_recovery_jobs; tab text; tabs text[]=private.totus_recovery_tables();
 pending text[]; remaining text[]; ready boolean; progressed boolean; before_data jsonb; after_data jsonb;
 columns_sql text; truncate_sql text; trigger_state jsonb; seq record; next_id bigint;
 expected jsonb; counts jsonb='{}'; item jsonb;
begin
 select * into job from public.ops_recovery_jobs where id=p_job for update;
 if not found then raise exception 'Solicitud de recuperación inexistente'; end if;
 if job.status='committed' then return job.result; end if;
 if job.status<>'prepared' or job.checkpoint_path is null or job.before_revision is null then
  raise exception 'La preparación y el punto de recuperación no están completos';
 end if;
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
  where u.id=job.requested_by and lower(u.email)=job.requested_email and t.active and t.role='admin') then
  raise exception 'La cuenta solicitante ya no es un administrador activo';
 end if;
 if p_metadata->>'database_instance' is distinct from (select instance_id::text from private.totus_recovery_identity where singleton)
  or p_metadata->>'schema_hash' is distinct from private.totus_recovery_schema_hash() then
  raise exception 'La copia pertenece a otro proyecto o a una estructura de datos incompatible';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Datos de copia no válidos'; end if;
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p_payload->'team_members') t
   where lower(t->>'email')=job.requested_email and t->>'role'='admin' and (t->>'active')::boolean)
  or not exists(select 1 from jsonb_array_elements(p_payload->'profiles') p
   where p->>'id'=job.requested_by::text and lower(p->>'email')=job.requested_email) then
  raise exception 'La copia no conserva la cuenta administradora que realiza la recuperación';
 end if;
 for item in select value from jsonb_array_elements(p_payload->'profiles') loop
  if not exists(select 1 from auth.users u join jsonb_array_elements(p_metadata->'identities') i
   on i->>'id'=u.id::text and lower(i->>'email')=lower(u.email)
   where u.id::text=item->>'id' and lower(u.email)=lower(item->>'email')) then
   raise exception 'La copia hace referencia a una cuenta que falta o ha cambiado. No se han sustituido datos';
  end if;
 end loop;
 if exists(select 1 from private.totus_recovery_file_refs(p_payload) f left join storage.objects o
  on o.bucket_id=f.bucket and o.name=f.path where o.id is null or (f.path not like 'recovery/'||p_job::text||'/%' and not private.totus_reusable_live_file(f.bucket,f.path,p_payload))) then
  raise exception 'Hay archivos de la copia que no han sido preparados';
 end if;
 for tab in select unnest(tabs) order by 1 loop
  execute format('lock table public.%I in access exclusive mode',tab);
 end loop;
 before_data=private.totus_recovery_dataset();
 if encode(extensions.digest(before_data::text,'sha256'),'hex')<>job.before_revision then
  raise exception 'Los datos han cambiado durante la preparación. Se cancela para conservar los cambios recientes';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'state',t.tgenabled)),'[]'::jsonb)
 into trigger_state from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(tabs) and not t.tgisinternal;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I disable trigger %I',item->>'table',item->>'name');
 end loop;
 select string_agg(format('public.%I',t),',') into truncate_sql from unnest(tabs) t;
 if pg_catalog.to_regclass('public.ops_onedrive_documents') is not null then truncate_sql=truncate_sql||',public.ops_onedrive_documents'; end if;
 execute 'truncate table '||truncate_sql||' restart identity';
 pending=tabs;
 while cardinality(pending)>0 loop
  progressed=false;remaining='{}'::text[];
  foreach tab in array pending loop
   select not exists(select 1 from pg_catalog.pg_constraint c
    where c.contype='f' and c.conrelid=format('public.%I',tab)::regclass
    and c.confrelid<>c.conrelid and c.confrelid in
      (select format('public.%I',x)::regclass from unnest(pending) x)) into ready;
   if ready then
    select string_agg(format('%I',a.attname),',' order by a.attnum) into columns_sql
     from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass
     and a.attnum>0 and not a.attisdropped and a.attgenerated='';
    execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tab,columns_sql,columns_sql,tab)
     using p_payload->tab;
    counts=counts||jsonb_build_object(tab,jsonb_array_length(p_payload->tab));
    progressed=true;
   else remaining=array_append(remaining,tab);
   end if;
  end loop;
  if not progressed then raise exception 'Dependencias cíclicas no compatibles con la recuperación'; end if;
  pending=remaining;
 end loop;
 after_data=private.totus_recovery_dataset();
 foreach tab in array tabs loop
  select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
  if after_data->tab is distinct from expected then raise exception 'La verificación de la tabla % no coincide con la copia',tab; end if;
 end loop;
 for seq in select c.table_name,c.column_name,pg_catalog.pg_get_serial_sequence(format('public.%I',c.table_name),c.column_name) as name
  from information_schema.columns c where c.table_schema='public' and c.table_name=any(tabs) loop
  if seq.name is not null then
   execute format('select greatest(coalesce(max(%I),0)+1,1) from public.%I',seq.column_name,seq.table_name) into next_id;
   execute format('alter sequence %s restart with %s',seq.name,next_id);
  end if;
 end loop;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I %s trigger %I',item->>'table',
   case item->>'state' when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' else 'enable' end,item->>'name');
 end loop;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(job.requested_by,job.requested_email,'administracion','recovery_committed',
  jsonb_build_object('job',p_job,'checkpoint',job.checkpoint_path,'before_revision',job.before_revision,'counts',counts));
 update public.ops_recovery_jobs set status='committed',result=counts,finished_at=now(),error=null where id=p_job;
 return counts;
end;
$function$
;
