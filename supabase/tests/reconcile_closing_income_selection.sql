-- Run with an authenticated administrator test session. All writes roll back.
begin;
do $test$
declare target public.ops_daily_closings%rowtype; payload jsonb; drawer_values jsonb; result_id uuid;
begin
 select * into target from public.ops_daily_closings where include_in_income=false order by business_date,id limit 1 for update;
 if target.id is null then raise exception 'Requires a reference-covered closing fixture'; end if;
 select jsonb_agg(jsonb_build_object('drawer_id',id,'opening_cash',0,'closing_cash',0,'card_sales',60,'bizum_sales',0,'online_sales',0,'other_income',0,'cash_withdrawals',0,'cash_expenses_declared',0,'cash_extra_in',0,'cash_extra_out',0)) into drawer_values from public.ops_cash_drawers where store_id=target.store_id and active;
 payload:=jsonb_build_object('id',target.id,'store_id',target.store_id,'business_date',target.business_date,'reported_total_sales',60*jsonb_array_length(drawer_values),'status','cerrado','notes','QA transaction rolled back');
 result_id:=public.totus_save_closing(payload,drawer_values);
 if not exists(select 1 from public.ops_daily_closings where id=result_id and status='cerrado' and include_in_income=false and source_ref is not distinct from target.source_ref) then raise exception 'Reconciliation changed fiscal selection or lost original evidence'; end if;
 perform public.totus_save_closing(payload||jsonb_build_object('status','borrador'),drawer_values);
 if (select include_in_income from public.ops_daily_closings where id=result_id) then raise exception 'Reopening changed fiscal selection';end if;
end $test$;
rollback;
