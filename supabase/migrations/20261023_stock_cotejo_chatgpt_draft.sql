-- Feature draft. Do not apply to production until QA, permissions and backup inclusion are verified.
-- ChatGPT writes results through the authorized Supabase connection. The website is read-only.
begin;
create table public.ops_stock_cotejos (
 id uuid primary key default gen_random_uuid(),
 shop text not null check (shop in ('NewOldSmok','Hortimatic')),
 supplier text not null default '',
 reference text not null default '',
 received_on date,
 status text not null default 'pendiente'
   check (status in ('pendiente','incompleto','con_diferencias','sin_diferencias')),
 complete boolean not null default false,
 coverage text not null default '',
 documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents)='array'),
 warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings)='array'),
 rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows)='array'),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ops_stock_cotejos_only_verified_clear check (status<>'sin_diferencias' or complete)
);
create index ops_stock_cotejos_recent on public.ops_stock_cotejos(created_at desc,id);
create index ops_stock_cotejos_shop_date on public.ops_stock_cotejos(shop,received_on desc);
create unique index ops_stock_cotejos_document_key on public.ops_stock_cotejos(shop,lower(btrim(supplier)),lower(btrim(reference)))
 where btrim(reference)<>'' and btrim(supplier)<>'';

create table public.ops_stock_equivalences (
 id uuid primary key default gen_random_uuid(),
 shop text not null check (shop in ('NewOldSmok','Hortimatic')),
 supplier text not null,
 supplier_product text not null,
 supplier_reference text not null default '',
 stock_product text not null,
 stock_reference text not null default '',
 variant text not null default '',
 unit text not null default '',
 unit_factor numeric check (unit_factor is null or unit_factor>0),
 evidence text not null default '',
 confirmed boolean not null default false,
 confirmed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ops_stock_equivalences_confirmed check (not confirmed or (confirmed_at is not null and btrim(evidence)<>'' and btrim(unit)<>'')),
 constraint ops_stock_equivalences_unique unique (shop,supplier,supplier_product,supplier_reference,variant,stock_product)
);
-- Both relations inherit Totus's document-view scope and require an active authenticated team member.
-- No browser writes: corrections must be reviewed and persisted through the authorized connector.
alter table public.ops_stock_cotejos enable row level security;
alter table public.ops_stock_equivalences enable row level security;
revoke all on public.ops_stock_cotejos, public.ops_stock_equivalences from public,anon,authenticated;
grant select on public.ops_stock_cotejos, public.ops_stock_equivalences to authenticated;
grant select,insert,update,delete on public.ops_stock_cotejos, public.ops_stock_equivalences to service_role;
create policy ops_stock_cotejos_read on public.ops_stock_cotejos for select to authenticated
 using ((select private.totus_can('documentos','view')));
create policy ops_stock_equivalences_read on public.ops_stock_equivalences for select to authenticated
 using ((select private.totus_can('documentos','view')));
commit;
