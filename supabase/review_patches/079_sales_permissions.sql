-- Independent sales access; existing grants and business records are unchanged.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.ops_user_permissions drop constraint ops_user_permissions_module_check;
alter table public.ops_user_permissions add constraint ops_user_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos','ventas'));
alter table public.ops_role_permissions drop constraint ops_role_permissions_module_check;
alter table public.ops_role_permissions add constraint ops_role_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos','ventas'));
create or replace function private.totus_module_can(p_email text,p_module text,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when tm.role='admin' then true
 when tm.role not in ('gerente','encargado') and p_module='administracion' then false
 else coalesce(
 case p_action when 'view' then usr.can_view when 'create' then usr.can_create when 'edit' then usr.can_edit when 'delete' then usr.can_delete when 'export' then usr.can_export else false end,
 case p_action when 'view' then rp.can_view when 'create' then rp.can_create when 'edit' then rp.can_edit when 'delete' then rp.can_delete when 'export' then rp.can_export else false end,
 case when p_module in ('prestashop','automatizaciones','productos','ventas') then false when p_module='configuracion' then p_action='view' when p_module in ('equipo','tareas') then true
 when tm.role='gerente' then ((p_module<>'administracion' or p_action='view') and not(p_module='fiscalidad' and p_action='delete'))
 when tm.role='encargado' then (p_module<>'administracion' and (p_action='view' or(p_module='documentos' and p_action in ('create','edit')))) else false end)
 and coalesce(usr.can_view,rp.can_view,case when p_module in ('prestashop','automatizaciones','productos','ventas') then false when p_module='configuracion' then true when p_module in ('equipo','tareas') then true when tm.role='gerente' then true when tm.role='encargado' then p_module<>'administracion' else false end) end
 from public.team_members tm join public.ops_roles r on r.code=tm.role
 left join public.ops_user_permissions usr on lower(usr.email)=lower(tm.email) and usr.module=p_module
 left join public.ops_role_permissions rp on rp.role=tm.role and rp.module=p_module
 where lower(tm.email)=lower(coalesce(p_email,'')) and tm.active limit 1),false)
 and p_module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos','ventas')
 and p_action in ('view','create','edit','delete','export')
$$;
revoke all on function private.totus_module_can(text,text,text) from public,anon,authenticated;



create or replace function public.totus_sales_context() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.totus_can('ventas','view') then raise exception 'No tienes permiso para consultar Ventas.';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'protocol',c.protocol,'enabled',c.enabled,'revision',c.revision,'verified_revision',c.verified_revision,'verified_at',c.verified_at,'real_data_authorized',c.real_data_authorized,'configured',exists(select 1 from vault.decrypted_secrets v where v.name='totus_api_'||c.id and length(v.decrypted_secret)>0))) from private.totus_api_connections c where c.protocol='prestashop' and c.name in ('PrestaShop · Hortimatic','PrestaShop · NewOldSmok')),'[]'::jsonb));
end $$;
revoke all on function public.totus_sales_context() from public,anon;
grant execute on function public.totus_sales_context() to authenticated;
create or replace function private.totus_personal_table_layout(p_owner uuid,p_table text,p_layout jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;slot text:=case p_table when 'products' then 'products_table' when 'orders' then 'orders_table' end;clean jsonb;
begin
 if auth.uid() is null or p_owner is distinct from auth.uid() or slot is null or not coalesce(private.totus_can(case p_table when 'products' then 'productos' else 'prestashop' end,'view') or (p_table='orders' and private.totus_can('ventas','view')),false) then raise exception 'No puedes acceder a la distribución de otra cuenta.';end if;
 if p_layout is null then return (select ui_preferences->slot from public.profiles where id=auth.uid());end if;
 clean=private.totus_validate_table_layout(p_table,p_layout);
 select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 -- Older tabs send only columns/widths. They must not erase named views saved by a newer client.
 if not(p_layout ? 'views') and jsonb_typeof(prefs->slot->'views')='array' then clean=jsonb_set(clean,'{views}',prefs->slot->'views',true);if (prefs->slot) ? 'viewName' then clean=clean||jsonb_build_object('viewName',prefs->slot->'viewName');end if;end if;
 update public.profiles set ui_preferences=jsonb_set(prefs,array[slot],clean,true) where id=auth.uid();return clean;
end $$;
create or replace function private.totus_table_profiles(p_table text,p_action text default 'list',p_id uuid default null,p_name text default null,p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare clean jsonb;prefs jsonb;book jsonb;profile_id uuid;
begin
 if auth.uid() is null or p_table is null or p_action is null or p_table not in ('products','orders') or not coalesce(private.totus_can(case p_table when 'products' then 'productos' else 'prestashop' end,'view') or (p_table='orders' and private.totus_can('ventas','view')),false) then raise exception 'No tienes acceso a esta tabla.';end if;
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
commit;
