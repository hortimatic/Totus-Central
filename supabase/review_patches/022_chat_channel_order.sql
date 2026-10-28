create or replace function private.totus_chat_save_layout(p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare key text; item jsonb; pair record;
begin
 if private.totus_chat_actor() is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>16000 then raise exception 'Organización no válida.';end if;
 for key in select jsonb_object_keys(p_layout) loop
  if key not in ('collapsed_groups','group_order','hidden_groups','extra_groups','group_labels','group_sort','compact_sidebar','channel_groups','channel_order') then raise exception 'Preferencia no válida.';end if;
 end loop;
 if p_layout?'compact_sidebar' and jsonb_typeof(p_layout->'compact_sidebar')<>'boolean' then raise exception 'Vista de canales no válida.';end if;
 foreach key in array array['collapsed_groups','group_order','hidden_groups','extra_groups','channel_order'] loop
  if p_layout?key then
   if jsonb_typeof(p_layout->key)<>'array' or jsonb_array_length(p_layout->key)>100 then raise exception 'Lista de secciones no válida.';end if;
   for item in select value from jsonb_array_elements(p_layout->key) loop
    if jsonb_typeof(item)<>'string' or length(btrim(item#>>'{}')) not between 1 and 80 then raise exception 'Nombre de sección no válido.';end if;
   end loop;
  end if;
 end loop;
 foreach key in array array['group_labels','group_sort','channel_groups'] loop
  if p_layout?key then
   if jsonb_typeof(p_layout->key)<>'object' or (select count(*) from jsonb_object_keys(p_layout->key))>100 then raise exception 'Opciones de sección no válidas.';end if;
   for pair in select * from jsonb_each(p_layout->key) loop
    if length(btrim(pair.key)) not between 1 and 80 or jsonb_typeof(pair.value)<>'string' then raise exception 'Opciones de sección no válidas.';end if;
    if key='channel_groups' and pair.key !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then raise exception 'Canal no válido.';end if;
    if key='group_sort' and (pair.value#>>'{}') not in ('alphabetical','recent','manual') then raise exception 'Orden no válido.';end if;
    if key in ('group_labels','channel_groups') and length(btrim(pair.value#>>'{}')) not between 1 and 80 then raise exception 'Nombre de sección no válido.';end if;
   end loop;
  end if;
 end loop;
 perform private.totus_chat_write_lock();
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{team_chat}',p_layout,true) where id=auth.uid();
 if not found then raise exception 'No se encontró tu perfil de usuario.';end if;
 return p_layout;
end $$;
create or replace function public.totus_chat_save_layout(p_layout jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_save_layout(p_layout)$$;
revoke all on function private.totus_chat_save_layout(jsonb),public.totus_chat_save_layout(jsonb) from public,anon;
grant execute on function private.totus_chat_save_layout(jsonb),public.totus_chat_save_layout(jsonb) to authenticated;

-- Retain existing leases, permissions, stale-context and retry protections.
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.totus_chat_agent_reply(uuid,uuid,text)'::regprocedure) INTO definition;
 IF strpos(definition,'''assistant'',''chatgpt@totus.invalid''')=0 THEN RAISE EXCEPTION 'Unexpected reply definition'; END IF;
 definition=replace(definition,'mid uuid;','mid uuid; agent uuid;');
 definition=replace(definition,'perform private.totus_chat_agent_context(p_request,p_claim);',
 'perform private.totus_chat_agent_context(p_request,p_claim);
 select u.id into agent from auth.users u join public.team_members t on lower(t.email)=lower(u.email) where lower(u.email)=''chatgpt@totuscentral.invalid'' and t.active;
 if agent is null or not private.totus_module_can(''chatgpt@totuscentral.invalid'',''equipo'',''create'') then raise exception ''El usuario ChatGPT no tiene acceso activo al chat.'';end if;
 if not exists(select 1 from public.ops_chat_channels c where c.id=r.channel_id and not c.is_private) and not exists(select 1 from public.ops_chat_members m where m.channel_id=r.channel_id and m.email=''chatgpt@totuscentral.invalid'') then raise exception ''Invita al usuario ChatGPT a este canal privado.'';end if;
 insert into public.ops_chat_members(channel_id,email,member_role) values(r.channel_id,''chatgpt@totuscentral.invalid'',''member'') on conflict do nothing;');
 definition=replace(definition,'null,''assistant'',''chatgpt@totus.invalid''','agent,''human'',''chatgpt@totuscentral.invalid''');
 definition=replace(definition,'coalesce(source.parent_id,source.id),r.id','null,r.id');
 definition=replace(definition,'''chatgpt@totus.invalid'',''assistant_reply''','''chatgpt@totuscentral.invalid'',''assistant_reply''');
 EXECUTE definition;
END $patch$;

DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.totus_chat_command(text,jsonb)'::regprocedure) INTO definition;
 IF strpos(definition,'Envía otro mensaje para cambiar una solicitud')=0 THEN RAISE EXCEPTION 'Unexpected message edit definition';END IF;
 definition=replace(definition,
 'if exists(select 1 from public.ops_chat_agent_requests where message_id=mid and status in (''working'',''completed'')) then raise exception ''Envía otro mensaje para cambiar una solicitud ya atendida por el asistente.'';end if;',
 'update public.ops_chat_agent_requests set status=''cancelled'',lease_until=null,updated_at=now(),result_note=''Mensaje editado; respuesta anterior conservada'' where message_id=mid and status in (''pending'',''working'');');
 definition=replace(definition,'on conflict(message_id) do nothing;',
 'on conflict(message_id) do update set status=''pending'',requested_by=excluded.requested_by,requested_email=excluded.requested_email,claim_id=null,lease_until=null,context_hash=null,updated_at=now(),result_note='''' where public.ops_chat_agent_requests.status=''cancelled'';');
 EXECUTE definition;
END $patch$;

DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('private.totus_chat_agent_context(uuid,uuid)'::regprocedure) INTO definition;
 definition=replace(definition,'perform private.totus_chat_write_lock();',
 'if not exists(select 1 from public.team_members t join auth.users u on lower(u.email)=lower(t.email) where lower(t.email)=''chatgpt@totuscentral.invalid'' and t.active) or not private.totus_module_can(''chatgpt@totuscentral.invalid'',''equipo'',''view'') then raise exception ''El usuario ChatGPT no tiene acceso activo al chat.'';end if;
 perform private.totus_chat_write_lock();');
 definition=replace(definition,'and c.deleted_at is null and not c.archived',
 'and c.deleted_at is null and not c.archived and (not c.is_private or exists(select 1 from public.ops_chat_members am where am.channel_id=c.id and am.email=''chatgpt@totuscentral.invalid''))');
 definition=replace(definition,'select * into strict r from public.ops_chat_agent_requests where id=p_request for update;',
 'select * into strict r from public.ops_chat_agent_requests where id=p_request for update;
 if not exists(select 1 from public.ops_chat_channels c where c.id=r.channel_id and (not c.is_private or exists(select 1 from public.ops_chat_members am where am.channel_id=c.id and am.email=''chatgpt@totuscentral.invalid''))) then raise exception ''Invita al usuario ChatGPT a este canal privado.'';end if;');
 EXECUTE definition;
END $patch$;
