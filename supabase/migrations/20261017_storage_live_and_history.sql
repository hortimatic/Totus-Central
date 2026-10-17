-- STAGING ONLY: Storage metrics from Supabase and net-growth sampling.
-- The 500 MB cap is the Totus-configured document/assets limit, NOT a Supabase plan quota.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ops_storage_usage_samples(
 day date PRIMARY KEY,
 measured_at timestamptz NOT NULL DEFAULT now(),
 documents_bytes bigint NOT NULL CHECK(documents_bytes>=0),
 assets_bytes bigint NOT NULL CHECK(assets_bytes>=0),
 backup_bytes bigint NOT NULL CHECK(backup_bytes>=0),
 configured_limit_bytes bigint NOT NULL CHECK(configured_limit_bytes>0)
);
ALTER TABLE public.ops_storage_usage_samples ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_storage_usage_samples FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ops_storage_usage_samples TO authenticated;
DROP POLICY IF EXISTS totus_storage_samples_admin_read ON public.ops_storage_usage_samples;
CREATE POLICY totus_storage_samples_admin_read ON public.ops_storage_usage_samples
 FOR SELECT TO authenticated USING (private.is_admin());
CREATE OR REPLACE FUNCTION public.totus_storage_usage()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $fn$
DECLARE
 v_docs bigint:=0; v_assets bigint:=0;v_backups bigint:=0;
 v_docs_count bigint:=0;v_assets_count bigint:=0;v_backup_count bigint:=0;
 v_limit bigint:=524288000;v_used bigint;
 v_today date:=(timezone('Europe/Madrid',now()))::date;
 v_earliest record; v_days integer;v_day_growth numeric:=null;v_estimated integer:=null;
 v_sample_count integer:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT private.totus_is_team_member() THEN
  RAISE EXCEPTION 'Sin acceso a datos de almacenamiento';
 END IF;
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*) INTO v_docs,v_docs_count
   FROM storage.objects WHERE bucket_id='business-documents';
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*) INTO v_assets,v_assets_count
   FROM storage.objects WHERE bucket_id='business-assets';
 SELECT coalesce(sum(coalesce((metadata->>'size')::bigint,0)),0),count(*) INTO v_backups,v_backup_count
   FROM storage.objects WHERE bucket_id='business-backups';
 SELECT coalesce(storage_limit_bytes,524288000) INTO v_limit
 FROM public.ops_business_settings WHERE id=1;
 v_limit:=coalesce(v_limit,524288000);
 v_used:=v_docs+v_assets;
 IF private.is_admin() THEN
  INSERT INTO public.ops_storage_usage_samples(day,measured_at,documents_bytes,assets_bytes,backup_bytes,configured_limit_bytes)
   VALUES(v_today,now(),v_docs,v_assets,v_backups,v_limit)
   ON CONFLICT(day) DO UPDATE SET
    measured_at=excluded.measured_at,documents_bytes=excluded.documents_bytes,
    assets_bytes=excluded.assets_bytes,backup_bytes=excluded.backup_bytes,
    configured_limit_bytes=excluded.configured_limit_bytes;
 END IF;
 SELECT count(*) INTO v_sample_count FROM public.ops_storage_usage_samples;
 -- Require observations 7 or more days apart before extrapolating growth.
 SELECT day,documents_bytes+assets_bytes AS used_bytes INTO v_earliest
 FROM public.ops_storage_usage_samples WHERE day>=v_today-interval '30 days' AND day<=v_today-interval '7 days'
 ORDER BY day ASC LIMIT 1;
 IF FOUND THEN
  v_days:=v_today-v_earliest.day;
  IF v_days>=7 AND v_used>v_earliest.used_bytes AND v_limit>v_used THEN
   v_day_growth:=(v_used-v_earliest.used_bytes)::numeric/v_days;
   IF v_day_growth>0 THEN v_estimated:=ceil((v_limit-v_used)::numeric/v_day_growth)::integer; END IF;
  END IF;
 END IF;
 RETURN jsonb_build_object(
  'status','ok','source','supabase_storage_objects','measured_at',now(),
  'documents_bytes',v_docs,'documents_count',v_docs_count,
  'assets_bytes',v_assets,'assets_count',v_assets_count,
  'backup_bytes',v_backups,'backup_count',v_backup_count,
  'total_bytes',v_used,'all_buckets_bytes',v_used+v_backups,
  'limit_bytes',v_limit,'available_bytes',greatest(0,v_limit-v_used),
  'usage_percent',CASE WHEN v_limit>0 THEN round(100*v_used::numeric/v_limit,2) ELSE null END,
  'sample_count',v_sample_count,'trend_days',v_days,'daily_growth_bytes',v_day_growth,
  'estimated_days_left',v_estimated
 );
END $fn$;
REVOKE ALL ON FUNCTION public.totus_storage_usage() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_storage_usage() TO authenticated;
COMMIT;