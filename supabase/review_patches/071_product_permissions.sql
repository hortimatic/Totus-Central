-- Independent Products permissions; no existing grants are widened.
-- Independent automation permissions and custom server reminders. Existing rules and delivery history are retained.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table public.ops_user_permissions drop constraint ops_user_permissions_module_check;
alter table public.ops_user_permissions add constraint ops_user_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos'));
alter table public.ops_role_permissions drop constraint ops_role_permissions_module_check;
alter table public.ops_role_permissions add constraint ops_role_permissions_module_check check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos'));
create or replace function private.totus_module_can(p_email text,p_module text,p_action text) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select case when tm.role='admin' then true
 when tm.role not in ('gerente','encargado') and p_module='administracion' then false
 else coalesce(
 case p_action when 'view' then usr.can_view when 'create' then usr.can_create when 'edit' then usr.can_edit when 'delete' then usr.can_delete when 'export' then usr.can_export else false end,
 case p_action when 'view' then rp.can_view when 'create' then rp.can_create when 'edit' then rp.can_edit when 'delete' then rp.can_delete when 'export' then rp.can_export else false end,
 case when p_module in ('prestashop','automatizaciones','productos') then false when p_module='configuracion' then p_action='view' when p_module in ('equipo','tareas') then true
 when tm.role='gerente' then ((p_module<>'administracion' or p_action='view') and not(p_module='fiscalidad' and p_action='delete'))
 when tm.role='encargado' then (p_module<>'administracion' and (p_action='view' or(p_module='documentos' and p_action in ('create','edit')))) else false end)
 and coalesce(usr.can_view,rp.can_view,case when p_module in ('prestashop','automatizaciones','productos') then false when p_module='configuracion' then true when p_module in ('equipo','tareas') then true when tm.role='gerente' then true when tm.role='encargado' then p_module<>'administracion' else false end) end
 from public.team_members tm join public.ops_roles r on r.code=tm.role
 left join public.ops_user_permissions usr on lower(usr.email)=lower(tm.email) and usr.module=p_module
 left join public.ops_role_permissions rp on rp.role=tm.role and rp.module=p_module
 where lower(tm.email)=lower(coalesce(p_email,'')) and tm.active limit 1),false)
 and p_module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion','prestashop','automatizaciones','productos')
 and p_action in ('view','create','edit','delete','export')
$$;
revoke all on function private.totus_module_can(text,text,text) from public,anon,authenticated;


-- Product operators can use only the two shop connections, never the API manager.
create or replace function public.totus_products_context(p_action text default 'view') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or p_action is null or p_action not in ('view','create','edit','delete','export') or not coalesce(private.totus_can('productos',p_action),false) then raise exception 'No tienes permiso de % en Productos.',p_action;end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'protocol',c.protocol,'enabled',c.enabled,'revision',c.revision,'verified_revision',c.verified_revision,'verified_at',c.verified_at,'real_data_authorized',c.real_data_authorized,'configured',exists(select 1 from vault.decrypted_secrets v where v.name='totus_api_'||c.id and length(v.decrypted_secret)>0))) from private.totus_api_connections c where c.protocol='prestashop' and c.name in ('PrestaShop · Hortimatic','PrestaShop · NewOldSmok')),'[]'::jsonb));
end $$;
revoke all on function public.totus_products_context(text) from public,anon;
grant execute on function public.totus_products_context(text) to authenticated;
commit;
