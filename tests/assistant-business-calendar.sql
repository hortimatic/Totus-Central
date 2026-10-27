-- Integration checks for an installed Totus database; read-only and reversible.
BEGIN;
DO $test$
DECLARE source text;
BEGIN
 IF private.totus_business_today()<>(CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Madrid')::date THEN RAISE EXCEPTION 'Calendario de negocio incorrecto'; END IF;
 IF (timestamptz '2026-10-27 23:30:00+00' AT TIME ZONE 'Europe/Madrid')::date<>date '2026-10-28' THEN RAISE EXCEPTION 'Límite de invierno incorrecto'; END IF;
 IF (timestamptz '2026-07-01 22:30:00+00' AT TIME ZONE 'Europe/Madrid')::date<>date '2026-07-02' THEN RAISE EXCEPTION 'Límite de verano incorrecto'; END IF;
 source=pg_get_functiondef('public.totus_save_expense(jsonb,jsonb)'::regprocedure);
 IF strpos(source,'>current_date')>0 OR (length(source)-length(replace(source,'>private.totus_business_today()','')))/length('>private.totus_business_today()')<>2 THEN RAISE EXCEPTION 'Validación de fecha del gasto sin actualizar'; END IF;
 source=pg_get_functiondef('public.totus_set_expense_payment(uuid,text,numeric,date)'::regprocedure);
 IF strpos(source,'>private.totus_business_today()')=0 THEN RAISE EXCEPTION 'Validación de fecha del pago sin actualizar'; END IF;
 IF to_regprocedure('private.totus_connector_save_expense(text,jsonb,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'La delegación antigua sigue instalada'; END IF;
 IF has_function_privilege('anon','public.totus_assistant_claim(uuid,text)','EXECUTE') OR has_function_privilege('authenticated','public.totus_assistant_claim(uuid,text)','EXECUTE') THEN RAISE EXCEPTION 'Auxiliar sensible accesible al navegador'; END IF;
 IF private.totus_assistant_capabilities()->>'version'<>'2' THEN RAISE EXCEPTION 'Contrato desactualizado'; END IF;
END $test$;
SELECT 'Calendar, retired bridge, grants and contract verified' AS result;
ROLLBACK;
