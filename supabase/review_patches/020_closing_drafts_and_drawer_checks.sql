-- Preserve existing authorization, retry, stale-write and audit protections.
-- No rows or table definitions are changed. Unknown draft readings use source_ref.
DO $patch$
DECLARE
 definition text:=pg_get_functiondef('public.totus_save_closing(jsonb,jsonb)'::regprocedure);
 old_marker text;
BEGIN
 IF position('v_missing_drawer_fields' in definition)>0 THEN RETURN; END IF;
 old_marker:='v_include_income boolean := true;';
 IF position(old_marker in definition)=0 OR position('v_date>current_date' in definition)=0
    OR position('v_extra_in,v_extra_out' in definition)=0 THEN
  RAISE EXCEPTION 'El guardado de Cajas ha cambiado; revisar antes de aplicar el parche';
 END IF;
 definition:=replace(definition,old_marker,old_marker||E'\n  v_source_ref text; v_source_meta jsonb; v_missing_drawer_fields jsonb; v_has_missing boolean;');
 definition:=replace(definition,'v_date>current_date','v_date>private.totus_business_today()');
 definition:=replace(definition,'select coalesce(include_in_income,true) into v_include_income','select coalesce(include_in_income,true),source_ref into v_include_income,v_source_ref');
 definition:=replace(definition,$m$jsonb_typeof(p_drawers)<>'array'$m$,$m$jsonb_typeof(p_drawers) IS DISTINCT FROM 'array'$m$);
 old_marker:='  select'||E'\n    coalesce(sum(coalesce((j->>''opening_cash'')::numeric,0)),0),';
 IF position(old_marker in definition)=0 THEN RAISE EXCEPTION 'No se ha localizado la agregación de Cajas'; END IF;
 definition:=replace(definition,old_marker,$validation$
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
      coalesce((j->>'cash_extra_out')::numeric,0)-coalesce((j->>'cash_extra_in')::numeric,0)-(j->>'opening_cash')::numeric<0) then
      raise exception 'Hay una caja con ventas en efectivo negativas; no se compensa con la otra caja';
    end if;
  end if;
  begin
    v_source_meta:=coalesce(v_source_ref::jsonb,'{}'::jsonb);
    if jsonb_typeof(v_source_meta)<>'object' then v_source_meta:=jsonb_build_object('original_reference',v_source_ref); end if;
  exception when invalid_text_representation then v_source_meta:=jsonb_build_object('original_reference',v_source_ref);
  end;
  if v_has_missing then
    v_source_meta:=jsonb_set(v_source_meta,'{draft_missing_fields}',v_missing_drawer_fields);
    v_source_ref:=v_source_meta::text;
  elsif v_source_meta?'draft_missing_fields' then
    v_source_meta:=v_source_meta-'draft_missing_fields';
    v_source_ref:=case when v_source_meta='{}'::jsonb then null else v_source_meta::text end;
  end if;
$validation$||old_marker);
 definition:=replace(definition,'if v_cash_sales<0 then','if v_status=''cerrado'' and v_cash_sales<0 then');
 old_marker:='  if v_status=''cerrado'' then'||E'\n    if v_reported is null';
 IF position(old_marker in definition)=0 THEN RAISE EXCEPTION 'No se ha localizado la validación de cierre'; END IF;
 definition:=replace(definition,old_marker,E'  if v_has_missing then v_cash_sales:=0; v_total:=0; v_diff:=0; end if;\n'||old_marker);
 definition:=replace(definition,'entry_mode,cash_extra_in,cash_extra_out','entry_mode,cash_extra_in,cash_extra_out,source_ref');
 definition:=replace(definition,E'v_extra_in,v_extra_out\n    ) returning',E'v_extra_in,v_extra_out,v_source_ref\n    ) returning');
 definition:=replace(definition,'cash_extra_in=v_extra_in,cash_extra_out=v_extra_out','cash_extra_in=v_extra_in,cash_extra_out=v_extra_out,source_ref=v_source_ref');
 IF position('v_extra_in,v_extra_out,v_source_ref' in definition)=0
    OR position('source_ref=v_source_ref' in definition)=0 THEN
   RAISE EXCEPTION 'No se ha localizado la escritura de Cajas; no se aplica un cambio parcial';
 END IF;
 EXECUTE definition;
END
$patch$;
