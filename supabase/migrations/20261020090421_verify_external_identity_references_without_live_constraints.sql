create or replace function public.totus_verify_recovery_rows(p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tabs text[]=private.totus_recovery_tables(); tab text; cols text; tmp text; expected jsonb; actual jsonb; counts jsonb='{}'; fk record; child_cols text; parent_cols text; parent_name text; fk_count integer=0; join_test text; not_null_test text; null_test text; invalid boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Comprobación reservada al servidor'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>20971520 then raise exception 'Datos de comprobación no válidos o demasiado grandes'; end if;
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
  tmp='qa_restore_'||tab;
  execute format('create temporary table %I (like public.%I including defaults including constraints including generated including identity including indexes) on commit drop',tmp,tab);
  select string_agg(format('%I',a.attname),',' order by a.attnum) into cols from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  execute format('insert into pg_temp.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tmp,cols,cols,tab) using p_payload->tab;
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from pg_temp.%I r',tmp) into actual;
  select coalesce(jsonb_agg(value order by value::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
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
end $$;
revoke all on function public.totus_verify_recovery_rows(jsonb) from public,anon,authenticated;
grant execute on function public.totus_verify_recovery_rows(jsonb) to service_role;;
