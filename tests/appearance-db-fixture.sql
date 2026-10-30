-- Isolated schema used only by CI, after the chat fixtures.
create table public.ops_business_settings(id smallint primary key,tax_id text,irpf_prepayment_rate numeric);
insert into public.ops_business_settings values(1,'FICTICIO',20);
alter table public.ops_business_settings enable row level security;
grant all on public.ops_business_settings to anon,authenticated;
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select auth.uid()='11111111-1111-4111-8111-111111111111'::uuid$$;
create policy qa_business_read on public.ops_business_settings for select to authenticated using(private.totus_chat_actor() is not null);
create policy qa_business_update on public.ops_business_settings for update to authenticated using(private.is_admin()) with check(private.is_admin());
-- Include business settings to test that optional branding preserves the hash.
create or replace function private.totus_recovery_tables() returns text[] language sql stable as $$select array['profiles','ops_role_permissions','ops_user_permissions','ops_business_settings']::text[]$$;
