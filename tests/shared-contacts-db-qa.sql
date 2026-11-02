\set ON_ERROR_STOP on
create schema if not exists private;
create schema if not exists auth;
create function auth.uid() returns uuid language sql as $$select null::uuid$$;
create role anon;create role authenticated;
create table providers(id uuid primary key,name text not null,active boolean default true,created_at timestamptz default now());
create table brands(id uuid primary key,name text);
create table ops_suppliers(id uuid primary key,name text not null,active boolean default true,tax_id text default '',email text default '',phone text default '',address text default '',city text default '',postal_code text default '',province text default '',country text default 'España',notes text default '',source text,created_by uuid,created_at timestamptz default now(),updated_at timestamptz default now(),default_vat_rate numeric default 21);
create table prices(provider_id uuid references providers(id) on delete restrict);
create table expenses(supplier_id uuid references ops_suppliers(id) on delete restrict);
insert into providers(id,name) values('11111111-1111-4111-8111-111111111111','Pricing contact');
insert into ops_suppliers(id,name,email,default_vat_rate) values('22222222-2222-4222-8222-222222222222','Expense contact','before@example.invalid',10);
\ir ../supabase/review_patches/042_shared_contacts.sql
\ir ../supabase/review_patches/042_shared_contacts.sql
create function qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception 'QA failed: %',label;end if;end$$;
select qa_assert((select count(*)=2 from providers) and (select count(*)=2 from ops_suppliers),'backfill both directions and replay');
update providers set email='after@example.invalid',name='Updated',active=false where id='22222222-2222-4222-8222-222222222222';
select qa_assert((select email='after@example.invalid' and name='Updated' and not active and default_vat_rate=10 from ops_suppliers where id='22222222-2222-4222-8222-222222222222'),'common fields mirror without losing fiscal defaults');
update ops_suppliers set phone='123',tax_id='FAKE' where id='11111111-1111-4111-8111-111111111111';
select qa_assert((select phone='123' and tax_id='FAKE' from providers where id='11111111-1111-4111-8111-111111111111'),'expense edits visible in pricing');
insert into prices values('11111111-1111-4111-8111-111111111111');
do $$begin begin delete from ops_suppliers where id='11111111-1111-4111-8111-111111111111';raise exception 'Expected FK';exception when foreign_key_violation then null;end;end$$;
select qa_assert((select count(*)=2 from ops_suppliers) and (select count(*)=2 from providers),'price references protect both copies atomically');
insert into expenses values('22222222-2222-4222-8222-222222222222');
do $$begin begin delete from providers where id='22222222-2222-4222-8222-222222222222';raise exception 'Expected FK';exception when foreign_key_violation then null;end;end$$;
select qa_assert((select count(*)=2 from providers),'expense references protect shared contact');
insert into providers select * from jsonb_populate_recordset(null::providers,'[{"id":"33333333-3333-4333-8333-333333333333","name":"Old archive","active":true}]');
select qa_assert((select name='Old archive' and email='' from ops_suppliers where id='33333333-3333-4333-8333-333333333333'),'old backup missing new fields remains recoverable');
delete from providers where id='33333333-3333-4333-8333-333333333333';
select qa_assert(not exists(select 1 from ops_suppliers where id='33333333-3333-4333-8333-333333333333'),'unused contact removal mirrors');
select qa_assert(not has_function_privilege('authenticated','private.totus_sync_supplier_directory()','execute'),'sync cannot be directly invoked');
select 'SHARED CONTACTS QA OK';
