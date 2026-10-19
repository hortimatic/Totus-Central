CREATE OR REPLACE FUNCTION public.totus_save_closing(p_closing jsonb, p_drawers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private'
AS $function$
declare
  v_id uuid := nullif(p_closing->>'id','')::uuid;
  v_store uuid := nullif(p_closing->>'store_id','')::uuid;
  v_date date := nullif(p_closing->>'business_date','')::date;
  v_status text := coalesce(nullif(p_closing->>'status',''),'borrador');
  v_include_income boolean := true;
  v_reported numeric := nullif(p_closing->>'reported_total_sales','')::numeric;
  v_open numeric := 0; v_close numeric := 0; v_card numeric := 0; v_bizum numeric := 0;
  v_online numeric := 0; v_other numeric := 0; v_withdraw numeric := 0; v_cash_exp numeric := 0;
  v_extra_in numeric := 0; v_extra_out numeric := 0; v_cash_sales numeric := 0; v_total numeric := 0; v_diff numeric := 0;
begin
  if not (private.totus_can('cajas',case when nullif(p_closing->>'id','') is null then 'create' else 'edit' end)) then raise exception 'Solo administración o gerencia puede guardar cierres'; end if;
  if v_store is null or v_date is null then raise exception 'Tienda y fecha son obligatorias'; end if;
  if v_date>current_date then raise exception 'La fecha del cierre no puede ser futura'; end if;
  if v_status not in ('borrador','cerrado') then raise exception 'Estado de cierre no válido'; end if;
  -- Reconciliation must preserve the existing fiscal selection. A historical
  -- close may already be covered by the accountant's monthly reference.
  if v_id is not null then
    select coalesce(include_in_income,true) into v_include_income
    from public.ops_daily_closings where id=v_id for update;
    if not found then raise exception 'Cierre no encontrado'; end if;
  end if;
  if jsonb_typeof(p_drawers)<>'array' or jsonb_array_length(p_drawers)=0 then raise exception 'Incluye al menos una caja'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_drawers) j
    left join public.ops_cash_drawers d on d.id=nullif(j->>'drawer_id','')::uuid and d.store_id=v_store and d.active
    where d.id is null
  ) then raise exception 'Hay una caja que no pertenece al establecimiento'; end if;

  if exists(
    select 1 from (
      select nullif(j->>'drawer_id','')::uuid id,count(*)
      from jsonb_array_elements(p_drawers) j group by 1 having count(*)>1
    ) x
  ) then raise exception 'No se puede repetir una caja'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_drawers) j
    where coalesce((j->>'opening_cash')::numeric,0)<0
       or coalesce((j->>'closing_cash')::numeric,0)<0
       or coalesce((j->>'card_sales')::numeric,0)<0
       or coalesce((j->>'bizum_sales')::numeric,0)<0
       or coalesce((j->>'online_sales')::numeric,0)<0
       or coalesce((j->>'other_income')::numeric,0)<0
       or coalesce((j->>'cash_withdrawals')::numeric,0)<0
       or coalesce((j->>'cash_expenses_declared')::numeric,0)<0
       or coalesce((j->>'cash_extra_in')::numeric,0)<0
       or coalesce((j->>'cash_extra_out')::numeric,0)<0
  ) then raise exception 'No se admiten importes negativos en un cierre'; end if;

  select
    coalesce(sum(coalesce((j->>'opening_cash')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'closing_cash')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'card_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'bizum_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'online_sales')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'other_income')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_withdrawals')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_expenses_declared')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_extra_in')::numeric,0)),0),
    coalesce(sum(coalesce((j->>'cash_extra_out')::numeric,0)),0)
  into v_open,v_close,v_card,v_bizum,v_online,v_other,v_withdraw,v_cash_exp,v_extra_in,v_extra_out
  from jsonb_array_elements(p_drawers) j;

  v_cash_sales := round(v_close + v_withdraw + v_cash_exp + v_extra_out - v_extra_in - v_open,2);
  if v_cash_sales<0 then raise exception 'El efectivo vendido calculado no puede ser negativo'; end if;
  v_total := round(v_cash_sales+v_card+v_bizum+v_online+v_other,2);
  v_diff := case when v_reported is null then 0 else round(v_total-v_reported,2) end;

  if v_status='cerrado' then
    if v_reported is null then raise exception 'Indica el total del TPV/control antes de cerrar'; end if;
    if abs(v_diff)>0.01 then raise exception 'El cierre está descuadrado: diferencia % €',v_diff; end if;
  end if;

  if v_id is null then
    insert into public.ops_daily_closings(
      store_id,business_date,opening_cash,cash_sales,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,expected_cash,actual_cash,difference,notes,status,
      created_by,closed_by,source,include_in_income,reported_total_sales,entry_mode,cash_extra_in,cash_extra_out
    ) values(
      v_store,v_date,v_open,v_cash_sales,v_card,v_bizum,v_online,v_other,
      v_withdraw,v_cash_exp,v_close,v_close,v_diff,coalesce(p_closing->>'notes',''),v_status,
      auth.uid(),case when v_status='cerrado' then auth.uid() else null end,'manual',true,v_reported,'manual',
      v_extra_in,v_extra_out
    ) returning id into v_id;
  else
    if not exists(select 1 from public.ops_daily_closings where id=v_id) then raise exception 'Cierre no encontrado'; end if;
    update public.ops_daily_closings set
      store_id=v_store,business_date=v_date,opening_cash=v_open,cash_sales=v_cash_sales,
      card_sales=v_card,bizum_sales=v_bizum,online_sales=v_online,other_income=v_other,
      cash_withdrawals=v_withdraw,cash_expenses_declared=v_cash_exp,expected_cash=v_close,
      actual_cash=v_close,difference=v_diff,notes=coalesce(p_closing->>'notes',''),status=v_status,
      closed_by=case when v_status='cerrado' then auth.uid() else null end,
      source='manual',include_in_income=v_include_income,reported_total_sales=v_reported,entry_mode='manual',
      cash_extra_in=v_extra_in,cash_extra_out=v_extra_out
    where id=v_id;
    delete from public.ops_daily_closing_drawers where closing_id=v_id;
  end if;

  insert into public.ops_daily_closing_drawers(
    closing_id,drawer_id,opening_cash,closing_cash,notes,card_sales,bizum_sales,online_sales,
    other_income,cash_withdrawals,cash_expenses_declared,cash_extra_in,cash_extra_out
  )
  select
    v_id,nullif(j->>'drawer_id','')::uuid,
    coalesce((j->>'opening_cash')::numeric,0),coalesce((j->>'closing_cash')::numeric,0),
    coalesce(j->>'notes',''),coalesce((j->>'card_sales')::numeric,0),coalesce((j->>'bizum_sales')::numeric,0),
    coalesce((j->>'online_sales')::numeric,0),coalesce((j->>'other_income')::numeric,0),
    coalesce((j->>'cash_withdrawals')::numeric,0),coalesce((j->>'cash_expenses_declared')::numeric,0),
    coalesce((j->>'cash_extra_in')::numeric,0),coalesce((j->>'cash_extra_out')::numeric,0)
  from jsonb_array_elements(p_drawers) j;

  perform private.totus_audit('cajas',case when nullif(p_closing->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('fecha',v_date,'tienda',v_store,'total_calculado',v_total,'total_control',v_reported,'diferencia',v_diff,'estado',v_status));
  return v_id;
end;
$function$;

revoke all on function public.totus_save_closing(jsonb,jsonb) from public,anon;
grant execute on function public.totus_save_closing(jsonb,jsonb) to authenticated;

