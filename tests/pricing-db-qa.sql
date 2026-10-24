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

set role authenticated;
set request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","create":true,"edit":true}';
do $$
declare p jsonb:='{"product_id":"22222222-2222-4222-8222-222222222222","provider_id":"99999999-9999-4999-8999-999999999999","net_cost":2,"provider_discount":0,"shipping_unit":0,"moq":0,"selected":true}';
 v_saved_id uuid;failed boolean:=false;
begin
 v_saved_id:=public.totus_pricing_save_provider(p);
 begin perform public.totus_pricing_save_provider(p||'{"provider_id":"88888888-8888-4888-8888-888888888888"}');exception when foreign_key_violation then failed:=true;end;
 perform public.qa_assert(failed,'Supplier save failure reproduced after unselection');
 perform public.qa_assert((select selected from public.product_provider_prices where product_provider_prices.id=v_saved_id),'Supplier selection restored after failed insert');
 perform public.qa_assert((select count(*)=1 from public.product_provider_prices),'No partial supplier rows');
end$$;
reset role;

set role authenticated;
do $$
declare p jsonb:='{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","is_new":true,"name":"Simple QA","sku":"SIMPLE","product_type":"simple","status":"PENDIENTE","quick_discount":0,"units_month":0,"current_pvp":5.7}';failed boolean:=false;
begin
 perform public.totus_pricing_save_product(p,'[]','{"name":"Nuevo proveedor QA","net_cost":3.2,"provider_discount":0,"shipping_unit":0}');
 perform public.qa_assert((select count(*)=1 from public.providers where name='Nuevo proveedor QA'),'Initial supplier created');
 perform public.qa_assert((select count(*)=1 from public.product_provider_prices where product_id=(p->>'id')::uuid and selected),'Initial price selected');
 begin
  perform public.totus_pricing_save_product(p||'{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","sku":"FAIL-SIMPLE"}','[]','{"name":"Proveedor rollback","net_cost":null}');
 exception when others then failed:=true;end;
 perform public.qa_assert(failed,'Invalid initial cost fails');
 perform public.qa_assert(not exists(select 1 from public.products where sku='FAIL-SIMPLE'),'Initial cost error rolls back product');
 perform public.qa_assert(not exists(select 1 from public.providers where name='Proveedor rollback'),'Initial cost error rolls back supplier');
end$$;
reset role;
