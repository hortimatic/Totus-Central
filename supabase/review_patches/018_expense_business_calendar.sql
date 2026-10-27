-- Dates of business operations follow the shops' Europe/Madrid calendar.
-- No accounting rows or permissions are changed.
CREATE OR REPLACE FUNCTION private.totus_business_today()
RETURNS date LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date
$$;
REVOKE ALL ON FUNCTION private.totus_business_today() FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE target text; original text; expected integer; actual integer;
BEGIN
 FOR target,expected IN SELECT * FROM (VALUES
 ('public.totus_save_expense(jsonb,jsonb)',2),
 ('public.totus_set_expense_payment(uuid,text,numeric,date)',1)) AS entries(signature,count_expected)
 LOOP
  original=pg_get_functiondef(target::regprocedure);
  IF strpos(original,'private.totus_business_today()')>0 THEN CONTINUE; END IF;
  actual=(length(original)-length(replace(original,'>current_date','')))/length('>current_date');
  IF actual<>expected THEN RAISE EXCEPTION 'Revisar comprobaciones de fecha antes de cambiar %: %',target,actual; END IF;
  EXECUTE replace(original,'>current_date','>private.totus_business_today()');
 END LOOP;
END $patch$;
