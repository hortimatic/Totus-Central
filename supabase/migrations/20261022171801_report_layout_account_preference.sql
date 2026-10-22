-- Optional display preference; nullable so older complete backups remain restorable.
alter table public.profiles add column ui_preferences jsonb;
create or replace function private.totus_save_report_layout(p_order text[]) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare uid uuid=auth.uid(); result jsonb;
begin
 if uid is null or not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) where p.id=uid and p.active and t.active and lower(p.email)=lower(auth.jwt()->>'email')) then
  raise exception 'Acceso denegado' using errcode='42501';
 end if;
 if coalesce(array_length(p_order,1),0)<>5 or (select count(distinct v) from unnest(p_order) v)<>5
 or exists(select 1 from unnest(p_order) v where v is null or not (v=any(array['income','internal','monthly','gestor','exports']))) then
  raise exception 'Orden de bloques no válido';
 end if;
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{report_blocks}',to_jsonb(p_order),true) where id=uid returning ui_preferences->'report_blocks' into result;
 return result;
end $function$;
revoke all on function private.totus_save_report_layout(text[]) from public,anon;
grant execute on function private.totus_save_report_layout(text[]) to authenticated;
create or replace function public.totus_save_report_layout(p_order text[]) returns jsonb
language sql security invoker set search_path='' as $function$
 select private.totus_save_report_layout(p_order);
$function$;
revoke all on function public.totus_save_report_layout(text[]) from public,anon;
grant execute on function public.totus_save_report_layout(text[]) to authenticated;
-- Ignore only this optional presentation column in the accounting compatibility fingerprint.
-- It is still included by the full-row export and new backups; old backups restore it as NULL.
CREATE OR REPLACE FUNCTION private.totus_recovery_schema_hash()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select encode(extensions.digest(jsonb_build_object(
  'columns',(select jsonb_agg(jsonb_build_array(c.relname,a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attgenerated,a.attidentity) order by c.relname,a.attnum)
    from pg_catalog.pg_attribute a join pg_catalog.pg_class c on c.oid=a.attrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()) and a.attnum>0 and not a.attisdropped and not (c.relname='profiles' and a.attname='ui_preferences')),
  'constraints',(select jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_catalog.pg_get_constraintdef(k.oid)) order by c.relname,k.conname)
    from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
    join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
    and c.relname=any(private.totus_recovery_tables()))
 )::text,'sha256'),'hex');
$function$
;
