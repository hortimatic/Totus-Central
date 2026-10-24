CREATE OR REPLACE FUNCTION private.totus_recovery_schema_hash()
 RETURNS text LANGUAGE sql STABLE SET search_path TO ''
AS $function$
 select encode(extensions.digest(jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,a.attidentity) order by c.relname,a.attnum)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()) and a.attnum>0 and not a.attisdropped
    and not (c.relname='profiles' and a.attname='ui_preferences')
    and not (c.relname='ops_expense_categories' and a.attname='report_group')),
  'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname)
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables())
    and not (c.relname='ops_expense_categories' and k.conname='ops_expense_categories_report_group_check'))
 )::text,'sha256'),'hex');
$function$;
