-- Disposable database: no real identities, documents or credentials.
create role anon; create role authenticated;
create schema auth; create schema private; create schema vault;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
create table public.ops_roles(code text primary key);
insert into public.ops_roles values('admin'),('gerente'),('encargado'),('custom');
create table public.team_members(email text primary key,role text,active boolean);
insert into public.team_members values('admin@example.invalid','admin',true),('manager@example.invalid','gerente',true),('staff@example.invalid','encargado',true),('custom@example.invalid','custom',true);
create table public.ops_user_permissions(email text,module text constraint ops_user_permissions_module_check check(module in ('documentos')),can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_export boolean);
create table public.ops_role_permissions(role text,module text constraint ops_role_permissions_module_check check(module in ('documentos')),can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_export boolean);
create function private.totus_module_can(text,text,text) returns boolean language sql stable as $$select false$$;
create function private.totus_can(m text,a text) returns boolean language sql stable as $$select private.totus_module_can(current_setting('qa.email',true),m,a)$$;
create table private.totus_api_connections(id uuid,name text,protocol text,enabled boolean,revision int,verified_revision int,verified_at timestamptz,real_data_authorized boolean);
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into private.totus_api_connections values('11111111-1111-4111-8111-111111111111','PrestaShop · Hortimatic','prestashop',true,1,1,now(),true),('22222222-2222-4222-8222-222222222222','Other private service','openai',true,1,1,now(),true);
insert into vault.decrypted_secrets values('totus_api_11111111-1111-4111-8111-111111111111','fictional-test-key');
