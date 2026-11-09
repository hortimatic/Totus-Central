-- Personal presentation only. Does not grant product/business write permissions.
begin;
create or replace function public.totus_products_table_layout(p_owner uuid,p_layout jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs jsonb;cols jsonb;key text;value jsonb;valid text[]:=array['image','name','id','reference','ean13','brand','supplier','category','store','cost','costVat','costTotal','price','gross','margin','marginTotal','stock','variants','active','weight','width','height','depth','date_add','creator','date_upd'];
begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or not coalesce(private.totus_can('productos','view'),false) then raise exception 'No puedes guardar la distribución de otra cuenta.';end if;
 if p_layout is null then return (select ui_preferences->'products_table' from public.profiles where id=auth.uid());end if;
 if jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>12000 or exists(select 1 from jsonb_object_keys(p_layout) k where k not in ('columns','widths')) or jsonb_typeof(p_layout->'columns') is distinct from 'array' or jsonb_typeof(p_layout->'widths') is distinct from 'object' then raise exception 'Distribución no válida.';end if;
 cols=p_layout->'columns';
 if jsonb_array_length(cols) not between 1 and 26 or not (cols ? 'name') or exists(select 1 from jsonb_array_elements(cols) c where jsonb_typeof(c)<>'string' or not (c#>>'{}')=any(valid)) or (select count(distinct c) from jsonb_array_elements(cols)c)<>jsonb_array_length(cols) then raise exception 'Columnas no válidas.';end if;
 for key,value in select * from jsonb_each(p_layout->'widths') loop
  if not(key=any(valid)) and key<>'actions' then raise exception 'Columna desconocida.';end if;
  if jsonb_typeof(value)<>'number' then raise exception 'Ancho no válido.';end if;
  if (value::text)::numeric not between 80 and 640 or trunc((value::text)::numeric)<>(value::text)::numeric then raise exception 'Ancho no válido.';end if;
 end loop;
 select coalesce(ui_preferences,'{}'::jsonb) into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 update public.profiles set ui_preferences=jsonb_set(prefs,'{products_table}',p_layout,true) where id=auth.uid();
 return p_layout;
end $$;
revoke all on function public.totus_products_table_layout(uuid,jsonb) from public,anon;
grant execute on function public.totus_products_table_layout(uuid,jsonb) to authenticated;
commit;
