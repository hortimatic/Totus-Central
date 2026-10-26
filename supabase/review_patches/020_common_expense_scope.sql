-- Keep the existing implementation, permissions and monetary validation intact.
-- NULL store_id means common to the taxpayer, as already offered by the UI.
DO $patch$
DECLARE definition text;
 old_guard text := 'if v_store is null or v_date is null or v_supplier='''' then raise exception ''Tienda, fecha y proveedor son obligatorios''; end if;';
 new_guard text := 'if v_date is null or v_supplier='''' then raise exception ''Fecha y proveedor son obligatorios''; end if;';
BEGIN
 SELECT pg_get_functiondef('public.totus_save_expense(jsonb,jsonb)'::regprocedure) INTO definition;
 IF position(new_guard in definition)>0 THEN RETURN; END IF;
 IF position(old_guard in definition)=0 THEN RAISE EXCEPTION 'La función de gastos ha cambiado. Revisar antes de aplicar el ajuste'; END IF;
 EXECUTE replace(definition,old_guard,new_guard);
END $patch$;
