-- STAGING ONLY. Enabling scheduling does not start backups until the admin explicitly activates it.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE TABLE IF NOT EXISTS public.ops_backup_config (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1),
 enabled boolean NOT NULL DEFAULT false,
 frequency text NOT NULL DEFAULT 'daily' CHECK(frequency IN ('daily','weekly','monthly')),
 run_hour smallint NOT NULL DEFAULT 3 CHECK(run_hour BETWEEN 0 AND 23),
 run_minute smallint NOT NULL DEFAULT 0 CHECK(run_minute BETWEEN 0 AND 59),
 weekday smallint NOT NULL DEFAULT 1 CHECK(weekday BETWEEN 0 AND 6),
 month_day smallint NOT NULL DEFAULT 1 CHECK(month_day BETWEEN 1 AND 28),
 retention_days integer NOT NULL DEFAULT 10 CHECK(retention_days BETWEEN 1 AND 365),
 destination_folder text NOT NULL DEFAULT 'automaticas' CHECK (destination_folder ~ '^[a-zA-Z0-9_-]{3,48}$'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ops_backup_config(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS public.ops_backup_runs(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 mode text NOT NULL CHECK(mode IN ('manual','scheduled')),
 period_key text UNIQUE,
 status text NOT NULL DEFAULT 'running' CHECK(status IN ('running','success','failed','expired')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 storage_path text,
 size_bytes bigint NOT NULL DEFAULT 0,
 rows_count bigint NOT NULL DEFAULT 0,
 files_count bigint NOT NULL DEFAULT 0,
 error_message text
);
CREATE INDEX IF NOT EXISTS ops_backup_runs_start ON public.ops_backup_runs(started_at DESC);
ALTER TABLE public.ops_backup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_backup_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_backup_config,public.ops_backup_runs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ops_backup_config,public.ops_backup_runs TO authenticated;
CREATE POLICY totus_backup_config_admin_view ON public.ops_backup_config FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY totus_backup_runs_admin_view ON public.ops_backup_runs FOR SELECT TO authenticated USING (private.is_admin());
-- Only an authenticated administrator can write settings via an audited procedure.
CREATE OR REPLACE FUNCTION public.totus_backup_save_settings(p jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
BEGIN
 IF auth.uid() IS NULL OR NOT private.is_admin() THEN RAISE EXCEPTION 'Solo administrador'; END IF;
 UPDATE public.ops_backup_config SET
   enabled=coalesce((p->>'enabled')::boolean,false),
   frequency=coalesce(p->>'frequency','daily'),
   run_hour=coalesce((p->>'run_hour')::smallint,3),
   run_minute=coalesce((p->>'run_minute')::smallint,0),
   weekday=coalesce((p->>'weekday')::smallint,1),
   month_day=coalesce((p->>'month_day')::smallint,1),
   retention_days=coalesce((p->>'retention_days')::integer,10),
   destination_folder=coalesce(p->>'destination_folder','automaticas'),
   updated_at=now()
 WHERE id=1;
END $fn$;
REVOKE ALL ON FUNCTION public.totus_backup_save_settings(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.totus_backup_save_settings(jsonb) TO authenticated;
-- Service-role-only method; JWT/cron are verified in the Edge Function.
CREATE OR REPLACE FUNCTION public.totus_backup_claim(p_mode text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $fn$
DECLARE c public.ops_backup_config; local_date timestamp; key text; new_id uuid;
BEGIN
 IF p_mode NOT IN ('scheduled','manual') THEN RAISE EXCEPTION 'Modo inválido'; END IF;
 SELECT * INTO c FROM public.ops_backup_config WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Falta configuración'; END IF;
 IF p_mode='scheduled' THEN
   IF NOT c.enabled THEN RETURN null; END IF;
   local_date=timezone('Europe/Madrid',now());
   IF extract(hour from local_date)::integer<>c.run_hour
      OR extract(minute from local_date)::integer<>c.run_minute
      OR (c.frequency='weekly' AND extract(dow from local_date)::integer<>c.weekday)
      OR (c.frequency='monthly' AND extract(day from local_date)::integer<>c.month_day)
   THEN RETURN null; END IF;
   key=c.frequency||':'||to_char(local_date,'YYYY-MM-DD');
 END IF;
 INSERT INTO public.ops_backup_runs(mode,period_key) VALUES(p_mode,key)
   ON CONFLICT(period_key) DO NOTHING RETURNING id INTO new_id;
 RETURN new_id;
END $fn$;
REVOKE ALL ON FUNCTION public.totus_backup_claim(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_backup_claim(text) TO service_role;
CREATE OR REPLACE FUNCTION public.totus_backup_cron_authorized(p_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT coalesce(p_key=(SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='totus_staging_backup_cron_secret' ORDER BY created_at DESC LIMIT 1),false)
$fn$;
REVOKE ALL ON FUNCTION public.totus_backup_cron_authorized(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.totus_backup_cron_authorized(text) TO service_role;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('business-backups','business-backups',false,52428800,ARRAY['application/octet-stream'])
ON CONFLICT(id) DO NOTHING;
-- SQL admin access is required for the private storage path: no anonymous files.
CREATE POLICY totus_backup_files_admin_select ON storage.objects FOR SELECT TO authenticated
 USING (bucket_id='business-backups' AND private.is_admin());
-- Scheduled task's bearer secret is never written to source code or the browser.
SELECT vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'totus_staging_backup_cron_secret');
-- Check scheduling in Madrid time, including DST changes; never run while disabled.
SELECT cron.schedule('totus-staging-automatic-backups','* * * * *',
 $job$
 SELECT net.http_post(
   url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-backup-run',
   headers:=jsonb_build_object('Content-Type','application/json','X-Totus-Backup-Job',
     (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='totus_staging_backup_cron_secret' ORDER BY created_at DESC LIMIT 1)),
   body:='{"mode":"scheduled"}'::jsonb,
   timeout_milliseconds:=10000
 ) FROM public.ops_backup_config c
 WHERE c.id=1 AND c.enabled AND
   extract(hour from timezone('Europe/Madrid',now()))::integer=c.run_hour AND
   extract(minute from timezone('Europe/Madrid',now()))::integer=c.run_minute AND
   (c.frequency<>'weekly' OR extract(dow from timezone('Europe/Madrid',now()))::integer=c.weekday) AND
   (c.frequency<>'monthly' OR extract(day from timezone('Europe/Madrid',now()))::integer=c.month_day);
 $job$);
COMMIT;