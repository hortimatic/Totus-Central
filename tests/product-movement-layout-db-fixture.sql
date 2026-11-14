create role anon;create role authenticated;
create schema auth;create schema private;grant usage on schema auth,private to authenticated;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function private.totus_can(text,text) returns boolean language sql stable as $$select coalesce(current_setting('test.allow_products',true),'')='yes'$$;
create table public.profiles(id uuid primary key,ui_preferences jsonb);
insert into public.profiles values('11111111-1111-4111-8111-111111111111','{"products_table":{"keep":true}}'),('22222222-2222-4222-8222-222222222222','{"private":"untouched"}');
