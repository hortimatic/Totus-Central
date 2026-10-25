create or replace function private.totus_task_history(p_task uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.ops_tasks;result jsonb;
begin
 select * into strict t from public.ops_tasks where id=p_task;
 if not private.totus_task_visible(t) then raise exception 'No tienes acceso a esta tarea.';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) into result from
 (select e.action,e.scheduled_on,e.detail,e.created_at,coalesce(nullif(tm.full_name,''),tm.email) actor
 from public.ops_task_events e left join auth.users u on u.id=e.actor_id left join public.team_members tm on lower(tm.email)=lower(u.email)
 where e.task_id=p_task order by e.created_at desc limit 100) e;
 return result;
end;
$$;
