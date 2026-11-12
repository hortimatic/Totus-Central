-- Home task scope is independent of task-management rights. Ordinary users see
-- only their assigned tasks; only admin selects others.
begin;
create or replace function public.totus_home_tasks_context(p_from date,p_to date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb; actor text; is_admin boolean;
begin
 if not private.totus_can('tareas','view') then raise exception 'No tienes acceso al calendario de tareas.';end if;
 result=private.totus_tasks_context(p_from,p_to);
 actor=result->>'actor';
 select exists(select 1 from public.team_members where lower(email)=actor and active and role='admin') into is_admin;
 if not is_admin then
  result=jsonb_set(result,'{rows}',coalesce((select jsonb_agg(r) from jsonb_array_elements(result->'rows') r where lower(r->>'assigned_email')=actor),'[]'::jsonb));
  result=jsonb_set(result,'{people}',coalesce((select jsonb_agg(p) from jsonb_array_elements(result->'people') p where lower(p->>'email')=actor),'[]'::jsonb));
 end if;
 -- Home never receives the archived/deleted task-management inventories.
 return (result-'archived_tasks'-'deleted_tasks')||jsonb_build_object('can_select_users',is_admin);
end $$;
revoke all on function public.totus_home_tasks_context(date,date) from public,anon;
grant execute on function public.totus_home_tasks_context(date,date) to authenticated;
-- Preserve identity checks, permissions and event idempotency; add the new route.
do $$
declare definition text;
begin
 select pg_get_functiondef('public.totus_record_activity(text,text,text,text,uuid)'::regprocedure) into definition;
 if position('''ventas''' in definition)=0 then
  if position('''clientes'',''proveedores'',''marcas''' in definition)=0 then raise exception 'Unexpected activity validator; review before changing it';end if;
  execute replace(definition,'''clientes'',''proveedores'',''marcas''','''clientes'',''proveedores'',''marcas'',''ventas''');
 end if;
end $$;
commit;
