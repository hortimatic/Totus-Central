-- Disposable PostgreSQL 17 fixture. No user data, no production connection.
create role authenticated;
create role anon;
create schema auth;
create schema private;
create table public.profiles(
 id uuid primary key,
 email text not null,
 active boolean not null default true,
 ui_preferences jsonb not null default '{}'::jsonb
);
create table public.team_members(email text primary key,active boolean not null default true);
create function auth.uid() returns uuid language sql stable as
 $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as
 $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function public.qa_assert(condition boolean,message text) returns void language plpgsql as
 $$begin if condition is not true then raise exception 'QA FAILED: %',message;end if;end$$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;
alter table public.profiles enable row level security;
create policy profile_own_read on public.profiles for select to authenticated using(id=auth.uid());
insert into public.profiles(id,email,active,ui_preferences) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa-one@example.invalid',true,'{"interface":{"accent":"blue"},"team_chat":{"volume":40}}'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','qa-two@example.invalid',true,'{"interface":{"accent":"red"}}'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','qa-off@example.invalid',false,'{}');
insert into public.team_members(email,active) values
 ('qa-one@example.invalid',true),('qa-two@example.invalid',true),('qa-off@example.invalid',true);
create function public.qa_rejected(p_action text,p_layout jsonb,p_revision integer)
returns boolean language plpgsql as $$
begin
 perform public.totus_home_dashboard(p_action,p_layout,p_revision);
 return false;
exception when others then
 return true;
end$$;
