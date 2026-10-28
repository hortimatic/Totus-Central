-- Run only in the isolated CI database after pricing-db-qa.sql.
begin;
set local role authenticated;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","create":true,"edit":true}';
do $$
declare
 p jsonb:='{"product_id":"22222222-2222-4222-8222-222222222222","provider_id":"99999999-9999-4999-8999-999999999999","request_id":"12345678-1234-4234-8234-123456789012","net_cost":4,"provider_discount":10,"shipping_unit":0.5,"moq":1,"selected":true}';
 first_id uuid;retry_id uuid;before_count integer;before_history integer;failed boolean:=false;
begin
 select count(*) into before_count from public.product_provider_prices;
 select count(*) into before_history from public.price_history;
 first_id:=public.totus_pricing_save_provider(p);
 retry_id:=public.totus_pricing_save_provider(p);
 perform public.qa_assert(first_id=retry_id,'Retry must return the original supplier quote');
 perform public.qa_assert((select count(*)=before_count+1 from public.product_provider_prices),'Retry must not create a duplicate quote');
 perform public.qa_assert((select count(*)=before_history+1 from public.price_history),'Retry must not create duplicate history');
 begin perform public.totus_pricing_save_provider(p||'{"net_cost":5}');exception when others then failed:=true;end;
 perform public.qa_assert(failed,'Changed retry must not overwrite the saved quote');
 perform public.qa_assert((select net_cost=4 from public.product_provider_prices where id=first_id),'Changed retry preserves the original cost');
end$$;
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","create":false,"edit":false}';
do $$
declare failed boolean:=false;
begin
 begin perform public.totus_pricing_save_provider('{"product_id":"22222222-2222-4222-8222-222222222222","provider_id":"99999999-9999-4999-8999-999999999999","request_id":"12345678-1234-4234-8234-123456789012","net_cost":4,"provider_discount":10,"shipping_unit":0.5,"moq":1,"selected":true}');exception when insufficient_privilege then failed:=true;end;
 perform public.qa_assert(failed,'Idempotent retry must still require the normal permission');
end$$;
rollback;
