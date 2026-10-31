begin;
select set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","create":true,"edit":true}',true);
do $qa$
declare
 p jsonb:=jsonb_build_object('store_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','business_date',private.totus_business_today(),'status','cerrado','reported_total_sales',70);
 d jsonb:='[{"drawer_id":"11111111-1111-4111-8111-111111111111","opening_cash":100,"closing_cash":100,"card_sales":30,"cash_withdrawals":20,"reported_total_sales":50},{"drawer_id":"22222222-2222-4222-8222-222222222222","opening_cash":0,"closing_cash":20,"reported_total_sales":20}]';
 saved uuid; blocked boolean; current_row public.ops_daily_closings%rowtype; restored public.ops_daily_closing_drawers%rowtype;
begin
 saved:=public.totus_save_closing(p,d);p:=p||jsonb_build_object('id',saved);
 select * into current_row from public.ops_daily_closings where id=saved;
 perform qa_assert(current_row.reported_total_sales=70 and current_row.cash_sales+current_row.card_sales=70,'Two drawer references total 70, never 140');
 perform qa_assert((select sum(reported_total_sales)=70 and count(reported_total_sales)=2 from public.ops_daily_closing_drawers where closing_id=saved),'Both references persist');
 blocked:=false;begin perform public.totus_save_closing(p,jsonb_set(jsonb_set(d,'{0,reported_total_sales}','60'),'{1,reported_total_sales}','10'));exception when others then blocked:=sqlerrm like '%no cuadran%';end;
 perform qa_assert(blocked,'Individual differences cannot offset each other');
 perform qa_assert((select sum(reported_total_sales)=70 from public.ops_daily_closing_drawers where closing_id=saved),'Failure rolls back all drawer writes');
 blocked:=false;begin perform public.totus_save_closing(p,jsonb_set(d,'{1,reported_total_sales}','null'));exception when others then blocked:=sqlerrm like '%todas las cajas%';end;
 perform qa_assert(blocked,'Partial references cannot close');
 blocked:=false;begin perform public.totus_save_closing(p||'{"reported_total_sales":80}',d);exception when others then blocked:=sqlerrm like '%no coincide%';end;
 perform qa_assert(blocked,'Parent total must match drawer sum');
 perform public.totus_save_closing(p||'{"status":"borrador","reported_total_sales":null}',jsonb_set(d,'{1,reported_total_sales}','null'));
 perform qa_assert((select reported_total_sales is null from public.ops_daily_closings where id=saved),'Partial draft total stays unknown');
 perform public.totus_save_closing(p||'{"status":"borrador","reported_total_sales":null}',(select jsonb_agg(j-'reported_total_sales') from jsonb_array_elements(d) j));
 perform qa_assert((select count(reported_total_sales)=1 and sum(reported_total_sales)=50 from public.ops_daily_closing_drawers where closing_id=saved),'Older client preserves partial references');
 perform public.totus_save_closing(p,d);
 perform public.totus_save_closing(p,(select jsonb_agg(j-'reported_total_sales') from jsonb_array_elements(d) j));
 perform qa_assert((select sum(reported_total_sales)=70 from public.ops_daily_closing_drawers where closing_id=saved),'Older client preserves complete references');
 select (jsonb_populate_record(null::public.ops_daily_closing_drawers,to_jsonb(x))).* into restored from public.ops_daily_closing_drawers x where closing_id=saved limit 1;
 perform qa_assert(restored.reported_total_sales is not null,'Recovery serialization retains new field');
 select (jsonb_populate_record(null::public.ops_daily_closing_drawers,to_jsonb(x)-'reported_total_sales')).* into restored from public.ops_daily_closing_drawers x where closing_id=saved limit 1;
 perform qa_assert(restored.reported_total_sales is null,'Legacy recovery leaves unknown sales unknown');
 perform public.totus_save_closing(p||jsonb_build_object('id',null,'business_date',private.totus_business_today()-1),(select jsonb_agg(j-'reported_total_sales') from jsonb_array_elements(d) j));
 perform qa_assert((select reported_total_sales=70 from public.ops_daily_closings where business_date=private.totus_business_today()-1),'Legacy store totals still work');
 perform qa_assert(not has_function_privilege('authenticated','private.totus_prepare_drawer_sales(jsonb,jsonb)','execute'),'Helper not exposed to users');
 perform set_config('request.jwt.claims','{"sub":"99999999-9999-4999-8999-999999999999","create":false,"edit":false}',true);
 blocked:=false;begin perform public.totus_save_closing(p,d);exception when others then blocked:=sqlerrm like '%administración%';end;
 perform qa_assert(blocked,'Existing authorization remains in force');
end $qa$;
rollback;
