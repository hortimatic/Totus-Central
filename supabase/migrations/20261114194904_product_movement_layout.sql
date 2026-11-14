begin;
create or replace function private.totus_product_movements_layout(p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;clean jsonb;cols jsonb;valid text[]:=array['date','kind','quantity','reference','variant','employee','order','reason','cost','id'];
begin
 if auth.uid() is null or not coalesce(private.totus_can('productos','view'),false) then raise exception 'No tienes acceso a los movimientos de Productos.';end if;
 if p_layout is null then return (select ui_preferences->'product_movements_table' from public.profiles where id=auth.uid());end if;
 if jsonb_typeof(p_layout) is distinct from 'object' or pg_column_size(p_layout)>12000 or exists(select 1 from jsonb_object_keys(p_layout)k where k not in ('columns','widths','size')) then raise exception 'Configuración de movimientos no válida.';end if;
 cols=p_layout->'columns';
 if jsonb_typeof(cols) is distinct from 'array' or jsonb_array_length(cols) not between 1 and 10 or not(cols ? 'id') or exists(select 1 from jsonb_array_elements(cols)c where jsonb_typeof(c)<>'string' or not(c#>>'{}')=any(valid)) or (select count(distinct c) from jsonb_array_elements(cols)c)<>jsonb_array_length(cols) then raise exception 'Columnas de movimientos no válidas.';end if;
 if jsonb_typeof(p_layout->'widths') is distinct from 'object' or exists(select 1 from jsonb_each(p_layout->'widths')v where not v.key=any(valid) or jsonb_typeof(v.value)<>'number' or v.value::text !~ '^[0-9]{2,3}$' or (v.value::text)::int not between 80 and 700) then raise exception 'Anchos de movimientos no válidos.';end if;
 if p_layout->>'size' is null or p_layout->>'size' not in ('10','20','50','100','all') then raise exception 'Tamaño de página no válido.';end if;
 clean=jsonb_build_object('columns',cols,'widths',p_layout->'widths','size',p_layout->>'size');
 select coalesce(ui_preferences,'{}'::jsonb) into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 update public.profiles set ui_preferences=jsonb_set(prefs,'{product_movements_table}',clean,true) where id=auth.uid();return clean;
end$$;
revoke all on function private.totus_product_movements_layout(jsonb) from public,anon;
grant execute on function private.totus_product_movements_layout(jsonb) to authenticated;
create or replace function public.totus_product_movements_layout(p_layout jsonb default null) returns jsonb
language sql security invoker set search_path='' as $$select private.totus_product_movements_layout(p_layout)$$;
revoke all on function public.totus_product_movements_layout(jsonb) from public,anon;
grant execute on function public.totus_product_movements_layout(jsonb) to authenticated;
commit;
