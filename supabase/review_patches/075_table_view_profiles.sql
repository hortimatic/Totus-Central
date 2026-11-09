-- Presentation only: durable personal views and explicitly shared team layouts.
begin;
create or replace function private.totus_validate_table_layout(p_table text,p_layout jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare valid text[];col jsonb;k text;v jsonb;view jsonb;clean jsonb;views jsonb:='[]';
begin
 valid=case p_table when 'products' then array['image','name','id','reference','ean13','brand','supplier','category','store','cost','costVat','costTotal','price','gross','margin','marginTotal','stock','variants','active','weight','width','height','depth','date_add','creator','date_upd'] when 'orders' then array['id','reference','images','customer','total','payment','state','date','invoice','employee','time','margin','shipping','discount'] else null end;
 if valid is null or jsonb_typeof(p_layout) is distinct from 'object' or octet_length(p_layout::text)>60000 or exists(select 1 from jsonb_object_keys(p_layout) as allowed_key(field_name) where allowed_key.field_name not in ('columns','widths','views','viewName','density','pageSize','sort','direction')) then raise exception 'Configuración de tabla no válida.';end if;
 col=p_layout->'columns';
 if jsonb_typeof(col) is distinct from 'array' or jsonb_array_length(col) not between 1 and cardinality(valid) or not(col ? case p_table when 'products' then 'name' else 'id' end) or exists(select 1 from jsonb_array_elements(col)c where jsonb_typeof(c)<>'string' or not(c#>>'{}')=any(valid)) or (select count(distinct c) from jsonb_array_elements(col)c)<>jsonb_array_length(col) then raise exception 'Columnas no válidas.';end if;
 if jsonb_typeof(p_layout->'widths') is distinct from 'object' then raise exception 'Anchos no válidos.';end if;
 for k,v in select * from jsonb_each(p_layout->'widths') loop
 if not(k=any(valid) or k='actions') or jsonb_typeof(v)<>'number' then raise exception 'Ancho no válido.';end if;
 if (v::text)::numeric not between 80 and 640 or trunc((v::text)::numeric)<>(v::text)::numeric then raise exception 'Ancho no válido.';end if;
 end loop;
 if p_layout ? 'views' then
 if jsonb_typeof(p_layout->'views') is distinct from 'array' or jsonb_array_length(p_layout->'views')>30 then raise exception 'Demasiadas vistas.';end if;
 for view in select * from jsonb_array_elements(p_layout->'views') loop
 if jsonb_typeof(view) is distinct from 'object' or jsonb_typeof(view->'name') is distinct from 'string' or length(trim(view->>'name')) not between 1 and 60 or octet_length(view::text)>6000 then raise exception 'Vista no válida.';end if;
 clean=private.totus_validate_table_layout(p_table,jsonb_build_object('columns',view->'columns','widths',coalesce(view->'widths','{}')));
 -- Filters/search stay private in this user's book. Shared profiles use only columns/widths.
 views=views||jsonb_build_array(view||clean);
 end loop;
 end if;
 return p_layout||jsonb_build_object('views',views);
end $$;
create or replace function private.totus_personal_table_layout(p_owner uuid,p_table text,p_layout jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;slot text:=case p_table when 'products' then 'products_table' when 'orders' then 'orders_table' end;clean jsonb;
begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or slot is null or not coalesce(private.totus_can(case p_table when 'products' then 'productos' else 'prestashop' end,'view'),false) then raise exception 'No puedes acceder a la distribución de otra cuenta.';end if;
 if p_layout is null then return (select ui_preferences->slot from public.profiles where id=auth.uid());end if;
 clean=private.totus_validate_table_layout(p_table,p_layout);
 select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 -- Older tabs send only columns/widths. They must not erase named views saved by a newer client.
 if not(p_layout ? 'views') and jsonb_typeof(prefs->slot->'views')='array' then clean=jsonb_set(clean,'{views}',prefs->slot->'views',true);if (prefs->slot) ? 'viewName' then clean=clean||jsonb_build_object('viewName',prefs->slot->'viewName');end if;end if;
 update public.profiles set ui_preferences=jsonb_set(prefs,array[slot],clean,true) where id=auth.uid();return clean;
end $$;
create or replace function public.totus_products_table_layout(p_owner uuid,p_layout jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.totus_personal_table_layout(p_owner,'products',p_layout)$$;
create or replace function public.totus_orders_table_layout(p_owner uuid,p_layout jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.totus_personal_table_layout(p_owner,'orders',p_layout)$$;
create or replace function private.totus_table_profiles(p_table text,p_action text default 'list',p_id uuid default null,p_name text default null,p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare clean jsonb;prefs jsonb;book jsonb;profile_id uuid;
begin
 if auth.uid() is null or p_table is null or p_action is null or p_table not in ('products','orders') or not coalesce(private.totus_can(case p_table when 'products' then 'productos' else 'prestashop' end,'view'),false) then raise exception 'No tienes acceso a esta tabla.';end if;
 if p_action in ('share','remove') then
 select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 book=case when jsonb_typeof(prefs#>array['table_view_profiles',p_table])='array' then prefs#>array['table_view_profiles',p_table] else '[]'::jsonb end;
 if p_action='share' then
 clean=private.totus_validate_table_layout(p_table,jsonb_build_object('columns',p_layout->'columns','widths',p_layout->'widths'));
 if length(trim(coalesce(p_name,''))) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.';end if;
 select (e.value->>'id')::uuid into profile_id from jsonb_array_elements(book)e where e.value->>'name'=trim(p_name) limit 1;
 if profile_id is null and jsonb_array_length(book)>=30 then raise exception 'Puedes compartir hasta 30 perfiles por tabla.';end if;
 select coalesce(jsonb_agg(e.value),'[]') into book from jsonb_array_elements(book)e where e.value->>'name' is distinct from trim(p_name);
 book=book||jsonb_build_array(jsonb_build_object('id',coalesce(profile_id,gen_random_uuid()),'name',trim(p_name),'layout',clean-'views','updated_at',now()));
 else
 if not exists(select 1 from jsonb_array_elements(book)e where e.value->>'id'=p_id::text) then raise exception 'Solo puedes retirar los perfiles compartidos por tu cuenta.';end if;
 select coalesce(jsonb_agg(e.value),'[]') into book from jsonb_array_elements(book)e where e.value->>'id' is distinct from p_id::text;
 end if;
 -- Stored inside profiles: existing backup/restore already preserves this book.
 update public.profiles set ui_preferences=prefs||jsonb_build_object('table_view_profiles',(case when jsonb_typeof(prefs->'table_view_profiles')='object' then prefs->'table_view_profiles' else '{}'::jsonb end)||jsonb_build_object(p_table,book)) where id=auth.uid();
 elsif p_action<>'list' then raise exception 'Acción de perfiles desconocida.';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',e.value->>'id','name',e.value->>'name','layout',jsonb_build_object('columns',e.value#>'{layout,columns}','widths',e.value#>'{layout,widths}'),'mine',p.id=auth.uid(),'updated_at',e.value->>'updated_at') order by e.value->>'name',e.value->>'id') from public.profiles p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.ui_preferences#>array['table_view_profiles',p_table])='array' then p.ui_preferences#>array['table_view_profiles',p_table] else '[]'::jsonb end)e where jsonb_typeof(e.value#>'{layout,columns}')='array' and jsonb_typeof(e.value#>'{layout,widths}')='object'),'[]');
end $$;
create or replace function public.totus_table_profiles(p_table text,p_action text default 'list',p_id uuid default null,p_name text default null,p_layout jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.totus_table_profiles(p_table,p_action,p_id,p_name,p_layout)$$;
revoke all on function private.totus_validate_table_layout(text,jsonb),private.totus_personal_table_layout(uuid,text,jsonb),private.totus_table_profiles(text,text,uuid,text,jsonb),public.totus_products_table_layout(uuid,jsonb),public.totus_orders_table_layout(uuid,jsonb),public.totus_table_profiles(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.totus_personal_table_layout(uuid,text,jsonb),private.totus_table_profiles(text,text,uuid,text,jsonb),public.totus_products_table_layout(uuid,jsonb),public.totus_orders_table_layout(uuid,jsonb),public.totus_table_profiles(text,text,uuid,text,jsonb) to authenticated;
commit;
