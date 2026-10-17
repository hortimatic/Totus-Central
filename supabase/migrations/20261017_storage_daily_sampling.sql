-- STAGING ONLY: collect real Storage statistics once a day, even when nobody opens Totus.
-- No files or business records are created, copied or removed.
BEGIN;
CREATE OR REPLACE FUNCTION private.totus_sample_storage_daily()
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=''
AS $fn$
DECLARE
 v_docs bigint; v_assets bigint; v_backups bigint; v_limit bigint; v_day date;
BEGIN
 v_day:=(timezone('Europe/Madrid',now()))::date;
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) INTO v_docs FROM storage.objects WHERE bucket_id='business-documents';
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) INTO v_assets FROM storage.objects WHERE bucket_id='business-assets';
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0) INTO v_backups FROM storage.objects WHERE bucket_id='business-backups';
 SELECT coalesce((SELECT storage_limit_bytes FROM public.ops_business_settings WHERE id=1),524288000) INTO v_limit;
 INSERT INTO public.ops_storage_usage_samples(day,measured_at,documents_bytes,assets_bytes,backup_bytes,configured_limit_bytes)
 VALUES(v_day,now(),v_docs,v_assets,v_backups,v_limit)
 ON CONFLICT(day) DO UPDATE SET measured_at=excluded.measured_at,
  documents_bytes=excluded.documents_bytes,assets_bytes=excluded.assets_bytes,
  backup_bytes=excluded.backup_bytes,configured_limit_bytes=excluded.configured_limit_bytes;
 DELETE FROM public.ops_storage_usage_samples WHERE day<v_day-365;
END $fn$;
REVOKE ALL ON FUNCTION private.totus_sample_storage_daily() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.totus_sample_storage_daily() TO postgres;
-- DB scheduler uses UTC; sampling at 02:23 UTC corresponds to 03:23/04:23 in Madrid.
SELECT cron.schedule('totus-staging-storage-snapshots','23 2 * * *',
  'SELECT private.totus_sample_storage_daily();');
COMMIT;