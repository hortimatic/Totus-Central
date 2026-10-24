-- Isolated fixture only. Optional presentation metadata must not invalidate backups.
BEGIN;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
-- The compact stock fixture does not install the base recovery hash function.
CREATE OR REPLACE FUNCTION private.totus_recovery_schema_hash()
 RETURNS text LANGUAGE sql STABLE SET search_path TO ''
AS $function$
 select encode(extensions.digest(jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,a.attidentity) order by c.relname,a.attnum)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()) and a.attnum>0 and not a.attisdropped
    and not (c.relname='profiles' and a.attname='ui_preferences')),
  'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname)
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()))
 )::text,'sha256'),'hex');
$function$;

CREATE TEMP TABLE report_hash_before AS SELECT private.totus_recovery_schema_hash() AS hash;
\ir ../supabase/migrations/20261024182250_expense_category_report_groups.sql
\ir ../supabase/migrations/20261024182743_preserve_recovery_hash_for_report_preferences.sql
DO $$
BEGIN
 IF private.totus_recovery_schema_hash()<>(SELECT hash FROM report_hash_before) THEN
  RAISE EXCEPTION 'Presentation preference invalidated existing backups';
 END IF;
 INSERT INTO public.ops_expense_categories(id,report_group)
 VALUES ('77777777-7777-4777-8777-777777777777','orders');
 IF (SELECT report_group FROM public.ops_expense_categories WHERE id='77777777-7777-4777-8777-777777777777')<>'orders' THEN
  RAISE EXCEPTION 'Preference did not persist';
 END IF;
 BEGIN
  UPDATE public.ops_expense_categories SET report_group='bad' WHERE id='77777777-7777-4777-8777-777777777777';
  RAISE EXCEPTION 'Invalid report group accepted';
 EXCEPTION WHEN check_violation THEN NULL;
 END;
 IF (jsonb_populate_record(null::public.ops_expense_categories,'{}'::jsonb)).report_group IS NOT NULL THEN
  RAISE EXCEPTION 'Old category rows must restore with automatic colors';
 END IF;
 IF (jsonb_populate_record(null::public.ops_expense_categories,'{"report_group":"orders"}'::jsonb)).report_group<>'orders' THEN
  RAISE EXCEPTION 'New backups must preserve chosen colors';
 END IF;
END $$;
ROLLBACK;
