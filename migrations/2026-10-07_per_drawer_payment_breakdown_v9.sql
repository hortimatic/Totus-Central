-- Totus Central · cierre diario desglosado por caja física
alter table public.ops_daily_closing_drawers
  add column if not exists card_sales numeric,
  add column if not exists bizum_sales numeric,
  add column if not exists online_sales numeric,
  add column if not exists other_income numeric,
  add column if not exists cash_withdrawals numeric,
  add column if not exists cash_expenses_declared numeric;

create or replace function private.ops_save_closing_internal(p_closing jsonb, p_drawers jsonb)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid; v_old_status text; v_store uuid; v_date date;
  v_opening numeric:=0; v_closing numeric:=0;
  v_withdrawals numeric:=0; v_cash_expenses numeric:=0;
  v_card numeric:=0; v_bizum numeric:=0; v_online numeric:=0; v_other numeric:=0;
  v_reported numeric:=nullif(p_closing->>'reported_total_sales','')::numeric;
  v_mode text:=coalesce(nullif(p_closing->>'entry_mode',''),'physical');
  v_cash_sales numeric;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  v_id:=nullif(p_closing->>'id','')::uuid;
  v_store:=nullif(p_closing->>'store_id','')::uuid;
  v_date:=nullif(p_closing->>'business_date','')::date;
  if v_store is null or v_date is null then raise exception 'Tienda y fecha son obligatorias'; end if;
  if v_mode not in ('quick','physical') then raise exception 'Modo de cierre no válido'; end if;
  if exists(select 1 from public.ops_daily_closings x where x.store_id=v_store and x.business_date=v_date and x.id is distinct from v_id)
    then raise exception 'Ya existe un cierre para esa tienda y fecha'; end if;

  if jsonb_typeof(p_drawers)='array' then
    select
      coalesce(sum(coalesce((j->>'opening_cash')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'closing_cash')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'card_sales')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'bizum_sales')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'online_sales')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'other_income')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'cash_withdrawals')::numeric,0)),0),
      coalesce(sum(coalesce((j->>'cash_expenses_declared')::numeric,0)),0)
    into v_opening,v_closing,v_card,v_bizum,v_online,v_other,v_withdrawals,v_cash_expenses
    from jsonb_array_elements(p_drawers) j;
  end if;

  if v_mode='quick' then
    v_card:=coalesce((p_closing->>'card_sales')::numeric,0);
    v_bizum:=coalesce((p_closing->>'bizum_sales')::numeric,0);
    v_online:=coalesce((p_closing->>'online_sales')::numeric,0);
    v_other:=coalesce((p_closing->>'other_income')::numeric,0);
    v_withdrawals:=coalesce((p_closing->>'cash_withdrawals')::numeric,0);
    v_cash_expenses:=coalesce((p_closing->>'cash_expenses_declared')::numeric,0);
    if v_reported is null then v_reported:=v_card+v_bizum+v_online+v_other+v_withdrawals; end if;
    if v_reported<0 then raise exception 'El total vendido no puede ser negativo'; end if;
    v_cash_sales:=v_reported-v_card-v_bizum-v_online-v_other;
    if v_cash_sales<0 then raise exception 'El total vendido no puede ser menor que los cobros no efectivos'; end if;
  else
    if jsonb_typeof(p_drawers)<>'array' or jsonb_array_length(p_drawers)=0 then raise exception 'El cierre físico debe incluir al menos una caja'; end if;
    if exists(
      select 1 from jsonb_array_elements(p_drawers) j
      left join public.ops_cash_drawers d on d.id=(j->>'drawer_id')::uuid and d.store_id=v_store and d.active
      where d.id is null
    ) then raise exception 'Hay una caja no válida para este establecimiento'; end if;
    v_cash_sales:=v_closing+v_withdrawals+v_cash_expenses-v_opening;
    v_reported:=v_cash_sales+v_card+v_bizum+v_online+v_other;
  end if;

  if v_id is not null then
    select status into v_old_status from public.ops_daily_closings where id=v_id for update;
    if not found then raise exception 'Cierre no encontrado'; end if;
    if v_old_status='cerrado' and not private.is_manager() then raise exception 'Cierre cerrado. Solo administración/gerencia puede modificarlo'; end if;
    update public.ops_daily_closings set
      store_id=v_store,business_date=v_date,opening_cash=v_opening,cash_sales=v_cash_sales,
      card_sales=v_card,bizum_sales=v_bizum,online_sales=v_online,other_income=v_other,
      cash_withdrawals=v_withdrawals,cash_expenses_declared=v_cash_expenses,
      expected_cash=v_closing,actual_cash=v_closing,difference=0,notes=coalesce(p_closing->>'notes',''),
      status=coalesce(nullif(p_closing->>'status',''),'cerrado'),
      closed_by=case when coalesce(nullif(p_closing->>'status',''),'cerrado')='cerrado' then auth.uid() else null end,
      reported_total_sales=v_reported,entry_mode=v_mode,updated_at=now()
    where id=v_id;
    delete from public.ops_daily_closing_drawers where closing_id=v_id;
  else
    insert into public.ops_daily_closings(
      store_id,business_date,opening_cash,cash_sales,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,expected_cash,actual_cash,difference,notes,status,
      created_by,closed_by,source,legacy_cash_method,reported_total_sales,entry_mode
    ) values(
      v_store,v_date,v_opening,v_cash_sales,v_card,v_bizum,v_online,v_other,v_withdrawals,v_cash_expenses,
      v_closing,v_closing,0,coalesce(p_closing->>'notes',''),coalesce(nullif(p_closing->>'status',''),'cerrado'),
      auth.uid(),case when coalesce(nullif(p_closing->>'status',''),'cerrado')='cerrado' then auth.uid() else null end,
      'manual',false,v_reported,v_mode
    ) returning id into v_id;
  end if;

  if jsonb_typeof(p_drawers)='array' then
    insert into public.ops_daily_closing_drawers(
      closing_id,drawer_id,opening_cash,closing_cash,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,notes
    )
    select
      v_id,(j->>'drawer_id')::uuid,
      coalesce((j->>'opening_cash')::numeric,0),coalesce((j->>'closing_cash')::numeric,0),
      coalesce((j->>'card_sales')::numeric,0),coalesce((j->>'bizum_sales')::numeric,0),
      coalesce((j->>'online_sales')::numeric,0),coalesce((j->>'other_income')::numeric,0),
      coalesce((j->>'cash_withdrawals')::numeric,0),coalesce((j->>'cash_expenses_declared')::numeric,0),
      coalesce(j->>'notes','')
    from jsonb_array_elements(p_drawers) j
    where nullif(j->>'drawer_id','') is not null;
  end if;
  return v_id;
end
$function$;
