begin;
create or replace function public.totus_chat_ai_accounts() returns jsonb
language plpgsql security definer set search_path='' as $$
declare legacy_id text;
begin
 if auth.uid() is null or not private.is_team_member() or not private.totus_module_can(lower(auth.jwt()->>'email'),'equipo','view') then raise exception 'Sesión y permiso de Chat requeridos';end if;
 select decrypted_secret::jsonb->>'user_id' into legacy_id from vault.decrypted_secrets where name='totus_assistant_credentials';
 return coalesce((select jsonb_agg(jsonb_build_object('email',t.email,'name',t.full_name,'mode',case when exists(select 1 from private.totus_api_connections c where c.actor_email=t.email and c.protocol in ('cloudflare','openai_compatible','anthropic') and c.enabled and c.free_confirmed and c.real_data_authorized and c.verified_revision=c.revision) then 'api' else 'manual' end,'chatgpt',u.id::text=legacy_id) order by t.full_name)
 from public.team_members t join auth.users u on lower(u.email)=lower(t.email) and u.deleted_at is null
 where t.active and t.deleted_at is null and t.purged_at is null and
 (exists(select 1 from private.totus_api_connections c where c.actor_email=t.email and c.protocol in ('cloudflare','openai_compatible','anthropic') and c.enabled and c.free_confirmed and c.real_data_authorized and c.verified_revision=c.revision)
 or u.id::text=legacy_id)), '[]'::jsonb);
end$$;
revoke all on function public.totus_chat_ai_accounts() from public,anon;
grant execute on function public.totus_chat_ai_accounts() to authenticated;
commit;
