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
 'ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences']::text[];
$function$


-- Old backups predate the stock module. Restore its four absent tables as empty,
-- but only for the exact original 38-table set. No accounting table is optional.
create function private.totus_stock_recovery_payload(p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare extras text[]=array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences']; tab text; n integer;
begin
 select count(*) into n from unnest(extras) t where p_payload?t;
 if n=0 then
  if jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>38 then raise exception 'Inventario de copia incompleto'; end if;
  foreach tab in array private.totus_recovery_tables() loop
   if not tab=any(extras) and jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla %',tab;end if;
  end loop;
  foreach tab in array extras loop p_payload=p_payload||jsonb_build_object(tab,'[]'::jsonb);end loop;
 elsif n<>4 then raise exception 'Las tablas de cotejos de la copia están incompletas';end if;
 return p_payload;
end $$;
revoke all on function private.totus_stock_recovery_payload(jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.totus_verify_recovery_rows(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tabs text[]=private.totus_recovery_tables(); tab text; cols text; tmp text; expected jsonb; actual jsonb; counts jsonb='{}'; fk record; child_cols text; parent_cols text; parent_name text; fk_count integer=0; join_test text; not_null_test text; null_test text; invalid boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Comprobación reservada al servidor'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>20971520 then raise exception 'Datos de comprobación no válidos o demasiado grandes'; end if;
 p_payload=private.totus_stock_recovery_payload(p_payload);
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
  tmp='qa_restore_'||tab;
  execute format('create temporary table %I (like public.%I including defaults including constraints including generated including identity including indexes) on commit drop',tmp,tab);
  select string_agg(format('%I',a.attname),',' order by a.attnum) into cols from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  execute format('insert into pg_temp.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tmp,cols,cols,tab) using p_payload->tab;
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from pg_temp.%I r',tmp) into actual;
  select coalesce(jsonb_agg(case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end order by (case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end)::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
  if actual is distinct from expected then raise exception 'Los datos restaurados de % no coinciden con la copia',tab; end if;
  counts=counts||jsonb_build_object(tab,jsonb_array_length(p_payload->tab));
 end loop;
 for fk in select c.*,child.relname child_table,parent.relname parent_table,pn.nspname parent_schema from pg_catalog.pg_constraint c join pg_catalog.pg_class child on child.oid=c.conrelid join pg_catalog.pg_namespace cn on cn.oid=child.relnamespace join pg_catalog.pg_class parent on parent.oid=c.confrelid join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace where c.contype='f' and cn.nspname='public' and child.relname=any(tabs) loop
  select string_agg(format('%I',a.attname),',' order by k.n) into child_cols from unnest(fk.conkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
  select string_agg(format('%I',a.attname),',' order by k.n) into parent_cols from unnest(fk.confkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=fk.confrelid and a.attnum=k.attnum;
  if fk.parent_schema='public' and fk.parent_table=any(tabs) then
   parent_name=format('pg_temp.%I','qa_restore_'||fk.parent_table);
   execute format('alter table pg_temp.%I add constraint %I foreign key (%s) references %s (%s) match %s','qa_restore_'||fk.child_table,'qa_fk_'||fk.oid,child_cols,parent_name,parent_cols,case fk.confmatchtype when 'f' then 'full' else 'simple' end);
  else
   parent_name=format('%I.%I',fk.parent_schema,fk.parent_table);
   select string_agg(format('r.%I=p.%I',ca.attname,pa.attname),' and ' order by k.n),string_agg(format('r.%I is not null',ca.attname),' and ' order by k.n),string_agg(format('r.%I is null',ca.attname),' and ' order by k.n)
   into join_test,not_null_test,null_test from unnest(fk.conkey,fk.confkey) with ordinality k(child_num,parent_num,n)
   join pg_catalog.pg_attribute ca on ca.attrelid=fk.conrelid and ca.attnum=k.child_num
   join pg_catalog.pg_attribute pa on pa.attrelid=fk.confrelid and pa.attnum=k.parent_num;
   execute format('select exists(select 1 from pg_temp.%I r where ((%s) and not exists(select 1 from %s p where %s)) or (%L and not (%s) and not (%s)))','qa_restore_'||fk.child_table,not_null_test,parent_name,join_test,fk.confmatchtype='f',not_null_test,null_test) into invalid;
   if invalid then raise exception 'Referencia externa no válida en %',fk.child_table; end if;
  end if;
  fk_count=fk_count+1;
 end loop;
 return jsonb_build_object('verified',true,'mode','temporary-tables-no-live-writes','table_count',cardinality(tabs),'foreign_keys',fk_count,'counts',counts);
end $function$

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
  or not coalesce((p_metadata->>'schema_hash'=private.totus_recovery_schema_hash()
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
$function$
