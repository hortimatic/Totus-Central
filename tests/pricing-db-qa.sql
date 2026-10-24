-- Isolated PostgreSQL only. No connection to production.
create function public.qa_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception '%',message;end if;end$$;
set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","create":true,"edit":true}';
do $$
declare
 p jsonb:='{"id":"22222222-2222-4222-8222-222222222222","is_new":true,"name":"Sales QA","sku":"SALES","product_type":"variants","status":"PENDIENTE","current_pvp":null,"proposed_pvp":null,"quick_competitor":null,"quick_discount":0,"units_month":0,"notes":""}';
 v jsonb:='[{"id":"33333333-3333-4333-8333-333333333333","name":"10 mg","sku":"SALES-10","cost_net":3.2,"pvp":5.7,"attributes":{"Nicotina":"10 mg"},"active":true},{"id":"44444444-4444-4444-8444-444444444444","name":"20 mg","sku":"SALES-20","cost_net":4.1,"pvp":7.1,"active":true}]';
 r jsonb; current_stamp text; failed boolean;
begin
 r:=public.totus_pricing_save_product(p,v);
 perform public.qa_assert((select count(*)=1 from public.products),'Parent persisted');
 perform public.qa_assert((select count(*)=2 from public.product_variants),'Both variants persisted');
 perform public.qa_assert((select count(*)=1 from public.price_history),'One atomic history');
 r:=public.totus_pricing_save_product(p,v);
 perform public.qa_assert((r->>'replayed')::boolean,'Exact retry idempotent');
 perform public.qa_assert((select count(*)=2 from public.product_variants),'Retry creates no duplicates');
 failed:=false;
 begin perform public.totus_pricing_save_product(p||'{"name":"Changed retry"}',v);exception when others then failed:=true;end;
 perform public.qa_assert(failed,'Changed retry must not overwrite');
 failed:=false;
 begin
  perform public.totus_pricing_save_product(p||'{"id":"55555555-5555-4555-8555-555555555555","sku":"OTHER"}',
   '[{"id":"66666666-6666-4666-8666-666666666666","name":"a","sku":"TMP","cost_net":1,"pvp":2},{"id":"77777777-7777-4777-8777-777777777777","name":"b","sku":" sales-10 ","cost_net":1,"pvp":2}]');
 exception when unique_violation then failed:=true;end;
 perform public.qa_assert(failed,'Duplicate SKU rejected even with case/space differences');
 perform public.qa_assert((select count(*)=1 from public.products),'Late variant failure rolls back parent');
 perform public.qa_assert((select count(*)=2 from public.product_variants),'Late failure rolls back earlier child');
 perform public.qa_assert((select count(*)=1 from public.price_history),'Late failure rolls back history');
 select updated_at::text into current_stamp from public.products;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","create":false,"edit":true}',false);
 r:=public.totus_pricing_save_product(p||jsonb_build_object('is_new',false,'name','Edited','expected_updated_at',current_stamp),'[]');
 perform public.qa_assert((select count(*)=2 from public.price_history),'Editor without create permission records history');
 failed:=false;
 begin perform public.totus_pricing_save_product(p||jsonb_build_object('is_new',false,'expected_updated_at',current_stamp),'[]');exception when others then failed:=true;end;
 perform public.qa_assert(failed,'Stale editor cannot overwrite newer save');
 failed:=false;
 begin perform public.totus_pricing_save_product(p||'{"id":"88888888-8888-4888-8888-888888888888","sku":"DENIED"}',v);exception when insufficient_privilege then failed:=true;end;
 perform public.qa_assert(failed,'Edit permission does not grant create');
end$$;
reset role;
select 'PRICING DB: atomic save, rollback, duplicate guard, retry, concurrent edit and RLS passed' as result;
