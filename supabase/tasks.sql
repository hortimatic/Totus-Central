-- Install after chat.sql. Tasks are operational, never accounting entries.
create table public.ops_tasks(
 id uuid primary key default gen_random_uuid(),
 client_id uuid not null default gen_random_uuid(),
 title text not null check(length(btrim(title)) between 1 and 160),
 description text not null default '' check(length(description)<=12000),
 store_id uuid references public.ops_stores(id),
 assigned_email text references public.team_members(email),
 created_by uuid not null references auth.users(id),
 created_email text not null,
 starts_on date not null,
 ends_on date,
 repeat_kind text not null default 'once' check(repeat_kind in ('once','daily','weekly','monthly')),
 repeat_every integer not null default 1 check(repeat_every between 1 and 365),
 weekdays integer[] not null default '{}',
 priority text not null default 'normal' check(priority in ('low','normal','high')),
 checklist jsonb not null default '[]',
 source_message_id uuid references public.ops_chat_messages(id),
 archived boolean not null default false,
 superseded boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default clock_timestamp(),
 unique(created_by,client_id),
 month_day integer not null check(month_day between 1 and 31),
 check(ends_on is null or ends_on>=starts_on),
 check(weekdays<@array[0,1,2,3,4,5,6] and (repeat_kind<>'weekly' or cardinality(weekdays)>0)),
 check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=30)
);
create index ops_tasks_store on public.ops_tasks(store_id);
create index ops_tasks_assignee on public.ops_tasks(assigned_email);
create index ops_tasks_creator on public.ops_tasks(created_by);
create index ops_tasks_source on public.ops_tasks(source_message_id);
create table public.ops_task_occurrences(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.ops_tasks(id),
 scheduled_on date not null,
 state text not null default 'pending' check(state in ('pending','working','done','cancelled')),
 result text not null default '' check(length(result)<=12000),
 checked integer[] not null default '{}',
 overrides jsonb not null default '{}',
 updated_at timestamptz not null default clock_timestamp(),
 updated_by uuid not null references auth.users(id),
 unique(task_id,scheduled_on),
 check(jsonb_typeof(overrides)='object')
);
create index ops_task_occurrences_actor on public.ops_task_occurrences(updated_by);
create table public.ops_task_events(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.ops_tasks(id),
 scheduled_on date,
 actor_id uuid not null references auth.users(id),
 action text not null,
 detail jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp()
);
create index ops_task_events_task on public.ops_task_events(task_id,created_at);
create index ops_task_events_actor on public.ops_task_events(actor_id);

create function private.totus_task_visible(t public.ops_tasks) returns boolean
language sql stable security definer set search_path='' as $$
 select private.totus_chat_actor() is not null
 and (t.created_by=auth.uid() or t.assigned_email=private.totus_chat_actor()
 or exists(select 1 from public.team_members where lower(email)=private.totus_chat_actor() and role in ('admin','gerente')))
 and (t.source_message_id is null or exists(select 1 from public.ops_chat_messages m where m.id=t.source_message_id and private.totus_chat_member(m.channel_id)))
$$;
create function private.totus_task_manage(t public.ops_tasks) returns boolean
language sql stable security definer set search_path='' as $$
 select private.totus_task_visible(t) and (t.created_by=auth.uid()
 or exists(select 1 from public.team_members where lower(email)=private.totus_chat_actor() and role in ('admin','gerente')))
$$;
create function private.totus_task_due(t public.ops_tasks,d date) returns boolean
language plpgsql immutable set search_path='' as $$
declare diff integer=d-t.starts_on; months integer;
begin
 if d<t.starts_on or (t.ends_on is not null and d>t.ends_on) then return false;end if;
 if t.repeat_kind='once' then return d=t.starts_on;
 elsif t.repeat_kind='daily' then return diff%t.repeat_every=0;
 elsif t.repeat_kind='weekly' then return (diff/7)%t.repeat_every=0 and extract(dow from d)::integer=any(t.weekdays);
 else
 months=(extract(year from d)::integer-extract(year from t.starts_on)::integer)*12+extract(month from d)::integer-extract(month from t.starts_on)::integer;
 return months%t.repeat_every=0 and extract(day from d)=least(t.month_day,extract(day from (date_trunc('month',d)+interval '1 month - 1 day')));
 end if;
end;
$$;
alter table public.ops_tasks enable row level security;
alter table public.ops_task_occurrences enable row level security;
alter table public.ops_task_events enable row level security;
create policy task_read on public.ops_tasks for select to authenticated using(private.totus_task_visible(ops_tasks));
create policy task_occurrence_read on public.ops_task_occurrences for select to authenticated using(exists(select 1 from public.ops_tasks t where t.id=task_id and private.totus_task_visible(t)));
create policy task_event_read on public.ops_task_events for select to authenticated using(exists(select 1 from public.ops_tasks t where t.id=task_id and private.totus_task_visible(t)));
revoke all on public.ops_tasks,public.ops_task_occurrences,public.ops_task_events from public,anon,authenticated;
grant select on public.ops_tasks,public.ops_task_occurrences,public.ops_task_events to authenticated;
grant all on public.ops_tasks,public.ops_task_occurrences,public.ops_task_events to service_role;

create function private.totus_tasks_context(p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); result jsonb;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'Elige un periodo de hasta 63 días.';end if;
 select jsonb_build_object(
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_on,x.priority,x.title) from (
 select t.id task_id,d::date scheduled_on,coalesce(o.overrides->>'title',t.title) title,
 coalesce(o.overrides->>'description',t.description) description,
 t.store_id,t.assigned_email,t.priority,t.repeat_kind,t.starts_on,t.ends_on,t.repeat_every,t.weekdays,
 t.month_day,t.checklist,t.source_message_id,t.archived,t.updated_at task_version,
 coalesce(o.state,'pending') state,coalesce(o.result,'') result,coalesce(o.checked,'{}') checked,
 o.updated_at occurrence_version,private.totus_task_manage(t) can_manage,
 (select jsonb_build_object('channel_id',m.channel_id,'id',m.id,'parent_id',m.parent_id) from public.ops_chat_messages m where m.id=t.source_message_id) source
 from public.ops_tasks t cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 left join public.ops_task_occurrences o on o.task_id=t.id and o.scheduled_on=d::date
 where not t.archived and private.totus_task_visible(t) and private.totus_task_due(t,d::date)
 ) x),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('email',email,'name',coalesce(nullif(full_name,''),email)) order by email) from public.team_members where active),'[]'::jsonb),
 'stores',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.ops_stores),'[]'::jsonb),
 'archived_tasks',coalesce((select jsonb_agg(jsonb_build_object('task_id',t.id,'title',t.title,'task_version',t.updated_at,'can_manage',private.totus_task_manage(t)) order by t.updated_at desc) from public.ops_tasks t where t.archived and not t.superseded and private.totus_task_visible(t)),'[]'::jsonb),
 'actor',actor) into result;
 if jsonb_array_length(result->'rows')>5000 then raise exception 'Demasiadas tareas; reduce el periodo.';end if;
 return result;
end;
$$;
create function public.totus_tasks_context(p_from date,p_to date) returns jsonb
language sql security invoker set search_path='' as $$select private.totus_tasks_context(p_from,p_to)$$;

create function private.totus_task_command(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); t public.ops_tasks; o public.ops_task_occurrences;
 tid uuid=nullif(p_data->>'task_id','')::uuid; sid uuid; d date; v jsonb; src public.ops_chat_messages; sourceid uuid;
 a text; startdate date; enddate date; rule text; step integer; days integer[]; items jsonb; result jsonb; manager boolean;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 perform private.totus_chat_write_lock();
 if jsonb_typeof(p_data)<>'object' or length(p_data::text)>32000 then raise exception 'Datos no válidos.';end if;
 if p_action not in ('save','occurrence','archive') then raise exception 'Acción no válida.';end if;
 if tid is not null then
  select * into strict t from public.ops_tasks where id=tid for update;
  if not private.totus_task_visible(t) then raise exception 'No tienes acceso a esta tarea.';end if;
  manager=private.totus_task_manage(t);
  if t.updated_at::text is distinct from p_data->>'task_version' and t.updated_at is distinct from nullif(p_data->>'task_version','')::timestamptz then raise exception 'La tarea ha cambiado. Actualiza antes de guardar.';end if;
 else manager=true;end if;
 if p_action='save' then
  if tid is null and nullif(p_data->>'client_id','') is not null then
   perform pg_catalog.pg_advisory_xact_lock(hashtextextended(auth.uid()::text||(p_data->>'client_id'),1));
   select id into sid from public.ops_tasks where created_by=auth.uid() and client_id=(p_data->>'client_id')::uuid;
   if sid is not null then return jsonb_build_object('id',sid,'existing',true);end if;
  end if;
  if not manager then raise exception 'Solo quien crea la tarea o Gerencia puede editar su configuración.';end if;
  v=p_data->'task';
  if jsonb_typeof(v)<>'object' then raise exception 'Falta la configuración.';end if;
  if length(btrim(coalesce(v->>'title',''))) not between 1 and 160 or length(coalesce(v->>'description',''))>12000 then raise exception 'Revisa el título y la descripción.';end if;
  startdate=(v->>'starts_on')::date;enddate=nullif(v->>'ends_on','')::date;
  rule=v->>'repeat_kind';step=(v->>'repeat_every')::integer;
  select coalesce(array_agg(distinct value::integer),'{}') into days from jsonb_array_elements_text(v->'weekdays');
  items=v->'checklist';a=nullif(lower(btrim(v->>'assigned_email')),'');
  if a is not null and not exists(select 1 from public.team_members where email=a and active) then raise exception 'El responsable debe ser un usuario activo.';end if;
  if startdate is null or jsonb_typeof(items)<>'array' or jsonb_array_length(items)>30
   or exists(select 1 from jsonb_array_elements(items) i where jsonb_typeof(i)<>'string' or length(btrim(i#>>'{}')) not between 1 and 300)
   then raise exception 'Revisa las fechas y los pasos de la tarea.';end if;
  sourceid=coalesce(t.source_message_id,nullif(p_data->>'source_message_id','')::uuid);
  if sourceid is not null then
   select * into strict src from public.ops_chat_messages where id=sourceid and deleted_at is null;
   if not private.totus_chat_member(src.channel_id) or (a is not null and not exists(select 1 from public.ops_chat_members where channel_id=src.channel_id and email=a)) then raise exception 'El responsable debe tener acceso a la conversación de origen.';end if;
   if tid is null then
    perform pg_catalog.pg_advisory_xact_lock(hashtextextended(sourceid::text,0));
    select id into sid from public.ops_tasks where source_message_id=sourceid and not archived order by created_at limit 1;
    if sid is not null then return jsonb_build_object('id',sid,'existing',true);end if;
   end if;
  end if;
  if tid is not null then
   d=(p_data->>'scheduled_on')::date;
   if d is null or not private.totus_task_due(t,d) then raise exception 'Ocasión no válida.';end if;
   if p_data->>'scope'='one' then
    select * into o from public.ops_task_occurrences where task_id=tid and scheduled_on=d for update;
    if o.updated_at is distinct from nullif(p_data->>'occurrence_version','')::timestamptz then raise exception 'Otro usuario ha actualizado esta ocasión. Actualiza antes de guardar.';end if;
    insert into public.ops_task_occurrences(task_id,scheduled_on,overrides,updated_by)
    values(tid,d,jsonb_build_object('title',v->>'title','description',v->>'description'),auth.uid())
    on conflict(task_id,scheduled_on) do update set overrides=excluded.overrides,updated_at=clock_timestamp(),updated_by=auth.uid();
    result=jsonb_build_object('id',tid);
   elsif p_data->>'scope'='future' then
    -- Split series: previous occurrences and their saved states remain on the old definition.
    if d=t.starts_on then
     update public.ops_tasks set archived=true,superseded=true,updated_at=clock_timestamp() where id=tid;
    else update public.ops_tasks set ends_on=d-1,updated_at=clock_timestamp() where id=tid;end if;
    -- Never silently orphan future completed work or exceptions.
    if exists(select 1 from public.ops_task_occurrences where task_id=tid and scheduled_on>=d) then
     raise exception 'Hay ocasiones guardadas desde esta fecha. Edita solo esta ocasión o elige una fecha posterior a esas ocasiones.';
    end if;
    tid=null;startdate=d;
   else raise exception 'Elige solo esta ocasión o esta y las siguientes.';end if;
  end if;
  if tid is null then
   insert into public.ops_tasks(client_id,month_day,title,description,store_id,assigned_email,created_by,created_email,starts_on,ends_on,repeat_kind,repeat_every,weekdays,priority,checklist,source_message_id)
   values(coalesce(nullif(p_data->>'client_id','')::uuid,gen_random_uuid()),case when t.repeat_kind='monthly' and rule='monthly' then t.month_day else extract(day from startdate)::integer end,btrim(v->>'title'),coalesce(v->>'description',''),nullif(v->>'store_id','')::uuid,a,auth.uid(),actor,startdate,enddate,rule,step,days,v->>'priority',items,sourceid) returning * into t;
   tid=t.id;result=jsonb_build_object('id',tid);
   if sourceid is not null and src.task_state is null then update public.ops_chat_messages set task_state='pending' where id=sourceid;end if;
   if sourceid is not null and rule='once' and src.task_state is not null then
    insert into public.ops_task_occurrences(task_id,scheduled_on,state,result,updated_by) values(tid,startdate,src.task_state,src.task_result,auth.uid());
   end if;
  end if;
 elsif p_action='occurrence' then
  if tid is null then raise exception 'Falta la tarea.';end if;
  if not manager and t.assigned_email is distinct from actor then raise exception 'Solo el responsable puede actualizar esta tarea.';end if;
  d=(p_data->>'scheduled_on')::date;
  if d is null or t.archived or not private.totus_task_due(t,d) then raise exception 'Ocasión no válida.';end if;
  select * into o from public.ops_task_occurrences where task_id=tid and scheduled_on=d for update;
  if o.updated_at is distinct from nullif(p_data->>'occurrence_version','')::timestamptz then raise exception 'Otro usuario ha actualizado esta ocasión. Actualiza antes de guardar.';end if;
  select coalesce(array_agg(distinct value::integer),'{}') into days from jsonb_array_elements_text(p_data->'checked');
  if exists(select 1 from unnest(days) i where i<0 or i>=jsonb_array_length(t.checklist)) then raise exception 'Paso de comprobación no válido.';end if;
  if p_data->>'state'='done' and cardinality(days)<>jsonb_array_length(t.checklist) then raise exception 'Completa los pasos antes de terminar.';end if;
  insert into public.ops_task_occurrences(task_id,scheduled_on,state,result,checked,updated_by)
  values(tid,d,p_data->>'state',coalesce(p_data->>'result',''),days,auth.uid())
  on conflict(task_id,scheduled_on) do update set state=excluded.state,result=excluded.result,checked=excluded.checked,updated_by=auth.uid(),updated_at=clock_timestamp();
  if t.source_message_id is not null and t.repeat_kind='once' then
   update public.ops_chat_messages set task_state=case when p_data->>'state'='cancelled' then null else p_data->>'state' end,task_result=coalesce(p_data->>'result','') where id=t.source_message_id;
  end if;
  result=jsonb_build_object('id',tid);
 else
  if tid is null or not manager or t.superseded then raise exception 'No puedes archivar esta tarea.';end if;
  update public.ops_tasks set archived=coalesce((p_data->>'archived')::boolean,true),updated_at=clock_timestamp() where id=tid;
  result=jsonb_build_object('id',tid);
 end if;
 insert into public.ops_task_events(task_id,scheduled_on,actor_id,action,detail)
 values(tid,d,auth.uid(),p_action,jsonb_build_object('scope',p_data->>'scope','state',p_data->>'state'));
 return result;
end;
$$;
create function public.totus_task_command(p_action text,p_data jsonb) returns jsonb
language sql security invoker set search_path='' as $$select private.totus_task_command(p_action,p_data)$$;
revoke all on function private.totus_task_visible(public.ops_tasks),private.totus_task_manage(public.ops_tasks),private.totus_task_due(public.ops_tasks,date),private.totus_tasks_context(date,date),private.totus_task_command(text,jsonb),public.totus_tasks_context(date,date),public.totus_task_command(text,jsonb) from public,anon,authenticated;
grant execute on function private.totus_task_visible(public.ops_tasks),private.totus_task_manage(public.ops_tasks),private.totus_tasks_context(date,date),private.totus_task_command(text,jsonb),public.totus_tasks_context(date,date),public.totus_task_command(text,jsonb) to authenticated;

create function private.totus_task_from_message(p_message uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if private.totus_chat_actor() is null or not exists(select 1 from public.ops_chat_messages m where m.id=p_message and m.deleted_at is null and private.totus_chat_member(m.channel_id)) then raise exception 'No tienes acceso a este mensaje.';end if;
 select jsonb_build_object('task_id',t.id,'scheduled_on',t.starts_on) into result from public.ops_tasks t
 where t.source_message_id=p_message and not t.archived and private.totus_task_visible(t) order by created_at desc limit 1;
 return result;
end;
$$;
create function public.totus_task_from_message(p_message uuid) returns jsonb language sql security invoker set search_path='' as $$select private.totus_task_from_message(p_message)$$;
revoke all on function private.totus_task_from_message(uuid),public.totus_task_from_message(uuid) from public,anon,authenticated;
grant execute on function private.totus_task_from_message(uuid),public.totus_task_from_message(uuid) to authenticated;

create function private.totus_task_history(p_task uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.ops_tasks;result jsonb;
begin
 select * into strict t from public.ops_tasks where id=p_task;
 if not private.totus_task_visible(t) then raise exception 'No tienes acceso a esta tarea.';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.created_at desc),'[]'::jsonb) into result from
 (select action,scheduled_on,detail,created_at,coalesce(nullif(tm.full_name,''),tm.email) actor
 from public.ops_task_events e left join auth.users u on u.id=e.actor_id left join public.team_members tm on lower(tm.email)=lower(u.email)
 where task_id=p_task order by created_at desc limit 100) e;
 return result;
end;
$$;
create function public.totus_task_history(p_task uuid) returns jsonb language sql security invoker set search_path='' as $$select private.totus_task_history(p_task)$$;
revoke all on function private.totus_task_history(uuid),public.totus_task_history(uuid) from public,anon,authenticated;
grant execute on function private.totus_task_history(uuid),public.totus_task_history(uuid) to authenticated;
