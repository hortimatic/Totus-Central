create function private.totus_chat_save_layout(p_layout jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare key text; item jsonb; pair record;
begin
 if private.totus_chat_actor() is null then raise exception 'Usuario de equipo no activo.';end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or octet_length(p_layout::text)>16000 then raise exception 'Organización no válida.';end if;
 for key in select jsonb_object_keys(p_layout) loop
  if key not in ('collapsed_groups','group_order','hidden_groups','extra_groups','group_labels','group_sort','compact_sidebar') then raise exception 'Preferencia no válida.';end if;
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
 foreach key in array array['group_labels','group_sort'] loop
  if p_layout?key then
   if jsonb_typeof(p_layout->key)<>'object' or (select count(*) from jsonb_object_keys(p_layout->key))>100 then raise exception 'Opciones de sección no válidas.';end if;
   for pair in select * from jsonb_each(p_layout->key) loop
    if length(btrim(pair.key)) not between 1 and 80 or jsonb_typeof(pair.value)<>'string' then raise exception 'Opciones de sección no válidas.';end if;
    if key='group_sort' and (pair.value#>>'{}') not in ('alphabetical','recent','manual') then raise exception 'Orden no válido.';end if;
    if key='group_labels' and length(btrim(pair.value#>>'{}')) not between 1 and 80 then raise exception 'Nombre de sección no válido.';end if;
   end loop;
  end if;
 end loop;
 perform private.totus_chat_write_lock();
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{team_chat}',p_layout,true) where id=auth.uid();
 if not found then raise exception 'No se encontró tu perfil de usuario.';end if;
 return p_layout;
end $$;
create function public.totus_chat_save_layout(p_layout jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_save_layout(p_layout)$$;
revoke all on function private.totus_chat_save_layout(jsonb),public.totus_chat_save_layout(jsonb) from public,anon;
grant execute on function private.totus_chat_save_layout(jsonb),public.totus_chat_save_layout(jsonb) to authenticated;

create or replace function private.totus_chat_context(p_channel uuid default null,p_before bigint default null,
 p_query text default '',p_from date default null,p_to date default null,p_mode text default 'all',p_parent uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); messages jsonb;channels jsonb;layout jsonb;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 select coalesce(ui_preferences->'team_chat','{}'::jsonb) into layout from public.profiles where id=auth.uid();
 layout=coalesce(layout,'{}'::jsonb);
 if length(p_query)>200 or (p_from is not null and p_to is not null and p_from>p_to) or p_mode not in ('all','pinned','tasks','mentions') then raise exception 'Filtro no válido.';end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object(
   'name',case when c.channel_kind='direct' then coalesce((select coalesce(nullif(t.full_name,''),m.email) from public.ops_chat_members m join public.team_members t on lower(t.email)=m.email where m.channel_id=c.id and m.email<>actor limit 1),c.name) else c.name end,
   'desktop_enabled',me.desktop_enabled,'notify_level',me.notify_level,'favourite',me.favourite,'hidden',me.hidden,'sort_order',me.sort_order,
   'last_seq',coalesce((select max(seq) from public.ops_chat_messages m where m.channel_id=c.id),0),'member_role',me.member_role,'muted',me.muted,'last_read_seq',coalesce(me.last_read_seq,0),
   'mentions',(select count(*) from public.ops_chat_messages m where m.channel_id=c.id and m.seq>coalesce(me.last_read_seq,0) and actor=any(m.mentioned_emails) and m.deleted_at is null),
   'unread',(select count(*) from public.ops_chat_messages m where m.channel_id=c.id and m.seq>coalesce(me.last_read_seq,0)
      and m.author_email<>actor and m.deleted_at is null)) order by c.group_name,c.name,c.id),'[]'::jsonb)
 into channels from public.ops_chat_channels c
 left join public.ops_chat_members me on me.channel_id=c.id and me.email=actor
 where c.deleted_at is null and (not c.is_private or me.id is not null);
 if p_channel is null then return jsonb_build_object('channels',channels,'messages','[]'::jsonb,'members','[]'::jsonb,'actor',actor,'layout',layout,'directory',(select coalesce(jsonb_agg(jsonb_build_object('email',lower(email),'name',coalesce(nullif(full_name,''),email)) order by full_name,email),'[]'::jsonb) from public.team_members where active=true));end if;
 if not private.totus_chat_member(p_channel) then raise exception 'No tienes acceso a este canal.';end if;
 if p_parent is not null and not exists(select 1 from public.ops_chat_messages where id=p_parent and channel_id=p_channel and parent_id is null)
 then raise exception 'Conversación no disponible.';end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object(
   'files',case when m.deleted_at is null then coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at) from public.ops_chat_files f where f.message_id=m.id and f.deleted_at is null),'[]'::jsonb) else '[]'::jsonb end,
   'agent_request',(select to_jsonb(r) from public.ops_chat_agent_requests r where r.message_id=m.id),
   'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'email',r.email)) from public.ops_chat_reactions r where r.message_id=m.id),'[]'::jsonb),
   'replies',(select count(*) from public.ops_chat_messages reply where reply.parent_id=m.id and reply.deleted_at is null)) order by m.seq),'[]'::jsonb)
 into messages from (select * from public.ops_chat_messages m where m.channel_id=p_channel
 and (p_before is null or m.seq<p_before)
 and (p_parent is null or m.parent_id=p_parent or m.id=p_parent)
 and (p_parent is not null or length(p_query)>0 or p_mode<>'all' or m.parent_id is null)
 and (p_query='' or (m.deleted_at is null and (strpos(lower(m.body),lower(p_query))>0 or strpos(lower(m.author_email),lower(p_query))>0)))
 and (p_from is null or (m.created_at at time zone 'Europe/Madrid')::date>=p_from)
 and (p_to is null or (m.created_at at time zone 'Europe/Madrid')::date<=p_to)
 and (p_mode<>'mentions' or actor=any(m.mentioned_emails))
 and (p_mode<>'pinned' or m.pinned)
 and (p_mode<>'tasks' or (m.task_state is not null and m.deleted_at is null))
 order by m.seq desc limit 51) m;
 return jsonb_build_object('channels',channels,'messages',messages,'actor',actor,'layout',layout,
 'directory',(select coalesce(jsonb_agg(jsonb_build_object('email',lower(email),'name',coalesce(nullif(full_name,''),email)) order by full_name,email),'[]'::jsonb) from public.team_members where active=true),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('email',m.email,'member_role',m.member_role,'display_name',(select nullif(t.full_name,'') from public.team_members t where lower(t.email)=m.email limit 1)) order by m.email),'[]'::jsonb) from public.ops_chat_members m where m.channel_id=p_channel));
end $$;

