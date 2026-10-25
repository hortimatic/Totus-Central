create or replace function private.totus_chat_save_layout(p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare key text; item jsonb; pair record;
begin
 if private.totus_chat_actor() is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>16000 then raise exception 'Organización no válida.';end if;
 for key in select jsonb_object_keys(p_layout) loop
  if key not in ('collapsed_groups','group_order','hidden_groups','extra_groups','group_labels','group_sort','compact_sidebar','channel_groups') then raise exception 'Preferencia no válida.';end if;
 end loop;
 if p_layout?'compact_sidebar' and jsonb_typeof(p_layout->'compact_sidebar')<>'boolean' then raise exception 'Vista de canales no válida.';end if;
 foreach key in array array['collapsed_groups','group_order','hidden_groups','extra_groups'] loop
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
