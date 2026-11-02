-- Reversible removal. Messages, documents, occurrences and audit history are preserved.
begin;
alter table public.ops_tasks add column if not exists deleted_at timestamptz;
alter table public.ops_tasks add column if not exists deleted_by uuid references auth.users(id);
alter table public.ops_tasks add column if not exists deleted_was_archived boolean;
create or replace function private.totus_tasks_context(p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_task_actor(); result jsonb;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>62 then raise exception 'Elige un periodo de hasta 63 días.';end if;
 select jsonb_build_object(
 'rows',coalesce((select jsonb_agg(to_jsonb(x) order by x.scheduled_on,case x.priority when 'high' then 0 when 'normal' then 1 else 2 end,x.title) from (
 select t.id task_id,d::date scheduled_on,coalesce(o.overrides->>'title',t.title) title,
 coalesce(o.overrides->>'description',t.description) description,
 t.store_id,t.assigned_email,t.priority,t.repeat_kind,t.starts_on,t.ends_on,t.repeat_every,t.weekdays,
 t.month_day,t.checklist,t.source_message_id,t.archived,t.updated_at task_version,
 coalesce(o.state,'pending') state,coalesce(o.result,'') result,coalesce(o.checked,'{}') checked,
 o.updated_at occurrence_version,private.totus_task_manage(t) can_manage,
 (select jsonb_build_object('channel_id',m.channel_id,'id',m.id,'parent_id',m.parent_id) from public.ops_chat_messages m where m.id=t.source_message_id) source
 from public.ops_tasks t cross join generate_series(p_from::timestamp,p_to::timestamp,interval '1 day') d
 left join public.ops_task_occurrences o on o.task_id=t.id and o.scheduled_on=d::date
 where t.deleted_at is null and not t.archived and private.totus_task_visible(t) and private.totus_task_due(t,d::date)
 ) x),'[]'::jsonb),
 'people',coalesce((select jsonb_agg(jsonb_build_object('email',email,'name',coalesce(nullif(full_name,''),email)) order by email) from public.team_members where active),'[]'::jsonb),
 'stores',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.ops_stores),'[]'::jsonb),
 'archived_tasks',coalesce((select jsonb_agg(jsonb_build_object('task_id',t.id,'title',t.title,'task_version',t.updated_at,'can_manage',private.totus_task_manage(t)) order by t.updated_at desc) from public.ops_tasks t where t.deleted_at is null and t.archived and not t.superseded and private.totus_task_visible(t)),'[]'::jsonb),
 'deleted_tasks',coalesce((select jsonb_agg(jsonb_build_object('task_id',t.id,'title',t.title,'task_version',t.updated_at,'can_manage',private.totus_task_manage(t)) order by t.deleted_at desc) from public.ops_tasks t where t.deleted_at is not null and private.totus_task_visible(t)),'[]'::jsonb),
 'actor',actor) into result;
 if jsonb_array_length(result->'rows')>5000 then raise exception 'Demasiadas tareas; reduce el periodo.';end if;
 return result;
end;
$$;
CREATE OR REPLACE FUNCTION private.totus_task_command(p_action text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor text=private.totus_task_actor(); t public.ops_tasks; o public.ops_task_occurrences;
 tid uuid=nullif(p_data->>'task_id','')::uuid; sid uuid; d date; v jsonb; src public.ops_chat_messages; sourceid uuid;
 before_task jsonb;before_occurrence jsonb;task_changes jsonb;occurrence_changes jsonb;
 a text; startdate date; enddate date; rule text; step integer; days integer[]; items jsonb; result jsonb; manager boolean;
begin

 if not private.totus_module_can(actor,'tareas',case when p_action='archive' then 'delete' when p_action='save' and tid is null then 'create' else 'edit' end) then raise exception 'No tienes permiso para esta acción en Tareas.';end if;
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 perform private.totus_chat_write_lock();
 if jsonb_typeof(p_data)<>'object' or length(p_data::text)>32000 then raise exception 'Datos no válidos.';end if;
 if p_action not in ('save','occurrence','archive') then raise exception 'Acción no válida.';end if;
 if tid is not null then
  select * into strict t from public.ops_tasks where id=tid for update;
  if t.deleted_at is not null then raise exception 'La tarea está eliminada. Recupérala antes de modificarla.';end if;
  if not private.totus_task_visible(t) then raise exception 'No tienes acceso a esta tarea.';end if;
  manager=private.totus_task_manage(t);
  if t.updated_at::text is distinct from p_data->>'task_version' and t.updated_at is distinct from nullif(p_data->>'task_version','')::timestamptz then raise exception 'La tarea ha cambiado. Actualiza antes de guardar.';end if;
 else manager=true;end if;
 if tid is not null then
  before_task=to_jsonb(t);
  select to_jsonb(previous_occurrence) into before_occurrence from public.ops_task_occurrences previous_occurrence
  where previous_occurrence.task_id=tid and previous_occurrence.scheduled_on=nullif(p_data->>'scheduled_on','')::date;
 end if;
 if p_action='save' then
  if tid is null and nullif(p_data->>'client_id','') is not null then
   perform pg_catalog.pg_advisory_xact_lock(hashtextextended(private.totus_task_uid()::text||(p_data->>'client_id'),1));
   select id into sid from public.ops_tasks where created_by=private.totus_task_uid() and client_id=(p_data->>'client_id')::uuid;
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
  if rule='weekly' and enddate is not null and not exists(select 1 from generate_series(0,6) i where startdate+i<=enddate and extract(dow from startdate+i)::integer=any(days)) then raise exception 'No hay ningún día de tarea entre las fechas elegidas.';end if;
  sourceid=coalesce(t.source_message_id,nullif(p_data->>'source_message_id','')::uuid);
  if sourceid is not null then
   select * into strict src from public.ops_chat_messages where id=sourceid and deleted_at is null;
   if not private.totus_task_channel(src.channel_id) or (a is not null and not exists(select 1 from public.ops_chat_members where channel_id=src.channel_id and email=a)) then raise exception 'El responsable debe tener acceso a la conversación de origen.';end if;
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
    values(tid,d,jsonb_build_object('title',v->>'title','description',v->>'description'),private.totus_task_uid())
    on conflict(task_id,scheduled_on) do update set overrides=excluded.overrides,updated_at=clock_timestamp(),updated_by=private.totus_task_uid();
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
   values(coalesce(nullif(p_data->>'client_id','')::uuid,gen_random_uuid()),case when t.repeat_kind='monthly' and rule='monthly' then t.month_day else extract(day from startdate)::integer end,btrim(v->>'title'),coalesce(v->>'description',''),nullif(v->>'store_id','')::uuid,a,coalesce(t.created_by,private.totus_task_uid()),coalesce(t.created_email,actor),startdate,enddate,rule,step,days,v->>'priority',items,sourceid) returning * into t;
   tid=t.id;result=jsonb_build_object('id',tid);
   if sourceid is not null and src.task_state is null then update public.ops_chat_messages set task_state='pending' where id=sourceid;end if;
   if sourceid is not null and rule='once' and src.task_state is not null then
    insert into public.ops_task_occurrences(task_id,scheduled_on,state,result,updated_by) values(tid,startdate,src.task_state,src.task_result,private.totus_task_uid());
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
  values(tid,d,p_data->>'state',coalesce(p_data->>'result',''),days,private.totus_task_uid())
  on conflict(task_id,scheduled_on) do update set state=excluded.state,result=excluded.result,checked=excluded.checked,updated_by=private.totus_task_uid(),updated_at=clock_timestamp();
  if t.source_message_id is not null and t.repeat_kind='once' then
   update public.ops_chat_messages set task_state=case when p_data->>'state'='cancelled' then null else p_data->>'state' end,task_result=coalesce(p_data->>'result','') where id=t.source_message_id;
  end if;
  result=jsonb_build_object('id',tid);
 else
  if tid is null or not manager or t.superseded then raise exception 'No puedes archivar esta tarea.';end if;
  update public.ops_tasks set archived=coalesce((p_data->>'archived')::boolean,true),updated_at=clock_timestamp() where id=tid;
  result=jsonb_build_object('id',tid);
 end if;
 task_changes=private.totus_task_changes(before_task,(select to_jsonb(current_task) from public.ops_tasks current_task where id=tid));
 occurrence_changes=private.totus_task_changes(before_occurrence,(select to_jsonb(current_occurrence) from public.ops_task_occurrences current_occurrence where task_id=tid and scheduled_on=d));
 insert into public.ops_task_events(task_id,scheduled_on,actor_id,action,detail)
 values(tid,d,private.totus_task_uid(),p_action,jsonb_build_object('scope',p_data->>'scope','state',p_data->>'state','origin',case when auth.uid() is null then 'trusted-connector' else 'web' end,'before',jsonb_build_object('task',task_changes->'before','occurrence',occurrence_changes->'before'),'after',jsonb_build_object('task',task_changes->'after','occurrence',occurrence_changes->'after')));
 return result;
end;
$function$;
create or replace function private.totus_task_remove(p_task_id uuid,p_task_version timestamptz,p_restore boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_task_actor();t public.ops_tasks;before_row jsonb;after_row jsonb;
begin
 if actor is null or not private.totus_module_can(actor,'tareas','delete') then raise exception 'No tienes permiso para eliminar o recuperar tareas.';end if;
 perform private.totus_chat_write_lock();
 select * into strict t from public.ops_tasks where id=p_task_id for update;
 if not private.totus_task_manage(t) or t.superseded then raise exception 'No puedes gestionar esta tarea.';end if;
 if t.updated_at is distinct from p_task_version then raise exception 'La tarea ha cambiado. Actualiza antes de continuar.';end if;
 if p_restore and t.deleted_at is null or not p_restore and t.deleted_at is not null then raise exception 'El estado de la tarea ha cambiado. Actualiza.';end if;
 before_row=to_jsonb(t);
 update public.ops_tasks set archived=case when p_restore then coalesce(deleted_was_archived,true) else true end,
 deleted_was_archived=case when p_restore then null else archived end,
 deleted_at=case when p_restore then null else clock_timestamp() end,
 deleted_by=case when p_restore then null else private.totus_task_uid() end,updated_at=clock_timestamp() where id=p_task_id returning to_jsonb(ops_tasks.*) into after_row;
 insert into public.ops_task_events(task_id,actor_id,action,detail) values(p_task_id,private.totus_task_uid(),case when p_restore then 'restore_deleted' else 'delete' end,jsonb_build_object('before',before_row,'after',after_row));
 return jsonb_build_object('id',p_task_id,'deleted',not p_restore);
end;$$;
create or replace function public.totus_task_remove(p_task_id uuid,p_task_version timestamptz,p_restore boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select private.totus_task_remove(p_task_id,p_task_version,p_restore)$$;
revoke all on function private.totus_task_remove(uuid,timestamptz,boolean),public.totus_task_remove(uuid,timestamptz,boolean) from public,anon;
grant execute on function private.totus_task_remove(uuid,timestamptz,boolean),public.totus_task_remove(uuid,timestamptz,boolean) to authenticated;
commit;
