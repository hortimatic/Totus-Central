-- Add chat operations to the existing short-lived, own-user assistant bridge.
-- No new role grants, service-role chat writes, account impersonation or RLS bypass.
BEGIN;
DO $upgrade$
DECLARE definition text;
 old_allowlist text := '''session_check'',''validate_expense'',''save_expense'',''attach_chat_file'',''expense_context'',''review_document''';
 new_allowlist text := '''session_check'',''validate_expense'',''save_expense'',''attach_chat_file'',''expense_context'',''review_document'',''chat_read'',''chat_send''';
 old_caps text := '''save_expense'',''attach_chat_file'',''review_document''';
 new_caps text := '''save_expense'',''attach_chat_file'',''review_document'',''chat_read'',''chat_send''';
BEGIN
 SELECT pg_get_functiondef('private.totus_assistant_submit(text,jsonb)'::regprocedure) INTO definition;
 IF strpos(definition,new_allowlist)=0 THEN
  IF strpos(definition,old_allowlist)=0 THEN RAISE EXCEPTION 'Unexpected assistant submit allowlist; no change made'; END IF;
  EXECUTE replace(definition,old_allowlist,new_allowlist);
 END IF;
 SELECT pg_get_functiondef('private.totus_assistant_capabilities()'::regprocedure) INTO definition;
 IF strpos(definition,new_caps)=0 THEN
  IF strpos(definition,old_caps)=0 OR strpos(definition,'''version'',2')=0 THEN RAISE EXCEPTION 'Unexpected assistant capability contract; no change made'; END IF;
  definition=replace(definition,old_caps,new_caps);
  definition=replace(definition,'''version'',2','''version'',3');
  EXECUTE definition;
 END IF;
 IF strpos(pg_get_functiondef('private.totus_assistant_submit(text,jsonb)'::regprocedure),new_allowlist)=0
  OR strpos(pg_get_functiondef('private.totus_assistant_capabilities()'::regprocedure),new_caps)=0
 THEN RAISE EXCEPTION 'Assistant chat contract did not install'; END IF;
END $upgrade$;
COMMIT;
