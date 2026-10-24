create schema extensions;create extension pgcrypto with schema extensions;
create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
create table auth.users(id uuid primary key,email text);
create table public.team_members(email text primary key,role text,active boolean,full_name text not null default '');
create table public.ops_stores(id uuid primary key,name text);
insert into auth.users values('11111111-1111-4111-8111-111111111111','admin@example.invalid'),('22222222-2222-4222-8222-222222222222','staff@example.invalid'),('33333333-3333-4333-8333-333333333333','other@example.invalid');
insert into public.team_members(email,role,active) values('admin@example.invalid','admin',true),('staff@example.invalid','encargado',true),('other@example.invalid','encargado',true);
grant usage on schema auth to authenticated,service_role;
grant usage on schema private to service_role;
create function public.qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'QA failed: %',label;end if;end$$;
create function public.qa_denied(query text,fragment text) returns void language plpgsql security invoker as $$
declare failed boolean=false;begin
 begin execute query;exception when others then
  if strpos(lower(sqlerrm),lower(fragment))=0 then raise exception 'Unexpected error: %',sqlerrm;end if;failed=true;
 end;
 if not failed then raise exception 'QA expected denial: %',query;end if;
end$$;
