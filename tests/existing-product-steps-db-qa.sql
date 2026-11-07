-- Run after the disposable product-journal fixture, NEVER in production.
\ir ../supabase/review_patches/070_existing_product_steps.sql
SET ROLE service_role;
DO $test$
DECLARE
 i uuid:='77777777-7777-4777-8777-777777777777';
 d jsonb:=jsonb_build_object('actor_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','connection_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','revision',2,'store','hortimatic','product_id',1001,'signature',repeat('a',64));
 r jsonb;
BEGIN
 IF public.totus_prestashop_existing_product_step('lookup',i,'variation_blue',d) IS NOT NULL THEN RAISE EXCEPTION 'Lookup invented a session';END IF;
 r:=public.totus_prestashop_existing_product_step('claim',i,'variation_blue',d);
 IF r->>'status'<>'claimed' THEN RAISE EXCEPTION 'Existing variation claim failed';END IF;
 r:=public.totus_prestashop_existing_product_step('claim',i,'variation_blue',d);
 IF r->>'status'<>'pending' THEN RAISE EXCEPTION 'Repeated claim wrote twice';END IF;
 BEGIN
  PERFORM public.totus_prestashop_existing_product_step('lookup',i,'variation_blue',d||'{"product_id":1002}');
  RAISE EXCEPTION 'Wrong product accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Wrong product accepted' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.totus_prestashop_existing_product_step('lookup',i,'variation_blue',d||'{"actor_id":"dddddddd-dddd-4ddd-8ddd-dddddddddddd"}');
  RAISE EXCEPTION 'Wrong actor accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Wrong actor accepted' THEN RAISE;END IF;END;
 BEGIN
  PERFORM public.totus_prestashop_existing_product_step('claim',i,'variation_blue',d||jsonb_build_object('signature',repeat('b',64)));
  RAISE EXCEPTION 'Changed intent accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Changed intent accepted' THEN RAISE;END IF;END;
 PERFORM public.totus_prestashop_existing_product_step('uncertain',i,'variation_blue',d);
 r:=public.totus_prestashop_existing_product_step('complete',i,'variation_blue',d||'{"record_id":2001}');
 IF r->>'status'<>'completed' OR r->>'record_id'<>'2001' THEN RAISE EXCEPTION 'Verified result lost';END IF;
 IF EXISTS(SELECT 1 FROM private.totus_prestashop_product_create_requests WHERE request_id=i) THEN RAISE EXCEPTION 'Pretended an existing product was newly created';END IF;
END $test$;
RESET ROLE;
DO $acl$ BEGIN
 IF has_function_privilege('anon','public.totus_prestashop_existing_product_step(text,uuid,text,jsonb)','EXECUTE') OR has_function_privilege('authenticated','public.totus_prestashop_existing_product_step(text,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Public stage access';END IF;
END $acl$;
