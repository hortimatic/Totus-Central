-- Equipo chat: additive installation candidate. Not applied to production.
-- Before activation, include ALL five tables in snapshot/recovery and rehearse.
create table public.ops_chat_channels (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(btrim(name)) between 1 and 80),
 group_name text not null default 'Equipo' check(length(btrim(group_name)) between 1 and 80),
 description text not null default '' check(length(description)<=500),
 store_id uuid references public.ops_stores(id),
 is_private boolean not null default false,
 archived boolean not null default false,
 deleted_at timestamptz,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create table public.ops_chat_members (
 id uuid primary key default gen_random_uuid(),
 channel_id uuid not null references public.ops_chat_channels(id),
 email text not null check(email=lower(email)),
 member_role text not null default 'member' check(member_role in ('member','manager')),
 last_read_seq bigint not null default 0 check(last_read_seq>=0),
 muted boolean not null default false,
 unique(channel_id,email)
);
create table public.ops_chat_messages (
 id uuid primary key default gen_random_uuid(),
 seq bigint generated always as identity unique,
 channel_id uuid not null references public.ops_chat_channels(id),
 author_id uuid not null references auth.users(id),
 author_email text not null,
 client_id uuid not null,
 body text not null check(length(btrim(body)) between 1 and 12000),
 parent_id uuid references public.ops_chat_messages(id),
 pinned boolean not null default false,
 task_state text check(task_state in ('pending','working','done')),
 task_result text not null default '' check(length(task_result)<=12000),
 created_at timestamptz not null default now(),
 edited_at timestamptz, deleted_at timestamptz,
 unique(author_id,client_id)
);
create index ops_chat_messages_channel_seq on public.ops_chat_messages(channel_id,seq desc);
create index ops_chat_messages_parent on public.ops_chat_messages(parent_id);
create table public.ops_chat_reactions (
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.ops_chat_messages(id),
 email text not null, emoji text not null check(emoji in ('👍','✅','👀','❤️')),
 unique(message_id,email,emoji)
);
create index ops_chat_reactions_email on public.ops_chat_reactions(email);
create table public.ops_chat_events (
 id uuid primary key default gen_random_uuid(), channel_id uuid not null references public.ops_chat_channels(id),
 actor_email text not null, action text not null, entity_id uuid,
 created_at timestamptz not null default now(),
 detail jsonb not null default '{}'::jsonb
);
create index ops_chat_events_channel on public.ops_chat_events(channel_id,created_at desc);

create function private.totus_chat_actor() returns text
language sql stable security definer set search_path='' as $$
 select lower(tm.email) from public.team_members tm
 join auth.users u on lower(u.email)=lower(tm.email)
 where u.id=auth.uid() and tm.active=true limit 1
$$;
create function private.totus_chat_member(p_channel uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.totus_chat_actor() is not null and exists(
 select 1 from public.ops_chat_members m join public.ops_chat_channels c on c.id=m.channel_id
 where m.channel_id=p_channel and m.email=private.totus_chat_actor() and c.deleted_at is null)
$$;
create function private.totus_chat_manager(p_channel uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.totus_chat_member(p_channel) and exists(
 select 1 from public.ops_chat_members m where m.channel_id=p_channel
 and m.email=private.totus_chat_actor() and m.member_role='manager')
$$;

alter table public.ops_chat_channels enable row level security;
alter table public.ops_chat_members enable row level security;
alter table public.ops_chat_messages enable row level security;
alter table public.ops_chat_reactions enable row level security;
alter table public.ops_chat_events enable row level security;
create policy chat_channels_read on public.ops_chat_channels for select to authenticated
 using (deleted_at is null and private.totus_chat_actor() is not null and (not is_private or private.totus_chat_member(id)));
create policy chat_members_read on public.ops_chat_members for select to authenticated using (private.totus_chat_member(channel_id));
create policy chat_messages_read on public.ops_chat_messages for select to authenticated using (private.totus_chat_member(channel_id));
create policy chat_reactions_read on public.ops_chat_reactions for select to authenticated using(
 exists(select 1 from public.ops_chat_messages m where m.id=message_id and private.totus_chat_member(m.channel_id)));
create policy chat_events_read on public.ops_chat_events for select to authenticated using(private.totus_chat_manager(channel_id));
revoke all on public.ops_chat_channels,public.ops_chat_members,public.ops_chat_messages,public.ops_chat_reactions,public.ops_chat_events from anon,authenticated;
grant select on public.ops_chat_channels,public.ops_chat_members,public.ops_chat_messages,public.ops_chat_reactions,public.ops_chat_events to authenticated;

create function private.totus_chat_command(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); channel uuid; mid uuid; msg public.ops_chat_messages;
 c public.ops_chat_channels; value text; result jsonb; member_email text; manager_count integer;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.'; end if;
 if jsonb_typeof(p_data)<>'object' then raise exception 'Datos no válidos.';end if;
 if p_action='create_channel' then
  -- Any active teammate can create a channel; the creator manages its membership.
  insert into public.ops_chat_channels(name,group_name,description,store_id,is_private,created_by)
  values(btrim(p_data->>'name'),coalesce(nullif(btrim(p_data->>'group_name'),''),'Equipo'),
   coalesce(p_data->>'description',''),nullif(p_data->>'store_id','')::uuid,
   coalesce((p_data->>'is_private')::boolean,false),auth.uid()) returning * into c;
  insert into public.ops_chat_members(channel_id,email,member_role) values(c.id,actor,'manager');
  channel=c.id;result=to_jsonb(c);
 elsif p_action='join' then
  channel=(p_data->>'channel_id')::uuid;
  select * into strict c from public.ops_chat_channels where id=channel for update;
  if c.is_private or c.archived or c.deleted_at is not null then raise exception 'No puedes unirte a este canal.';end if;
  insert into public.ops_chat_members(channel_id,email) values(channel,actor) on conflict do nothing;
  result=jsonb_build_object('channel_id',channel);
 else
  channel=nullif(p_data->>'channel_id','')::uuid;
  if not coalesce(private.totus_chat_member(channel),false) then raise exception 'No tienes acceso a este canal.';end if;
  select * into strict c from public.ops_chat_channels where id=channel for update;
  if p_action not in ('read','mute','channel_update','channel_delete') and c.archived then raise exception 'El canal está archivado.';end if;
  if p_action in ('channel_update','channel_delete','member_save','member_remove') then
   if not private.totus_chat_manager(channel) then raise exception 'Solo responsables del canal.';end if;
   if p_action='channel_update' then
    update public.ops_chat_channels set name=btrim(p_data->>'name'),group_name=btrim(p_data->>'group_name'),
     description=coalesce(p_data->>'description',''),is_private=coalesce((p_data->>'is_private')::boolean,is_private),
     archived=coalesce((p_data->>'archived')::boolean,archived) where id=channel returning to_jsonb(ops_chat_channels) into result;
   elsif p_action='channel_delete' then
    -- Reversible retirement; never deletes documents or accounting.
    update public.ops_chat_channels set deleted_at=now(),archived=true where id=channel;
    result=jsonb_build_object('retired',true);
   else
    member_email=lower(btrim(p_data->>'email'));
    if p_action='member_save' and not exists(select 1 from public.team_members where lower(email)=member_email and active=true) then raise exception 'El usuario no pertenece al equipo activo.';end if;
    select count(*) into manager_count from public.ops_chat_members where channel_id=channel and member_role='manager';
    if exists(select 1 from public.ops_chat_members where channel_id=channel and email=member_email and member_role='manager')
       and manager_count=1 and (p_action='member_remove' or p_data->>'member_role'<>'manager')
     then raise exception 'Debe quedar al menos un responsable.';end if;
    if p_action='member_remove' then
     delete from public.ops_chat_members where channel_id=channel and email=member_email;
    else
     insert into public.ops_chat_members(channel_id,email,member_role) values(channel,member_email,p_data->>'member_role')
     on conflict(channel_id,email) do update set member_role=excluded.member_role;
    end if;
    result=jsonb_build_object('email',member_email);
   end if;
  elsif p_action='send' then
   value=btrim(p_data->>'body');
   if nullif(p_data->>'parent_id','') is not null and not exists(
     select 1 from public.ops_chat_messages where id=(p_data->>'parent_id')::uuid
     and channel_id=channel and parent_id is null and deleted_at is null)
    then raise exception 'La respuesta no pertenece a este canal.';end if;
   select * into msg from public.ops_chat_messages where author_id=auth.uid() and client_id=(p_data->>'client_id')::uuid;
   if found then
    if msg.channel_id<>channel or msg.body<>value or msg.parent_id is distinct from nullif(p_data->>'parent_id','')::uuid
      then raise exception 'El identificador de envío ya corresponde a otro mensaje.';end if;
    return to_jsonb(msg);
   end if;
   insert into public.ops_chat_messages(channel_id,author_id,author_email,client_id,body,parent_id)
   values(channel,auth.uid(),actor,(p_data->>'client_id')::uuid,value,nullif(p_data->>'parent_id','')::uuid) returning * into msg;
   mid=msg.id;result=to_jsonb(msg);
  elsif p_action in ('read','mute') then
   update public.ops_chat_members set
    last_read_seq=case when p_action='read' then greatest(last_read_seq,least(coalesce((p_data->>'seq')::bigint,0),
      coalesce((select max(seq) from public.ops_chat_messages where channel_id=channel),0))) else last_read_seq end,
    muted=case when p_action='mute' then coalesce((p_data->>'muted')::boolean,false) else muted end
    where channel_id=channel and email=actor returning to_jsonb(ops_chat_members) into result;
  else
   mid=(p_data->>'message_id')::uuid;
   select * into strict msg from public.ops_chat_messages where id=mid and channel_id=channel and deleted_at is null for update;
   if p_action in ('edit','message_delete') then
    if msg.author_id<>auth.uid() then raise exception 'Solo puedes modificar tus propios mensajes.';end if;
    if msg.edited_at is distinct from nullif(p_data->>'expected_edited_at','')::timestamptz then raise exception 'El mensaje cambió. Actualiza antes de editar.';end if;
    if p_action='edit' then
     update public.ops_chat_messages set body=btrim(p_data->>'body'),edited_at=clock_timestamp() where id=mid;
    else
     update public.ops_chat_messages set body='Mensaje eliminado',deleted_at=now(),edited_at=clock_timestamp(),pinned=false,task_state=null,task_result='' where id=mid;
    end if;
   elsif p_action='pin' then
    if not private.totus_chat_manager(channel) then raise exception 'Solo responsables pueden fijar mensajes.';end if;
    update public.ops_chat_messages set pinned=coalesce((p_data->>'pinned')::boolean,false) where id=mid;
   elsif p_action='reaction' then
    value=p_data->>'emoji';
    if value not in ('👍','✅','👀','❤️') then raise exception 'Reacción no válida.';end if;
    delete from public.ops_chat_reactions where message_id=mid and email=actor and emoji=value;
    if not found then insert into public.ops_chat_reactions(message_id,email,emoji) values(mid,actor,value);end if;
   elsif p_action='task' then
    if msg.author_id<>auth.uid() and not private.totus_chat_manager(channel) then raise exception 'Solo el autor o un responsable puede gestionar la tarea.';end if;
    if p_data->>'task_state'='done' and length(btrim(coalesce(p_data->>'task_result','')))=0 then raise exception 'Indica qué se ha realizado antes de terminar la tarea.';end if;
    update public.ops_chat_messages set task_state=nullif(p_data->>'task_state',''),task_result=coalesce(p_data->>'task_result','') where id=mid;
   else raise exception 'Operación de chat no reconocida.';end if;
   select to_jsonb(m) into result from public.ops_chat_messages m where id=mid;
  end if;
 end if;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id,detail)
 values(channel,actor,p_action,coalesce(mid,channel),jsonb_build_object('member',member_email));
 return result;
end $$;

create function private.totus_chat_context(p_channel uuid default null,p_before bigint default null,
 p_query text default '',p_from date default null,p_to date default null,p_mode text default 'all',p_parent uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor text=private.totus_chat_actor(); messages jsonb;channels jsonb;
begin
 if actor is null then raise exception 'Usuario de equipo no activo.';end if;
 if length(p_query)>200 or (p_from is not null and p_to is not null and p_from>p_to) or p_mode not in ('all','pinned','tasks') then raise exception 'Filtro no válido.';end if;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object(
   'last_seq',coalesce((select max(seq) from public.ops_chat_messages m where m.channel_id=c.id),0),'member_role',me.member_role,'muted',me.muted,'last_read_seq',coalesce(me.last_read_seq,0),
   'unread',(select count(*) from public.ops_chat_messages m where m.channel_id=c.id and m.seq>coalesce(me.last_read_seq,0)
      and m.author_email<>actor and m.deleted_at is null)) order by c.group_name,c.name,c.id),'[]'::jsonb)
 into channels from public.ops_chat_channels c
 left join public.ops_chat_members me on me.channel_id=c.id and me.email=actor
 where c.deleted_at is null and (not c.is_private or me.id is not null);
 if p_channel is null then return jsonb_build_object('channels',channels,'messages','[]'::jsonb,'members','[]'::jsonb,'actor',actor);end if;
 if not private.totus_chat_member(p_channel) then raise exception 'No tienes acceso a este canal.';end if;
 if p_parent is not null and not exists(select 1 from public.ops_chat_messages where id=p_parent and channel_id=p_channel and parent_id is null)
 then raise exception 'Conversación no disponible.';end if;
 select coalesce(jsonb_agg(to_jsonb(m)||jsonb_build_object(
   'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'email',r.email)) from public.ops_chat_reactions r where r.message_id=m.id),'[]'::jsonb),
   'replies',(select count(*) from public.ops_chat_messages reply where reply.parent_id=m.id and reply.deleted_at is null)) order by m.seq),'[]'::jsonb)
 into messages from (select * from public.ops_chat_messages m where m.channel_id=p_channel
 and (p_before is null or m.seq<p_before)
 and (p_parent is null or m.parent_id=p_parent or m.id=p_parent)
 and (p_parent is not null or length(p_query)>0 or p_mode<>'all' or m.parent_id is null)
 and (p_query='' or (m.deleted_at is null and (strpos(lower(m.body),lower(p_query))>0 or strpos(lower(m.author_email),lower(p_query))>0)))
 and (p_from is null or (m.created_at at time zone 'Europe/Madrid')::date>=p_from)
 and (p_to is null or (m.created_at at time zone 'Europe/Madrid')::date<=p_to)
 and (p_mode<>'pinned' or m.pinned)
 and (p_mode<>'tasks' or (m.task_state is not null and m.deleted_at is null))
 order by m.seq desc limit 51) m;
 return jsonb_build_object('channels',channels,'messages',messages,'actor',actor,
 'members',(select coalesce(jsonb_agg(jsonb_build_object('email',m.email,'member_role',m.member_role) order by m.email),'[]'::jsonb) from public.ops_chat_members m where m.channel_id=p_channel));
end $$;
-- Public wrappers run as invoker. Only the private implementation elevates
-- after checking the real authenticated identity and current membership.
create function public.totus_chat_command(p_action text,p_data jsonb default '{}')
 returns jsonb language sql security invoker set search_path='' as $$select private.totus_chat_command(p_action,p_data)$$;
create function public.totus_chat_context(p_channel uuid default null,p_before bigint default null,
 p_query text default '',p_from date default null,p_to date default null,p_mode text default 'all',p_parent uuid default null)
 returns jsonb language sql stable security invoker set search_path='' as $$
 select private.totus_chat_context(p_channel,p_before,p_query,p_from,p_to,p_mode,p_parent)$$;
revoke all on function private.totus_chat_actor(),private.totus_chat_member(uuid),private.totus_chat_manager(uuid),
 private.totus_chat_command(text,jsonb),private.totus_chat_context(uuid,bigint,text,date,date,text,uuid),
 public.totus_chat_command(text,jsonb),public.totus_chat_context(uuid,bigint,text,date,date,text,uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.totus_chat_actor(),private.totus_chat_member(uuid),private.totus_chat_manager(uuid),
 private.totus_chat_command(text,jsonb),private.totus_chat_context(uuid,bigint,text,date,date,text,uuid),
 public.totus_chat_command(text,jsonb),public.totus_chat_context(uuid,bigint,text,date,date,text,uuid) to authenticated;
