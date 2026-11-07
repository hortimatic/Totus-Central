-- Disposable fixture only; preceding journal QA owns schema and fake identities.
SET ROLE service_role;
DO $test$
DECLARE
 i uuid:='99999999-9999-4999-8999-999999999999';
 d jsonb:=jsonb_build_object('actor_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  'connection_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','revision',2,'store','hortimatic',
  'reference','CORRECTED-ABSENT','signature',repeat('a',64));
 replacement jsonb;
 r jsonb;
BEGIN
 PERFORM public.totus_prestashop_product_create_journal('claim',i,d);
 PERFORM public.totus_prestashop_product_create_journal('uncertain',i,d);
 replacement:=d||jsonb_build_object('previous_signature',repeat('a',64),'signature',repeat('b',64));
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,replacement||jsonb_build_object('actor_id','dddddddd-dddd-4ddd-8ddd-dddddddddddd'));
  RAISE EXCEPTION 'Wrong actor accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Wrong actor accepted' THEN RAISE; END IF; END;
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,replacement||jsonb_build_object('previous_signature',repeat('c',64)));
  RAISE EXCEPTION 'Wrong prior signature accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Wrong prior signature accepted' THEN RAISE; END IF; END;
 r:=public.totus_prestashop_product_retry_absent(i,replacement);
 IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Correction not claimed'; END IF;
 BEGIN
  PERFORM public.totus_prestashop_product_retry_absent(i,replacement);
  RAISE EXCEPTION 'Concurrent correction accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Concurrent correction accepted' THEN RAISE; END IF; END;
 PERFORM public.totus_prestashop_product_create_journal('complete',i,replacement||'{"product_id":1001}');
END $test$;
RESET ROLE;
DO $verify$
DECLARE r private.totus_prestashop_product_create_requests%rowtype;
BEGIN
 SELECT * INTO r FROM private.totus_prestashop_product_create_requests WHERE request_id='99999999-9999-4999-8999-999999999999';
 IF r.signature<>repeat('b',64) OR r.status<>'completed' OR r.product_id<>1001
 OR r.retry_history->0->>'previous_signature'<>repeat('a',64)
 OR r.retry_history->0->>'replacement_signature'<>repeat('b',64)
 THEN RAISE EXCEPTION 'Correction lost identity, result or history'; END IF;
 IF has_function_privilege('authenticated','public.totus_prestashop_product_retry_absent(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('anon','public.totus_prestashop_product_retry_absent(uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'Public recovery access'; END IF;
END $verify$;
