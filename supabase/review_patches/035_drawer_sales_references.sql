-- Independent till sales references. Existing records remain unknown (NULL), never backfilled.
begin;
do $$begin
 if to_regprocedure('private.totus_recovery_schema_hash()') is not null then
  perform set_config('totus.drawer_sales_before_hash',private.totus_recovery_schema_hash(),true);
 end if;
end$$;
alter table public.ops_daily_closing_drawers add column if not exists reported_total_sales numeric(14,2)
 constraint ops_daily_closing_drawers_reported_sales_check check(reported_total_sales is null or (reported_total_sales>=0 and reported_total_sales::text not in ('NaN','Infinity','-Infinity')));

create or replace function private.totus_prepare_drawer_sales(p_closing jsonb,p_drawers jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare normalized jsonb; populated integer; total_count integer; reported numeric; item jsonb; amount numeric; difference numeric;
begin
 if jsonb_typeof(p_drawers) is distinct from 'array' or jsonb_array_length(p_drawers)=0 then raise exception 'Incluye al menos una caja';end if;
 if exists(select 1 from jsonb_array_elements(p_drawers) j where jsonb_typeof(j)<>'object') then raise exception 'Datos de caja no válidos.';end if;
 -- Older clients omit the new field. Preserve saved references before the existing RPC replaces drawer rows.
 select jsonb_agg(j||jsonb_build_object('reported_total_sales',case when j?'reported_total_sales' then j->'reported_total_sales' else to_jsonb(previous.reported_total_sales) end) order by ord)
 into normalized
 from jsonb_array_elements(p_drawers) with ordinality input(j,ord)
 left join public.ops_daily_closing_drawers previous on previous.closing_id=nullif(p_closing->>'id','')::uuid and previous.drawer_id=nullif(j->>'drawer_id','')::uuid;
 for item in select value from jsonb_array_elements(normalized) loop
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
    difference=round(coalesce((item->>'closing_cash')::numeric,0)+coalesce((item->>'cash_withdrawals')::numeric,0)+coalesce((item->>'cash_expenses_declared')::numeric,0)+coalesce((item->>'cash_extra_out')::numeric,0)-coalesce((item->>'cash_extra_in')::numeric,0)-coalesce((item->>'opening_cash')::numeric,0)+coalesce((item->>'card_sales')::numeric,0)+coalesce((item->>'bizum_sales')::numeric,0)+coalesce((item->>'online_sales')::numeric,0)+coalesce((item->>'other_income')::numeric,0)-(item->>'reported_total_sales')::numeric,2);
    if abs(difference)>.01 then raise exception 'Las ventas de una caja no cuadran con sus cobros: diferencia % €. Revisa cada caja por separado.',difference;end if;
   end if;
  end loop;
 end if;
 return jsonb_build_object('drawers',normalized,'reported',reported);
end $$;
revoke all on function private.totus_prepare_drawer_sales(jsonb,jsonb) from public,anon,authenticated;

-- Extend the installed RPC in place, preserving its guards, replay protection, audit and fiscal logic.
do $patch$
declare original text; marker text; addition text;
begin
 original=replace(pg_get_functiondef('public.totus_save_closing(jsonb,jsonb)'::regprocedure),E'\r\n',E'\n');
 if strpos(original,'private.totus_prepare_drawer_sales(')>0 then return;end if;
 if strpos(original,'private.totus_can(')=0 then raise exception 'No se reconoce la protección del cierre. No se ha sustituido la función.';end if;
 marker=E'  if exists(\n    select 1 from jsonb_array_elements(p_drawers) j\n    left join public.ops_cash_drawers';
 if strpos(original,marker)=0 then raise exception 'La validación de cajas ha cambiado. No se ha sustituido la función.';end if;
 original=regexp_replace(original,'\mdeclare\M',E'declare\n v_sales_input jsonb;','i');
 addition=E'  v_sales_input:=private.totus_prepare_drawer_sales(p_closing,p_drawers);\n  p_drawers:=v_sales_input->''drawers'';\n  v_reported:=nullif(v_sales_input->>''reported'','''')::numeric;\n\n';
 original=replace(original,marker,addition||marker);
 marker='  perform private.totus_audit(''cajas'',';
 if strpos(original,marker)=0 then raise exception 'La auditoría del cierre ha cambiado. No se ha sustituido la función.';end if;
 addition=E'  update public.ops_daily_closing_drawers saved set reported_total_sales=nullif(j->>''reported_total_sales'','''')::numeric\n  from jsonb_array_elements(p_drawers) j\n  where saved.closing_id=v_id and saved.drawer_id=(j->>''drawer_id'')::uuid;\n\n';
 execute replace(original,marker,addition||marker);
end $patch$;

-- This nullable additive reference must not invalidate existing complete recovery sets.
do $compat$
declare original text; marker text; normalized text;
begin
 if to_regprocedure('private.totus_recovery_schema_hash()') is not null then
  original=pg_get_functiondef('private.totus_recovery_schema_hash()'::regprocedure);
  if strpos(original,'reported_total_sales')=0 then
   marker='and a.attnum>0 and not a.attisdropped';
   if strpos(original,marker)=0 then raise exception 'No se reconoce la compatibilidad de columnas de las copias.';end if;
   original=replace(original,marker,marker||' and not (c.relname=''ops_daily_closing_drawers'' and a.attname=''reported_total_sales'')');
   marker='from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid';
   if strpos(original,marker)=0 then raise exception 'No se reconoce la compatibilidad de restricciones de las copias.';end if;
   execute replace(original,marker,marker||' and not (c.relname=''ops_daily_closing_drawers'' and k.conname=''ops_daily_closing_drawers_reported_sales_check'')');
  end if;
  if private.totus_recovery_schema_hash() is distinct from current_setting('totus.drawer_sales_before_hash',true) then raise exception 'Las ventas por caja han cambiado la compatibilidad de las copias. No se ha aplicado la migración.';end if;
 end if;
 if to_regprocedure('public.totus_commit_recovery(uuid,jsonb,jsonb)') is not null then
  original=pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure);
  marker='case when tab=''profiles'' then jsonb_build_object(''ui_preferences'',null)||value else value end';
  normalized='case when tab=''profiles'' then jsonb_build_object(''ui_preferences'',null)||value when tab=''ops_daily_closing_drawers'' then jsonb_build_object(''reported_total_sales'',null)||value else value end';
  if strpos(original,normalized)=0 then
   if strpos(original,marker)=0 then raise exception 'La verificación de recuperación ha cambiado. No se ha aplicado la migración.';end if;
   execute replace(original,marker,normalized);
  end if;
 end if;
end $compat$;
commit;
