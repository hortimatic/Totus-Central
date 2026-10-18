-- Totus Central · backup y almacenamiento limpio
-- Copias antiguas: solo inspección. Recuperación v3 en migración independiente.

create or replace function private.totus_is_admin()
returns boolean
language sql stable security definer
set search_path='public,private'
as $$
  select private.is_admin();
$$;

create or replace function public.totus_storage_usage()
returns jsonb
language plpgsql security definer
set search_path='public,storage,private'
as $$
declare
  v_docs bigint:=0; v_assets bigint:=0;
  v_docs_count bigint:=0; v_assets_count bigint:=0;
  v_limit bigint:=524288000;
begin
  if not private.totus_is_team_member() then raise exception 'Sin acceso'; end if;
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*)
    into v_docs,v_docs_count from storage.objects where bucket_id='business-documents';
  select coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*)
    into v_assets,v_assets_count from storage.objects where bucket_id='business-assets';
  select coalesce(storage_limit_bytes,524288000) into v_limit
    from public.ops_business_settings where id=1;
  return jsonb_build_object(
    'documents_bytes',v_docs,'documents_count',v_docs_count,
    'assets_bytes',v_assets,'assets_count',v_assets_count,
    'total_bytes',v_docs+v_assets,'limit_bytes',v_limit
  );
end;
$$;

create or replace function public.totus_restore_backup(p_payload jsonb,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin
 raise exception 'La recuperación antigua está deshabilitada. Utiliza una copia v3 y el coordinador de recuperación con punto de vuelta atrás';
end;
$$;


-- Contrato explícito de restauración: impide recuperar copias en servidores con función SQL obsoleta.
create or replace function public.totus_backup_contract()
returns jsonb
language plpgsql security definer
set search_path='public,private'
as $$
begin
  if not private.totus_is_admin() then raise exception 'Solo administración puede comprobar la restauración'; end if;
  return jsonb_build_object('version',3,'income_adjustments',true,'storage',true,'coordinated_recovery',true,'auth_credentials',false);
end;
$$;

revoke all on function public.totus_backup_contract() from public,anon;
grant execute on function public.totus_backup_contract() to authenticated;

revoke all on function private.totus_is_admin() from public;
revoke all on function public.totus_storage_usage() from public,anon;
revoke all on function public.totus_restore_backup(jsonb,text) from public,anon;
grant execute on function public.totus_storage_usage() to authenticated;
-- SAFETY LOCK: do not grant restore EXECUTE until atomic recovery is independently verified.
revoke all on function public.totus_restore_backup(jsonb,text) from authenticated;
