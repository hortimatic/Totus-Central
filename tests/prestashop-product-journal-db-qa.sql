\set ON_ERROR_STOP on
-- Disposable PostgreSQL fixture. NEVER run this test against the live project.
DO $roles$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role; END IF;
END $roles$;
CREATE SCHEMA IF NOT EXISTS private;
CREATE TABLE private.totus_api_connections(
 id uuid PRIMARY KEY,
 name text NOT NULL,
 revision bigint NOT NULL,
 verified_revision bigint,
 enabled boolean NOT NULL,
 real_data_authorized boolean NOT NULL
);
INSERT INTO private.totus_api_connections VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','PrestaShop · Hortimatic',2,2,true,true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','PrestaShop · NewOldSmok',3,3,true,true);
\ir ../supabase/migrations/20261106170000_prestashop_product_create_journal.sql
\ir ../supabase/migrations/20261107040000_product_absent_recovery.sql
-- Re-applying the migration must be harmless and must not delete pending rows.
SET ROLE service_role;
DO $tests$
DECLARE
 a jsonb := '{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","connection_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2,
  "store":"hortimatic","reference":"PRUEBAS-UNICA","signature":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}';
 b jsonb := '{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","connection_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2,
  "store":"hortimatic","reference":"PRUEBAS-PENDIENTE","signature":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}';
 id1 uuid := '11111111-1111-4111-8111-111111111111';
 id2 uuid := '22222222-2222-4222-8222-222222222222';
 id3 uuid := '33333333-3333-4333-8333-333333333333';
 id4 uuid := '44444444-4444-4444-8444-444444444444';
 r jsonb;
BEGIN
 r:=public.totus_prestashop_product_create_journal('claim',id1,a);
 IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Initial claim failed: %',r; END IF;
 r:=public.totus_prestashop_product_create_journal('claim',id1,a);
 IF r->>'status'<>'pending' THEN RAISE EXCEPTION 'Claim retried: duplicate POST risk %',r; END IF;
 r:=public.totus_prestashop_product_create_journal('lookup',id1,a);
 IF r->>'status'<>'pending' OR r->>'reference'<>'PRUEBAS-UNICA' THEN RAISE EXCEPTION 'Pending lookup mismatch'; END IF;
 r:=public.totus_prestashop_product_create_journal('claim',id2,a);
 IF r->>'status'<>'duplicate_reference' THEN RAISE EXCEPTION 'Different UUID could duplicate reference: %',r; END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_create_journal('lookup',id1,
   jsonb_set(a,'{actor_id}','"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'::jsonb));
  RAISE EXCEPTION 'WRONG ACTOR ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM='WRONG ACTOR ACCEPTED' THEN RAISE; END IF;
 END;
 r:=public.totus_prestashop_product_create_journal('complete',id1,
  a || '{"product_id":701}'::jsonb);
 IF r->>'status'<>'completed' OR r->>'product_id'<>'701' THEN RAISE EXCEPTION 'Completed record missing: %',r; END IF;
 r:=public.totus_prestashop_product_create_journal('lookup',id1,a);
 IF r->>'status'<>'completed' OR r->>'product_id'<>'701' THEN RAISE EXCEPTION 'Completed lookup incorrect: %',r; END IF;
 r:=public.totus_prestashop_product_step('claim',id1,'variation_blue',a||'{"product_id":701}'::jsonb);
 IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Child stage not claimed'; END IF;
 r:=public.totus_prestashop_product_step('claim',id1,'variation_blue',a||'{"product_id":701}'::jsonb);
 IF r->>'status'<>'pending' THEN RAISE EXCEPTION 'Child stage duplicate claim'; END IF;
 r:=public.totus_prestashop_product_step('uncertain',id1,'variation_blue',a||'{"product_id":701}'::jsonb);
 r:=public.totus_prestashop_product_step('complete',id1,'variation_blue',a||'{"product_id":701,"record_id":801}'::jsonb);
 IF r->>'status'<>'completed' OR r->>'record_id'<>'801' THEN RAISE EXCEPTION 'Child stage reconciliation failed'; END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_step('lookup',id1,'variation_blue',a||'{"product_id":999}'::jsonb);
  RAISE EXCEPTION 'WRONG STAGE PRODUCT ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='WRONG STAGE PRODUCT ACCEPTED' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.totus_prestashop_product_step('lookup',id1,'variation_blue',a||'{"product_id":701,"actor_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}'::jsonb);
  RAISE EXCEPTION 'WRONG STAGE ACTOR ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='WRONG STAGE ACTOR ACCEPTED' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.totus_prestashop_product_create_journal('complete',id1,a||'{"product_id":702}'::jsonb);
  RAISE EXCEPTION 'REPLAY ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='REPLAY ACCEPTED' THEN RAISE; END IF; END;
 r:=public.totus_prestashop_product_create_journal('claim',id3,b);
 IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Second claim failed'; END IF;
 r:=public.totus_prestashop_product_create_journal('uncertain',id3,b);
 IF r->>'status'<>'uncertain' THEN RAISE EXCEPTION 'Uncertain status not recorded'; END IF;
 r:=public.totus_prestashop_product_create_journal('claim',id4,b);
 IF r->>'status'<>'duplicate_reference' THEN RAISE EXCEPTION 'Uncertain POST repeated by new UUID'; END IF;
 r:=public.totus_prestashop_product_create_journal('complete',id3,b||'{"product_id":703}'::jsonb);
 IF r->>'status'<>'completed' OR r->>'product_id'<>'703' THEN RAISE EXCEPTION 'Verified reconciliation did not complete'; END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_create_journal('claim',id4,
   jsonb_set(b,'{connection_id}','"ffffffff-ffff-4fff-8fff-ffffffffffff"'::jsonb));
  RAISE EXCEPTION 'WRONG CONNECTION ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='WRONG CONNECTION ACCEPTED' THEN RAISE; END IF; END;
END $tests$;
RESET ROLE;
DO $verify$
BEGIN
 IF (SELECT count(*) FROM private.totus_prestashop_product_create_requests)<>2
 THEN RAISE EXCEPTION 'Expected exactly two product requests'; END IF;
 IF has_function_privilege('authenticated','public.totus_prestashop_product_create_journal(text,uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.totus_prestashop_product_create_journal(text,uuid,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.totus_prestashop_product_create_journal(text,uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Journal RPC permission isolation failed'; END IF;
 IF has_table_privilege('authenticated','private.totus_prestashop_product_create_requests','SELECT')
 OR has_table_privilege('anon','private.totus_prestashop_product_create_requests','UPDATE')
 THEN RAISE EXCEPTION 'Browser roles can access the journal'; END IF;
 IF has_function_privilege('authenticated','public.totus_prestashop_product_step(text,uuid,text,jsonb)','EXECUTE') OR has_table_privilege('anon','private.totus_prestashop_product_steps','SELECT')
 THEN RAISE EXCEPTION 'Browser roles can access child stages'; END IF;
END $verify$;
SELECT 'prestashop_product_journal_qa_ok' AS result;

SET ROLE service_role;
DO $edit_test$
DECLARE d jsonb:='{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","connection_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2,"signature":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}';
 i uuid:='77777777-7777-4777-8777-777777777777';
BEGIN
 IF public.totus_prestashop_product_edit('lookup',i,d) IS NOT NULL THEN RAISE EXCEPTION 'Unexpected edit'; END IF;
 IF public.totus_prestashop_product_edit('claim',i,d)->>'status'<>'claimed' THEN RAISE EXCEPTION 'Not claimed'; END IF;
 IF public.totus_prestashop_product_edit('claim',i,d)->>'status'<>'pending' THEN RAISE EXCEPTION 'Repeat claim wrote again'; END IF;
 PERFORM public.totus_prestashop_product_edit('uncertain',i,d);
 PERFORM public.totus_prestashop_product_edit('complete',i,d);
 IF public.totus_prestashop_product_edit('lookup',i,d)->>'status'<>'completed' THEN RAISE EXCEPTION 'Not completed'; END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_edit('lookup',i,jsonb_set(d,'{actor_id}','"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'));
  RAISE EXCEPTION 'Foreign identity accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Foreign identity accepted' THEN RAISE; END IF; END;
 IF has_function_privilege('authenticated','public.totus_prestashop_product_edit(text,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser can call private journal'; END IF;
END $edit_test$;
RESET ROLE;

SET ROLE service_role;
DO $retry$
DECLARE d jsonb:='{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","connection_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","revision":2,"store":"hortimatic","reference":"RECOVERY-TEST","signature":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"}';
 i uuid:='88888888-8888-4888-8888-888888888888';
BEGIN
 PERFORM public.totus_prestashop_product_create_journal('claim',i,d);
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,d);RAISE EXCEPTION 'Pending retried';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Pending retried' THEN RAISE;END IF;END;
 PERFORM public.totus_prestashop_product_create_journal('uncertain',i,d);
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,jsonb_set(d,'{actor_id}','"dddddddd-dddd-4ddd-8ddd-dddddddddddd"'));RAISE EXCEPTION 'Foreign retry';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Foreign retry' THEN RAISE;END IF;END;
 IF public.totus_prestashop_product_retry_absent(i,d)->>'status'<>'claimed' THEN RAISE EXCEPTION 'Retry not claimed';END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,d);RAISE EXCEPTION 'Concurrent retry';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Concurrent retry' THEN RAISE;END IF;END;
 PERFORM public.totus_prestashop_product_create_journal('complete',i,d||'{"product_id":999}');
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,d);RAISE EXCEPTION 'Completed retried';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Completed retried' THEN RAISE;END IF;END;
 IF has_function_privilege('authenticated','public.totus_prestashop_product_retry_absent(uuid,jsonb)','EXECUTE') OR has_function_privilege('anon','public.totus_prestashop_product_retry_absent(uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Browser retry privilege';END IF;
END $retry$;
RESET ROLE;
DO $history$ BEGIN
 IF (SELECT jsonb_array_length(retry_history) FROM private.totus_prestashop_product_create_requests WHERE request_id='88888888-8888-4888-8888-888888888888')<>1 THEN RAISE EXCEPTION 'Retry history lost';END IF;
END $history$;

\ir ../supabase/review_patches/069_product_corrected_absent_recovery.sql
\ir product-corrected-recovery-db-qa.sql

\ir existing-product-steps-db-qa.sql

\ir productos-creation-metadata-db-qa.sql

\ir product-edit-recovery-db-qa.sql

\ir product-table-layout-db-qa.sql
