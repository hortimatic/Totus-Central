-- Extend verified recovery with all three task tables; retain 38/42/49 table copies.
CREATE OR REPLACE FUNCTION private.totus_recovery_tables()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select array[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history',
 'ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config',
 'profiles','team_members','team_email_log','team_user_audit_log',
 'ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences','ops_chat_channels','ops_chat_members','ops_chat_messages','ops_chat_reactions','ops_chat_events','ops_chat_files','ops_chat_agent_requests','ops_tasks','ops_task_occurrences','ops_task_events']::text[];
$function$;

create or replace function private.totus_stock_recovery_payload(p_payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare tabs text[]=private.totus_recovery_tables(); chat text[]=array['ops_chat_channels','ops_chat_members','ops_chat_messages','ops_chat_reactions','ops_chat_events','ops_chat_files','ops_chat_agent_requests']::text[]; tasks text[]=array['ops_tasks','ops_task_occurrences','ops_task_events']; stock text[]=array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences']; tab text; n integer;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Inventario de copia no válido';end if;
 select count(*) into n from jsonb_object_keys(p_payload);
 if n not in (38,42,49,52) then raise exception 'Inventario de copia incompleto';end if;
 foreach tab in array tabs loop
  if n=38 and tab=any(stock||chat||tasks) or n=42 and tab=any(chat||tasks) or n=49 and tab=any(tasks) then
   if p_payload?tab then raise exception 'Inventario antiguo con tablas mezcladas';end if;
  elsif jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab;end if;
 end loop;
 foreach tab in array tabs loop if not p_payload?tab then p_payload=p_payload||jsonb_build_object(tab,'[]'::jsonb);end if;end loop;
 return p_payload;
end $$;
revoke all on function private.totus_stock_recovery_payload(jsonb) from public,anon,authenticated;

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
 onedrive_before jsonb; expected jsonb; counts jsonb='{}'; item jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(724021126::bigint);
 perform 1 from public.ops_onedrive_config where id=1 for update;
 if exists(select 1 from public.ops_onedrive_config where id=1 and retirement_lock_until>now()) then
  raise exception 'Espera a que termine la limpieza de duplicados antes de recuperar una copia';
 end if;
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
  or not coalesce(((p_metadata->>'schema_hash'=private.totus_recovery_schema_hash() and (select count(*) from jsonb_object_keys(p_payload))=52)
   or (p_metadata->>'schema_hash'='512d6a886f2d35281b96dc6e9217342e1985fcfa821a7ad80c6cc872525f22c3' and not (p_payload ?| array['ops_tasks','ops_task_occurrences','ops_task_events']) and (select count(*) from jsonb_object_keys(p_payload))=49)
   or (p_metadata->>'schema_hash'='557e56cd01a94a52e443ddd1184b3088089c1864fddeaab91bf44ae6e2a2e1fd' and not (p_payload ?| array['ops_chat_channels','ops_chat_members','ops_chat_messages','ops_chat_reactions','ops_chat_events','ops_chat_files','ops_chat_agent_requests']::text[]) and (select count(*) from jsonb_object_keys(p_payload))=42)
   or (p_metadata->>'schema_hash'='52e2e40d2b27ca87540ab4f94e52c850235674b555ecd60fe3bb08eb181f8f45'
    and not (p_payload ?| array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences'])
    and (select count(*) from jsonb_object_keys(p_payload))=38)),false) then
  raise exception 'La copia pertenece a otro proyecto o a una estructura de datos incompatible';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Datos de copia no válidos'; end if;
 p_payload=private.totus_stock_recovery_payload(p_payload);
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
 if not private.totus_recovery_files_ready(p_payload,p_job) then
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
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into onedrive_before from public.ops_onedrive_documents m;
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

 insert into public.ops_onedrive_documents(document_id,source_path,onedrive_path,onedrive_item_id,size_bytes,sha256,verified_at,retired_from_supabase_at)
 select d.id,m.source_path,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256,m.verified_at,m.retired_from_supabase_at
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 join public.ops_documents d on d.storage_path=m.source_path and d.sha256=m.sha256 and d.size_bytes=m.size_bytes
 where m.verified_at is not null
 on conflict(document_id) do nothing;
 insert into public.ops_onedrive_cleanup(document_id,onedrive_path,onedrive_item_id,size_bytes,sha256)
 select m.document_id,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 where not exists(select 1 from public.ops_onedrive_documents live where live.onedrive_item_id=m.onedrive_item_id)
 on conflict(onedrive_item_id) do nothing;
 after_data=private.totus_recovery_dataset();

 foreach tab in array tabs loop
  select coalesce(jsonb_agg(case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end order by (case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end)::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
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
$function$;

