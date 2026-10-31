-- Run in the existing disposable chat fixture, never against business data.
DO $$
DECLARE c jsonb;
BEGIN
 c=private.totus_assistant_capabilities();
 IF (c->>'version')::integer<>4 OR NOT (c->'actions' ? 'operation') THEN
  RAISE EXCEPTION 'Own-operation contract unavailable';
 END IF;
 IF has_function_privilege('anon','private.totus_assistant_submit(text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','private.totus_assistant_submit(text,jsonb)','EXECUTE')
 OR has_function_privilege('service_role','private.totus_assistant_submit(text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','private.totus_codex_submit(text,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.totus_assistant_validate_expense(jsonb,jsonb)','EXECUTE') THEN
  RAISE EXCEPTION 'Private connector exposed';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid IN (
 'private.totus_assistant_submit(text,jsonb)'::regprocedure,
 'private.totus_codex_submit(text,jsonb)'::regprocedure,
 'public.totus_assistant_validate_expense(jsonb,jsonb)'::regprocedure) AND prosecdef) THEN
  RAISE EXCEPTION 'Own operation changed to definer';
 END IF;
END $$;
