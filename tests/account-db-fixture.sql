-- Disposable QA database only. These are fictitious users, never production accounts.
create or replace function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create table public.profiles(id uuid primary key,email text,role text default 'empleado',ui_preferences jsonb default '{}');
create table public.team_members(email text primary key,active boolean not null default true,role text default 'empleado');
create table public.ops_audit_log(id bigserial primary key,user_id uuid,user_email text,area text,action text,detail jsonb);
create function private.is_team_member() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.team_members where lower(email)=lower(auth.jwt()->>'email') and active)$$;
create function private.totus_chat_write_lock() returns void language sql as $$select pg_advisory_xact_lock_shared(724021126::bigint)$$;
grant usage on schema auth,private to authenticated;
insert into public.profiles(id,email,ui_preferences) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','a@example.invalid','{"interface":{"config":{"primary":"#123456"}},"team_chat":{"sound":true}}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','b@example.invalid','{"other":"preserved"}');
insert into public.team_members(email) values('a@example.invalid'),('b@example.invalid');
