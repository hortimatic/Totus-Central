\set ON_ERROR_STOP on
create role anon;create role authenticated;
\i tests/closing-db-fixture.sql
alter table public.ops_daily_closing_drawers add column reported_total_sales numeric;
create function private.totus_claim_business_request(text,jsonb,jsonb) returns uuid language sql as $$select null::uuid$$;
create function private.totus_finish_business_request(text,jsonb,uuid) returns void language plpgsql as $qa$begin return;end$qa$;
create function private.totus_check_write_version(text,uuid,jsonb) returns void language plpgsql as $qa$begin return;end$qa$;
\i supabase/review_patches/085_pending_cash_discrepancies.sql
\i supabase/review_patches/085_pending_cash_discrepancies.sql
begin;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","create":true,"edit":true}',true);
do $$
declare delta numeric;cid uuid;result public.ops_daily_closings;drawers jsonb;payload jsonb;blocked boolean;
begin
 foreach delta in array array[4.70,-4.70] loop
  payload=jsonb_build_object('store_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','business_date',private.totus_business_today()+case when delta>0 then -1 else 0 end,'reported_total_sales',150,'status','cerrado');
  drawers=jsonb_build_array(jsonb_build_object('drawer_id','11111111-1111-4111-8111-111111111111','opening_cash',100,'closing_cash',150+delta,'card_sales',100,'reported_total_sales',150,'cash_discrepancy',delta,'cash_discrepancy_reason','QA: pendiente de localizar venta'),jsonb_build_object('drawer_id','22222222-2222-4222-8222-222222222222','opening_cash',0,'closing_cash',0,'reported_total_sales',0));
  cid=public.totus_save_closing(payload,drawers);
  select * into strict result from public.ops_daily_closings where id=cid;
  perform qa_assert(result.cash_sales=50 and result.card_sales=100,'No convertir el descuadre en otra venta');
  perform qa_assert(result.actual_cash=150+delta and result.difference=delta,'Conservar dinero físico y signo');
  perform qa_assert((select cash_discrepancy=delta and cash_discrepancy_reason<>'' from public.ops_daily_closing_drawers where closing_id=cid and drawer_id='11111111-1111-4111-8111-111111111111'),'Descuadre y motivo por caja');
  blocked=false;begin perform public.totus_save_closing(payload||jsonb_build_object('id',cid),jsonb_set(drawers,'{0,cash_discrepancy_reason}','""'));exception when others then blocked=true;end;
  perform qa_assert(blocked,'No aceptar descuadre sin motivo');
  blocked=false;begin perform public.totus_save_closing(payload||jsonb_build_object('id',cid),jsonb_set(drawers,'{0,cash_discrepancy}','"NaN"'));exception when others then blocked=true;end;
  perform qa_assert(blocked,'No aceptar importes no finitos');
  perform public.totus_save_closing(payload||jsonb_build_object('id',cid),drawers #- '{0,cash_discrepancy}' #- '{0,cash_discrepancy_reason}');
  perform qa_assert((select cash_discrepancy=delta from public.ops_daily_closing_drawers where closing_id=cid and drawer_id='11111111-1111-4111-8111-111111111111'),'Un cliente anterior no borra el descuadre');
  -- Resolve the actual registered sale later; no duplicate cash entry is introduced.
  if delta>0 then
   drawers=jsonb_set(jsonb_set(jsonb_set(drawers,'{0,reported_total_sales}',to_jsonb(150+delta)),'{0,cash_discrepancy}','0'),'{0,cash_discrepancy_reason}','"Localizada la venta"');
   perform public.totus_save_closing(payload||jsonb_build_object('id',cid,'reported_total_sales',150+delta),drawers);
   perform qa_assert((select difference=0 and cash_sales=50+delta from public.ops_daily_closings where id=cid),'Resolver sin duplicar el ingreso');
  end if;
 end loop;
end $$;
rollback;
