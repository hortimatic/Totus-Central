-- Chat preferences and guarded buzz. No accounting or authentication changes.
-- Personal sound and desktop preferences; retains authentication, write lock and profile scope.
create or replace function private.totus_chat_save_layout(p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare key text; item jsonb; pair record;
begin
 if private.totus_chat_actor() is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>380000 then raise exception 'Organización no válida.';end if;
 for key in select jsonb_object_keys(p_layout) loop
  if key not in ('collapsed_groups','group_order','hidden_groups','extra_groups','group_labels','group_sort','compact_sidebar','channel_groups','channel_order','sound_enabled','desktop_enabled','sound_volume','sound_style','chat_background','chat_background_color','chat_background_image') then raise exception 'Preferencia no válida.';end if;
 end loop;
 foreach key in array array['sound_enabled','desktop_enabled'] loop
  if p_layout?key and jsonb_typeof(p_layout->key)<>'boolean' then raise exception 'Aviso no válido.';end if;
 end loop;
 if p_layout?'sound_volume' and (jsonb_typeof(p_layout->'sound_volume')<>'number' or (p_layout->>'sound_volume')::numeric not between 0 and 100) then raise exception 'Volumen no válido.';end if;
 if p_layout?'sound_style' and coalesce(p_layout->>'sound_style','') not in ('bell','double','soft','digital') then raise exception 'Sonido no válido.';end if;
 if p_layout?'chat_background' and coalesce(p_layout->>'chat_background','') not in ('default','lavender','sky','mint','sand','color','image') then raise exception 'Fondo no válido.';end if;
 if p_layout?'chat_background_color' and coalesce(p_layout->>'chat_background_color','') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color no válido.';end if;
 if p_layout?'chat_background_image' and (jsonb_typeof(p_layout->'chat_background_image')<>'string' or length(p_layout->>'chat_background_image')>350000 or ((p_layout->>'chat_background_image')<>'' and (p_layout->>'chat_background_image') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')) then raise exception 'Imagen no válida.';end if;
 if p_layout->>'chat_background'='image' and coalesce(p_layout->>'chat_background_image','')='' then raise exception 'Selecciona una imagen.';end if;
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
 then raise exception 'Color no válido.';end if;
 if p_layout?'chat_background_image' and (jsonb_typeof(p_layout->'chat_background_image')<>'string' or length(p_layout->>'chat_background_image')>350000 or ((p_layout->>'chat_background_image')<>'' and (p_layout->>'chat_background_image') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=* and jsonb_typeof(p_layout->'compact_sidebar')<>'boolean' then raise exception 'Vista de canales no válida.';end if;
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
)) then raise exception 'Imagen no válida.';end if;
 if p_layout->>'chat_background'='image' and coalesce(p_layout->>'chat_background_image','')='' then raise exception 'Selecciona una imagen.';end if;
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

create or replace function private.totus_chat_buzz(p_channel uuid,p_client_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); result jsonb; previous public.ops_chat_messages;
begin
 if auth.uid() is null or actor is null then raise exception 'Usuario de equipo no activo.';end if;
 if not private.totus_module_can(actor,'equipo','create') or not coalesce(private.totus_chat_member(p_channel),false) then raise exception 'No tienes permiso para enviar un zumbido a este canal.';end if;
 if p_client_id is null then raise exception 'Falta el identificador de envío.';end if;
 perform private.totus_chat_write_lock();
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chat-buzz:'||auth.uid()::text,0));
 select * into previous from public.ops_chat_messages where author_id=auth.uid() and client_id=p_client_id;
 if found then
  if previous.channel_id<>p_channel or previous.body<>'🔔 Zumbido' or previous.deleted_at is not null then raise exception 'El identificador de envío ya corresponde a otro mensaje.';end if;
  return to_jsonb(previous);
 end if;
 if exists(select 1 from public.ops_chat_events where actor_email=actor and action='buzz' and created_at>clock_timestamp()-interval '30 seconds') then raise exception 'Espera 30 segundos antes de enviar otro zumbido.';end if;
 result=private.totus_chat_command('send',jsonb_build_object('channel_id',p_channel,'client_id',p_client_id,'body','🔔 Zumbido'));
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id) values(p_channel,actor,'buzz',(result->>'id')::uuid);
 return result;
end $$;
create or replace function public.totus_chat_buzz(p_channel uuid,p_client_id uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_buzz(p_channel,p_client_id)$$;
revoke all on function private.totus_chat_buzz(uuid,uuid),public.totus_chat_buzz(uuid,uuid) from public,anon;
grant execute on function private.totus_chat_buzz(uuid,uuid),public.totus_chat_buzz(uuid,uuid) to authenticated;

-- Notification polling never downloads a personal background.
create or replace function private.totus_chat_notification_context()
returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('channels',context->'channels','layout',(context->'layout')-'chat_background_image') from (select private.totus_chat_context() as context) row
$$;
create or replace function public.totus_chat_notification_context()
returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_notification_context()$$;
-- Only send image bytes when its hash changed. All original context guards and filters remain active.
create or replace function private.totus_chat_personalized_context(p_args jsonb,p_background_hash text default '')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; image text; hash text;
begin
 result=private.totus_chat_context(nullif(p_args->>'p_channel','')::uuid,nullif(p_args->>'p_before','')::bigint,coalesce(p_args->>'p_query',''),nullif(p_args->>'p_from','')::date,nullif(p_args->>'p_to','')::date,coalesce(p_args->>'p_mode','all'),nullif(p_args->>'p_parent','')::uuid);
 image=coalesce(result#>>'{layout,chat_background_image}','');
 hash=case when image='' then '' else encode(pg_catalog.sha256(pg_catalog.convert_to(image,'UTF8')),'hex') end;
 if hash=coalesce(p_background_hash,'') then result=jsonb_set(result,'{layout}',(result->'layout')-'chat_background_image');end if;
 return result||jsonb_build_object('background_hash',hash,'background_unchanged',hash=coalesce(p_background_hash,''));
end $$;
create or replace function public.totus_chat_personalized_context(p_args jsonb,p_background_hash text default '')
returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_personalized_context(p_args,p_background_hash)$$;
revoke all on function private.totus_chat_notification_context(),public.totus_chat_notification_context(),private.totus_chat_personalized_context(jsonb,text),public.totus_chat_personalized_context(jsonb,text) from public,anon;
grant execute on function private.totus_chat_notification_context(),public.totus_chat_notification_context(),private.totus_chat_personalized_context(jsonb,text),public.totus_chat_personalized_context(jsonb,text) to authenticated;
