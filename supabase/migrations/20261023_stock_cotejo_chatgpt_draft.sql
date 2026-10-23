-- BORRADOR sin aplicar. Mantener fuera de producción hasta pruebas de copias/recuperación.
-- Los originales se archivan mediante ops_documents (y OneDrive). ChatGPT analiza las
-- extracciones en esta tabla y guarda el cotejo usando una conexión autorizada.
begin;
create table public.ops_stock_cotejos (
 id uuid primary key default gen_random_uuid(),
 shop text not null check (shop in ('NewOldSmok','Hortimatic')),
 supplier text not null default '' check (char_length(supplier)<=200),
 reference text not null default '' check (char_length(reference)<=200),
 received_on date,
 status text not null default 'pendiente'
   check (status in ('pendiente','incompleto','con_diferencias','sin_diferencias')),
 complete boolean not null default false,
 coverage text not null default '',
 documents jsonb not null default '[]'::jsonb check (jsonb_typeof(documents)='array'),
 warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings)='array'),
 rows jsonb not null default '[]'::jsonb check (jsonb_typeof(rows)='array'),
 notes text not null default '',
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint ops_stock_cotejos_only_verified_clear check (status<>'sin_diferencias' or complete),
 constraint ops_stock_cotejos_max_rows check (jsonb_array_length(rows)<=1500)
);
create index ops_stock_cotejos_recent on public.ops_stock_cotejos(created_at desc,id);
create index ops_stock_cotejos_shop_date on public.ops_stock_cotejos(shop,received_on desc);
create unique index ops_stock_cotejos_document_key on public.ops_stock_cotejos(shop,lower(btrim(supplier)),lower(btrim(reference)))
 where btrim(reference)<>'' and btrim(supplier)<>'';

create table public.ops_stock_cotejo_sources (
 id uuid primary key default gen_random_uuid(),
 cotejo_id uuid not null references public.ops_stock_cotejos(id) on delete restrict,
 document_id uuid not null unique references public.ops_documents(id) on delete restrict,
 source_kind text not null check (source_kind in ('proveedor','prestashop')),
 extracted_text text not null default '' check (char_length(extracted_text)<=250000),
 extraction_state text not null default 'sin_texto' check (extraction_state in ('listo','parcial','sin_texto')),
 extraction_notes text not null default '' check (char_length(extraction_notes)<=500),
 extracted_pages integer check (extracted_pages is null or extracted_pages between 0 and 100),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index ops_stock_cotejo_sources_lot on public.ops_stock_cotejo_sources(cotejo_id,created_at);

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

alter table public.ops_stock_cotejos enable row level security;
alter table public.ops_stock_cotejo_sources enable row level security;
alter table public.ops_stock_equivalences enable row level security;
revoke all on public.ops_stock_cotejos,public.ops_stock_cotejo_sources,public.ops_stock_equivalences from public,anon,authenticated;
grant select on public.ops_stock_cotejos,public.ops_stock_cotejo_sources,public.ops_stock_equivalences to authenticated;
-- El navegador SOLO puede crear lotes sin resultado y vincular originales.
-- Nunca puede alterar las conclusiones, modificar equivalencias ni borrar pruebas.
grant insert(shop,supplier,reference,received_on) on public.ops_stock_cotejos to authenticated;
grant insert(cotejo_id,document_id,source_kind,extracted_text,extraction_state,extraction_notes,extracted_pages)
 on public.ops_stock_cotejo_sources to authenticated;
grant all on public.ops_stock_cotejos,public.ops_stock_cotejo_sources,public.ops_stock_equivalences to service_role;
create policy ops_stock_cotejos_read on public.ops_stock_cotejos for select to authenticated
 using ((select private.totus_can('documentos','view')));
create policy ops_stock_cotejos_create on public.ops_stock_cotejos for insert to authenticated
 with check (
   created_by=auth.uid()
   and private.totus_can('documentos','create')
   and status='pendiente' and not complete and rows='[]'::jsonb
   and documents='[]'::jsonb and warnings='[]'::jsonb
   and coverage='' and notes=''
 );
create policy ops_stock_cotejo_sources_read on public.ops_stock_cotejo_sources for select to authenticated
 using ((select private.totus_can('documentos','view')));
create policy ops_stock_cotejo_sources_create on public.ops_stock_cotejo_sources for insert to authenticated
 with check (
   created_by=auth.uid() and private.totus_can('documentos','create')
   and exists (
      select 1 from public.ops_stock_cotejos c
      join public.ops_documents d on d.id=ops_stock_cotejo_sources.document_id
      where c.id=ops_stock_cotejo_sources.cotejo_id
        and c.created_by=auth.uid()
        and c.status='pendiente' and not c.complete
        and d.uploaded_by=auth.uid()
        and d.linked_entity_type='stock_cotejo'
        and d.linked_entity_id=c.id
        and (
          (c.shop='Hortimatic' and exists(select 1 from public.ops_stores st where st.id=d.store_id and st.name ilike '%Hortimatic%'))
          or (c.shop='NewOldSmok' and exists(select 1 from public.ops_stores st where st.id=d.store_id and st.name ilike '%NewOldSmok%'))
        )
   )
 );
create policy ops_stock_equivalences_read on public.ops_stock_equivalences for select to authenticated
 using ((select private.totus_can('documentos','view')));
commit;
