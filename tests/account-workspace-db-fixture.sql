-- Dedicated disposable database: no business records or credentials.
create schema auth;create schema private;
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function public.qa_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is not true then raise exception 'QA: %',message;end if;end$$;
\i tests/account-db-fixture.sql
create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.team_members where lower(email)=lower(auth.jwt()->>'email') and active and role='admin')$$;
insert into public.profiles(id,email,role) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','admin@example.invalid','admin');
insert into public.team_members(email,role) values('admin@example.invalid','admin');
alter table public.profiles enable row level security;
grant select on public.profiles to authenticated;
create policy profiles_team_select on public.profiles for select to authenticated using(private.is_team_member());
create policy totus_profile_directory_privacy on public.profiles as restrictive for select to authenticated using(id=(select auth.uid()) or private.is_admin());
