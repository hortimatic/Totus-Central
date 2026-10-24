-- Repeated removal must not consume another attachment's pending count.
create or replace function private.totus_chat_file_remove(p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare f public.ops_chat_files; actor text=private.totus_chat_actor();
begin
 perform private.totus_chat_write_lock();
 select * into strict f from public.ops_chat_files where id=p_id for update;
 if actor is null or not private.totus_chat_member(f.channel_id) or exists(select 1 from public.ops_chat_channels where id=f.channel_id and archived) or (f.uploaded_by<>auth.uid() and not private.totus_chat_manager(f.channel_id))
 then raise exception 'No puedes retirar este adjunto.';end if;
 if f.deleted_at is not null then return;end if;
 update public.ops_chat_files set deleted_at=coalesce(deleted_at,now()) where id=p_id;
 insert into public.ops_chat_events(channel_id,actor_email,action,entity_id) values(f.channel_id,actor,'file_detached',f.id);
 update public.ops_chat_messages set expected_files=greatest(0,expected_files-1) where id=f.message_id;
 -- The verified original stays recoverable in OneDrive and complete backups.
end $$;
