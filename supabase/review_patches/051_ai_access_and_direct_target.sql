begin;
do $$declare definition text;begin
 select pg_get_functiondef('public.totus_ai_request(uuid)'::regprocedure) into definition;
 if position('Este usuario del chat no tiene una conexión IA asignada' in definition)=0 then
 definition=replace(definition,'  if matches>1 then raise exception ''Hay varias IA en este chat directo;', '  if matches=0 then raise exception ''Este usuario del chat no tiene una conexión IA asignada. Revisa el usuario elegido en APIs.'';end if;'||chr(10)||'  if matches>1 then raise exception ''Hay varias IA en este chat directo;');
 execute definition;
 end if;
end $$;
create or replace function public.totus_my_access() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_mail text=lower(auth.jwt()->>'email');role text;permissions jsonb;
begin
 if auth.uid() is null or not private.is_team_member() then raise exception 'Sesión activa requerida.';end if;
 select t.role into role from public.team_members t where t.email=actor_mail and t.active;
 select jsonb_object_agg(m,jsonb_build_object('view',private.totus_module_can(actor_mail,m,'view'),'create',private.totus_module_can(actor_mail,m,'create'),'edit',private.totus_module_can(actor_mail,m,'edit'),'delete',private.totus_module_can(actor_mail,m,'delete'),'export',private.totus_module_can(actor_mail,m,'export'))) into permissions from unnest(array['inicio','pricing','cajas','gastos','facturacion','documentos','equipo','tareas','fiscalidad','informes','administracion','configuracion']) as modules(m);
 return jsonb_build_object('email',actor_mail,'role',role,'permissions',permissions,'note','Permisos reales de la cuenta autenticada. Las acciones comprueban también al solicitante; los servicios externos requieren conexiones propias.');
end $$;
revoke all on function public.totus_my_access() from public,anon;
grant execute on function public.totus_my_access() to authenticated;
commit;
