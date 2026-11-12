-- Explicit unexplained physical cash, separate from sales and extraordinary cash.
-- Positive = surplus; negative = shortage. Existing rows remain unchanged (zero).
begin;
do $begin
 if to_regprocedure('private.totus_recovery_schema_hash()') is not null then perform set_config('totus.cash_discrepancy_before_hash',private.totus_recovery_schema_hash(),true);end if;
end$;
alter table public.ops_daily_closing_drawers add column if not exists cash_discrepancy numeric(14,2) not null default 0;
alter table public.ops_daily_closing_drawers add column if not exists cash_discrepancy_reason text not null default '';
CREATE OR REPLACE FUNCTION private.totus_prepare_drawer_sales(p_closing jsonb, p_drawers jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare normalized jsonb; populated integer; total_count integer; reported numeric; item jsonb; amount numeric; difference numeric;
begin
 if jsonb_typeof(p_drawers) is distinct from 'array' or jsonb_array_length(p_drawers)=0 then raise exception 'Incluye al menos una caja';end if;
 if exists(select 1 from jsonb_array_elements(p_drawers) j where jsonb_typeof(j)<>'object') then raise exception 'Datos de caja no válidos.';end if;
 -- Older clients omit the new field. Preserve saved references before the existing RPC replaces drawer rows.
 select jsonb_agg(j||jsonb_build_object('cash_discrepancy',case when j?'cash_discrepancy' then j->'cash_discrepancy' else to_jsonb(coalesce(previous.cash_discrepancy,0)) end,'cash_discrepancy_reason',case when j?'cash_discrepancy_reason' then j->'cash_discrepancy_reason' else to_jsonb(coalesce(previous.cash_discrepancy_reason,'')) end,'reported_total_sales',case when j?'reported_total_sales' then j->'reported_total_sales' else to_jsonb(previous.reported_total_sales) end) order by ord)
 into normalized
 from jsonb_array_elements(p_drawers) with ordinality input(j,ord)
 left join public.ops_daily_closing_drawers previous on previous.closing_id=nullif(p_closing->>'id','')::uuid and previous.drawer_id=nullif(j->>'drawer_id','')::uuid;
 for item in select value from jsonb_array_elements(normalized) loop
  amount=coalesce(nullif(item->>'cash_discrepancy','')::numeric,0);
  if amount::text in ('NaN','Infinity','-Infinity') or amount<>round(amount,2) or abs(amount)>1000000 then raise exception 'El descuadre debe ser un importe finito con dos decimales.';end if;
  if length(coalesce(item->>'cash_discrepancy_reason',''))>1000 then raise exception 'El motivo del descuadre supera 1.000 caracteres.';end if;
  if amount<>0 and (nullif(btrim(item->>'cash_discrepancy_reason'),'') is null or nullif(item->>'reported_total_sales','') is null) then raise exception 'Indica las ventas registradas de esa caja y explica el descuadre pendiente.';end if;
  amount=nullif(item->>'reported_total_sales','')::numeric;
  if amount is not null and (amount::text in ('NaN','Infinity','-Infinity') or amount<0 or amount<>round(amount,2)) then raise exception 'Las ventas de cada caja deben ser finitas, positivas o cero, con un máximo de dos decimales.';end if;
 end loop;
 select count(*),count(nullif(j->>'reported_total_sales','')),sum(nullif(j->>'reported_total_sales','')::numeric)
 into total_count,populated,reported from jsonb_array_elements(normalized) j;
 if populated=0 then reported=nullif(p_closing->>'reported_total_sales','')::numeric;
 elsif populated<total_count then
  reported=null;
  if p_closing->>'status'='cerrado' then raise exception 'Indica las ventas de todas las cajas antes de cerrar. Puedes guardar un borrador mientras falta alguna.';end if;
 elsif nullif(p_closing->>'reported_total_sales','')::numeric is not null
  and abs(reported-(p_closing->>'reported_total_sales')::numeric)>.01 then raise exception 'El total de tienda no coincide con la suma de las ventas de sus cajas.';
 end if;
 if populated>0 and p_closing->>'status'='cerrado' then
  for item in select value from jsonb_array_elements(normalized) loop
   if nullif(item->>'opening_cash','') is not null and nullif(item->>'closing_cash','') is not null then
    difference=round(coalesce((item->>'closing_cash')::numeric,0)+coalesce((item->>'cash_withdrawals')::numeric,0)+coalesce((item->>'cash_expenses_declared')::numeric,0)+coalesce((item->>'cash_extra_out')::numeric,0)-coalesce((item->>'cash_extra_in')::numeric,0)-coalesce((item->>'opening_cash')::numeric,0)+coalesce((item->>'card_sales')::numeric,0)+coalesce((item->>'bizum_sales')::numeric,0)+coalesce((item->>'online_sales')::numeric,0)+coalesce((item->>'other_income')::numeric,0)-(item->>'reported_total_sales')::numeric-coalesce((item->>'cash_discrepancy')::numeric,0),2);
    if abs(difference)>.01 then raise exception 'Las ventas de una caja no cuadran con sus cobros: diferencia % €. Revisa cada caja por separado.',difference;end if;
   end if;
  end loop;
 end if;
 return jsonb_build_object('drawers',normalized,'reported',reported);
end $function$
;
CREATE OR REPLACE FUNCTION public.totus_save_closing(p_closing jsonb, p_drawers jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public,private'
AS $function$
declare
 v_sales_input jsonb;
 v_discrepancy numeric:=0;
 v_request_result uuid;
v_id uuid := nullif(p_closing->>'id','')::uuid;
  v_store uuid := nullif(p_closing->>'store_id','')::uuid;
  v_date date := nullif(p_closing->>'business_date','')::date;
  v_status text := coalesce(nullif(p_closing->>'status',''),'borrador');
  v_include_income boolean := true;
  v_source_ref text; v_source_meta jsonb; v_missing_drawer_fields jsonb; v_has_missing boolean;
  v_reported numeric := nullif(p_closing->>'reported_total_sales','')::numeric;
  v_open numeric := 0; v_close numeric := 0; v_card numeric := 0; v_bizum numeric := 0;
  v_online numeric := 0; v_other numeric := 0; v_withdraw numeric := 0; v_cash_exp numeric := 0;
  v_extra_in numeric := 0; v_extra_out numeric := 0; v_cash_sales numeric := 0; v_total numeric := 0; v_diff numeric := 0;
begin
 perform pg_catalog.pg_advisory_xact_lock_shared(724021126::bigint);
  if not (private.totus_can('cajas',case when nullif(p_closing->>'id','') is null then 'create' else 'edit' end)) then raise exception 'Solo administración o gerencia puede guardar cierres'; end if;
 v_request_result=private.totus_claim_business_request('closing',p_closing,p_drawers);
 IF v_request_result IS NOT NULL THEN RETURN v_request_result; END IF;
  perform private.totus_check_write_version('ops_daily_closings',v_id,p_closing);
  if v_store is null or v_date is null then raise exception 'Tienda y fecha son obligatorias'; end if;
  if v_date>private.totus_business_today() then raise exception 'La fecha del cierre no puede ser futura'; end if;
  if v_status not in ('borrador','cerrado') then raise exception 'Estado de cierre no válido'; end if;
  -- Reconciliation must preserve the existing fiscal selection. A historical
  -- close may already be covered by the accountant's monthly reference.
  if v_id is not null then
    select coalesce(include_in_income,true),source_ref into v_include_income,v_source_ref
    from public.ops_daily_closings where id=v_id for update;
    if not found then raise exception 'Cierre no encontrado'; end if;
  end if;
  if jsonb_typeof(p_drawers) IS DISTINCT FROM 'array' or jsonb_array_length(p_drawers)=0 then raise exception 'Incluye al menos una caja'; end if;

  v_sales_input:=private.totus_prepare_drawer_sales(p_closing,p_drawers);
  p_drawers:=v_sales_input->'drawers';
 select coalesce(sum(coalesce((j->>'cash_discrepancy')::numeric,0)),0) into v_discrepancy from jsonb_array_elements(p_drawers) j;
  v_reported:=nullif(v_sales_input->>'reported','')::numeric;

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


  if exists(select 1 from jsonb_array_elements(p_drawers) j,
    unnest(array['opening_cash','closing_cash','card_sales','bizum_sales','online_sales','other_income','cash_withdrawals','cash_expenses_declared','cash_extra_in','cash_extra_out']) field
    where (j->>field)::numeric::text in ('NaN','Infinity','-Infinity'))
    or v_reported::text in ('NaN','Infinity','-Infinity') or v_reported<0 then
    raise exception 'Los importes deben ser números finitos y no negativos';
  end if;
  select coalesce(jsonb_object_agg(j->>'drawer_id',to_jsonb(missing)),'{}'::jsonb)
    into v_missing_drawer_fields
    from jsonb_array_elements(p_drawers) j,
    lateral (select array_remove(array[
      case when nullif(j->>'opening_cash','') is null then 'opening_cash' end,
      case when nullif(j->>'closing_cash','') is null then 'closing_cash' end],null) missing) m
    where cardinality(missing)>0;
  v_has_missing:=v_missing_drawer_fields<>'{}'::jsonb;
  if v_status='cerrado' then
    if v_has_missing then raise exception 'Completa la apertura y el efectivo final de cada caja antes de cerrar'; end if;
    if exists(select 1 from public.ops_cash_drawers d where d.store_id=v_store and d.active
      and not exists(select 1 from jsonb_array_elements(p_drawers) j where (j->>'drawer_id')::uuid=d.id)) then
      raise exception 'Incluye todas las cajas activas de la tienda antes de cerrar';
    end if;
    if exists(select 1 from jsonb_array_elements(p_drawers) j where
      (j->>'closing_cash')::numeric+coalesce((j->>'cash_withdrawals')::numeric,0)+coalesce((j->>'cash_expenses_declared')::numeric,0)+
      coalesce((j->>'cash_extra_out')::numeric,0)-coalesce((j->>'cash_extra_in')::numeric,0)-(j->>'opening_cash')::numeric-coalesce((j->>'cash_discrepancy')::numeric,0)<0) then
      raise exception 'Hay una caja con ventas en efectivo negativas; no se compensa con la otra caja';
    end if;
  end if;
  begin
    v_source_meta:=coalesce(v_source_ref::jsonb,'{}'::jsonb);
    if jsonb_typeof(v_source_meta)<>'object' then v_source_meta:=jsonb_build_object('original_reference',v_source_ref); end if;
  exception when invalid_text_representation then v_source_meta:=jsonb_build_object('original_reference',v_source_ref);
  end;
  if exists(select 1 from jsonb_array_elements(p_drawers) j where coalesce((j->>'cash_discrepancy')::numeric,0)<>0) then
    v_source_meta=jsonb_set(v_source_meta,'{pending_cash_discrepancies}',(select jsonb_agg(jsonb_build_object('drawer_id',j->>'drawer_id','amount',j->'cash_discrepancy','reason',j->>'cash_discrepancy_reason')) from jsonb_array_elements(p_drawers) j where coalesce((j->>'cash_discrepancy')::numeric,0)<>0));
    v_source_ref=v_source_meta::text;
  elsif v_source_meta?'pending_cash_discrepancies' then
    v_source_meta=v_source_meta-'pending_cash_discrepancies';v_source_ref=case when v_source_meta='{}'::jsonb then null else v_source_meta::text end;
  end if;
  if v_has_missing then
    v_source_meta:=jsonb_set(v_source_meta,'{draft_missing_fields}',v_missing_drawer_fields);
    v_source_ref:=v_source_meta::text;
  elsif v_source_meta?'draft_missing_fields' then
    v_source_meta:=v_source_meta-'draft_missing_fields';
    v_source_ref:=case when v_source_meta='{}'::jsonb then null else v_source_meta::text end;
  end if;
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

  v_cash_sales := round(v_close + v_withdraw + v_cash_exp + v_extra_out - v_extra_in - v_open - v_discrepancy,2);
  if v_status='cerrado' and v_cash_sales<0 then raise exception 'El efectivo vendido calculado no puede ser negativo'; end if;
  v_total := round(v_cash_sales+v_card+v_bizum+v_online+v_other,2);
  v_diff := case when v_reported is null then 0 else round(v_total-v_reported+v_discrepancy,2) end;

  if v_has_missing then v_cash_sales:=0; v_total:=0; v_diff:=0; end if;
  if v_status='cerrado' then
    if v_reported is null then raise exception 'Indica el total del TPV/control antes de cerrar'; end if;
    if abs(v_diff-v_discrepancy)>0.01 then raise exception 'El cierre está descuadrado: diferencia % €',v_diff; end if;
  end if;

  if v_id is null then
    insert into public.ops_daily_closings(
      store_id,business_date,opening_cash,cash_sales,card_sales,bizum_sales,online_sales,other_income,
      cash_withdrawals,cash_expenses_declared,expected_cash,actual_cash,difference,notes,status,
      created_by,closed_by,source,include_in_income,reported_total_sales,entry_mode,cash_extra_in,cash_extra_out,source_ref
    ) values(
      v_store,v_date,v_open,v_cash_sales,v_card,v_bizum,v_online,v_other,
      v_withdraw,v_cash_exp,v_close,v_close,v_diff,coalesce(p_closing->>'notes',''),v_status,
      auth.uid(),case when v_status='cerrado' then auth.uid() else null end,'manual',true,v_reported,'manual',
      v_extra_in,v_extra_out,v_source_ref
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
      cash_extra_in=v_extra_in,cash_extra_out=v_extra_out,source_ref=v_source_ref
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

  update public.ops_daily_closing_drawers saved set reported_total_sales=nullif(j->>'reported_total_sales','')::numeric
  from jsonb_array_elements(p_drawers) j
  where saved.closing_id=v_id and saved.drawer_id=(j->>'drawer_id')::uuid;

  update public.ops_daily_closing_drawers saved set cash_discrepancy=coalesce((j->>'cash_discrepancy')::numeric,0),cash_discrepancy_reason=coalesce(j->>'cash_discrepancy_reason','')
  from jsonb_array_elements(p_drawers) j where saved.closing_id=v_id and saved.drawer_id=(j->>'drawer_id')::uuid;
  perform private.totus_audit('cajas',case when nullif(p_closing->>'id','') is null then 'crear' else 'actualizar' end,v_id,
    jsonb_build_object('fecha',v_date,'tienda',v_store,'total_calculado',v_total,'total_control',v_reported,'diferencia',v_diff,'descuadre_pendiente',v_discrepancy,'cajas_con_descuadre',(select jsonb_agg(jsonb_build_object('caja',j->>'drawer_id','importe',j->'cash_discrepancy','motivo',j->>'cash_discrepancy_reason')) from jsonb_array_elements(p_drawers) j where coalesce((j->>'cash_discrepancy')::numeric,0)<>0),'estado',v_status));
  perform private.totus_finish_business_request('closing',p_closing,v_id);
 return v_id;
end;
$function$
;
-- These additive, defaulted fields retain compatibility with older backups.
do $compat$
declare original text; marker text;
begin
 if to_regprocedure('private.totus_recovery_schema_hash()') is not null then
  original=pg_get_functiondef('private.totus_recovery_schema_hash()'::regprocedure);
  if strpos(original,'''cash_discrepancy''')=0 then
   marker='and a.attnum>0 and not a.attisdropped';
   if strpos(original,marker)=0 then raise exception 'Unknown recovery column inventory';end if;
   execute replace(original,marker,marker||' and not (c.relname=''ops_daily_closing_drawers'' and a.attname in (''cash_discrepancy'',''cash_discrepancy_reason''))');
  end if;
  if private.totus_recovery_schema_hash() is distinct from current_setting('totus.cash_discrepancy_before_hash',true) then raise exception 'Cash discrepancy changed backup compatibility';end if;
 end if;
 if to_regprocedure('public.totus_commit_recovery(uuid,jsonb,jsonb)') is not null then
  original=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
  if strpos(original,'''cash_discrepancy_reason''')=0 then
   marker='jsonb_build_object(''reported_total_sales'',null)||value';
   if strpos(original,marker)=0 then raise exception 'Unknown recovery row normalization';end if;
   execute replace(original,marker,'jsonb_build_object(''reported_total_sales'',null,''cash_discrepancy'',0,''cash_discrepancy_reason'','''')||value');
  end if;
 end if;
end $compat$;
commit;
