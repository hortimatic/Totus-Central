
-- Totus Central V6/V7 - Facturación avanzada, plantillas y proformas
-- Preparado para desarrollo-v6. No ejecutar sobre otra base sin revisar.

alter table public.ops_business_settings
  add column if not exists default_invoice_template_id uuid,
  add column if not exists invoice_footer_text text not null default '',
  add column if not exists invoice_payment_terms text not null default '',
  add column if not exists invoice_notes_default text not null default '';

create table if not exists public.ops_invoice_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  style_code text not null default 'modern'
    check (style_code in ('modern','minimal','classic')),
  primary_color text not null default '#19D3C5',
  secondary_color text not null default '#101B27',
  font_family text not null default 'helvetica',
  logo_path text,
  show_logo boolean not null default true,
  logo_position text not null default 'left'
    check (logo_position in ('left','center','right')),
  show_company_email boolean not null default true,
  show_company_phone boolean not null default true,
  footer_text text not null default '',
  payment_terms text not null default '',
  notes_default text not null default '',
  is_default boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ops_invoice_templates(name,style_code,primary_color,secondary_color,is_default)
values
 ('Totus Modern','modern','#19D3C5','#101B27',true),
 ('Totus Minimal','minimal','#1F2937','#FFFFFF',false),
 ('Totus Classic','classic','#2B2B2B','#F3F4F6',false)
on conflict(name) do nothing;

update public.ops_business_settings s
set default_invoice_template_id = coalesce(
  s.default_invoice_template_id,
  (select id from public.ops_invoice_templates where is_default limit 1)
)
where s.id=1;

alter table public.ops_invoice_series
  add column if not exists series_kind text not null default 'invoice'
    check (series_kind in ('invoice','rectifying'));

alter table public.ops_sales_invoices
  add column if not exists invoice_kind text not null default 'invoice'
    check (invoice_kind in ('invoice','rectifying')),
  add column if not exists template_id uuid references public.ops_invoice_templates(id) on delete set null,
  add column if not exists template_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists due_date date,
  add column if not exists source_proforma_id uuid;

insert into public.ops_invoice_series(store_id,year,code,prefix,next_number,padding,series_kind)
select id,2026,'RH-2026','RH-2026-',1,4,'rectifying'
from public.ops_stores where code='HORTIMATIC'
on conflict(year,code) do nothing;
insert into public.ops_invoice_series(store_id,year,code,prefix,next_number,padding,series_kind)
select id,2026,'RN-2026','RN-2026-',1,4,'rectifying'
from public.ops_stores where code='NEWOLDSMOK'
on conflict(year,code) do nothing;

create table if not exists public.ops_proforma_series (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.ops_stores(id) on delete restrict,
  year integer not null,
  code text not null,
  prefix text not null,
  next_number integer not null default 1 check (next_number > 0),
  padding integer not null default 4 check (padding between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(year,code)
);

insert into public.ops_proforma_series(store_id,year,code,prefix,next_number,padding)
select id,2026,'PRO-H-2026','PRO-H-2026-',1,4 from public.ops_stores where code='HORTIMATIC'
on conflict(year,code) do nothing;
insert into public.ops_proforma_series(store_id,year,code,prefix,next_number,padding)
select id,2026,'PRO-N-2026','PRO-N-2026-',1,4 from public.ops_stores where code='NEWOLDSMOK'
on conflict(year,code) do nothing;

create table if not exists public.ops_proformas (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.ops_proforma_series(id) on delete restrict,
  store_id uuid references public.ops_stores(id) on delete set null,
  template_id uuid references public.ops_invoice_templates(id) on delete set null,
  issue_date date not null,
  valid_until date,
  number integer not null,
  display_number text not null,
  status text not null default 'borrador'
    check (status in ('borrador','enviada','aceptada','rechazada','convertida','anulada')),
  customer_name text not null default '',
  customer_tax_id text not null default '',
  customer_address text not null default '',
  customer_email text not null default '',
  concept text not null default '',
  payment_method text not null default 'transferencia'
    check (payment_method in ('efectivo','tarjeta','transferencia','bizum','domiciliado','otro')),
  base_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0,
  notes text not null default '',
  converted_invoice_id uuid references public.ops_sales_invoices(id) on delete set null,
  generated_document_id uuid references public.ops_documents(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(series_id,number)
);

alter table public.ops_sales_invoices
  drop constraint if exists ops_sales_invoices_source_proforma_id_fkey;
alter table public.ops_sales_invoices
  add constraint ops_sales_invoices_source_proforma_id_fkey
  foreign key (source_proforma_id) references public.ops_proformas(id) on delete set null;

create table if not exists public.ops_proforma_lines (
  id uuid primary key default gen_random_uuid(),
  proforma_id uuid not null references public.ops_proformas(id) on delete cascade,
  sort_order integer not null default 10,
  description text not null,
  quantity numeric not null default 1 check (quantity > 0),
  unit_price_base numeric not null default 0,
  discount_pct numeric not null default 0 check (discount_pct between 0 and 100),
  vat_rate numeric not null default 21 check (vat_rate >= 0),
  base_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  total_amount numeric not null default 0
);

create table if not exists public.ops_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('excel_diario','gestoria_pdf','manual')),
  source_name text not null,
  source_sha256 text not null default '',
  imported_at timestamptz not null default now(),
  notes text not null default '',
  unique(source_type,source_name,source_sha256)
);

alter table public.ops_daily_closings add column if not exists import_batch_id uuid references public.ops_import_batches(id) on delete set null;
alter table public.ops_daily_closings add column if not exists source_ref text;
alter table public.ops_expenses add column if not exists import_batch_id uuid references public.ops_import_batches(id) on delete set null;
alter table public.ops_expenses add column if not exists source_ref text;
alter table public.ops_income_adjustments add column if not exists import_batch_id uuid references public.ops_import_batches(id) on delete set null;
alter table public.ops_income_adjustments add column if not exists source_ref text;

create unique index if not exists ops_closing_source_ref_uq on public.ops_daily_closings(source_ref) where source_ref is not null;
create unique index if not exists ops_expense_source_ref_uq on public.ops_expenses(source_ref) where source_ref is not null;
create unique index if not exists ops_income_source_ref_uq on public.ops_income_adjustments(source_ref) where source_ref is not null;

create index if not exists ops_invoice_templates_default_idx on public.ops_invoice_templates(is_default) where active=true;
create index if not exists ops_proforma_date_idx on public.ops_proformas(issue_date desc);
create index if not exists ops_proforma_store_idx on public.ops_proformas(store_id);
create index if not exists ops_proforma_created_by_idx on public.ops_proformas(created_by);
create index if not exists ops_proforma_template_idx on public.ops_proformas(template_id);
create index if not exists ops_proforma_lines_proforma_idx on public.ops_proforma_lines(proforma_id);
create index if not exists ops_sales_invoice_template_idx on public.ops_sales_invoices(template_id);
create index if not exists ops_sales_invoice_source_proforma_idx on public.ops_sales_invoices(source_proforma_id);
create index if not exists ops_closing_import_batch_idx on public.ops_daily_closings(import_batch_id);
create index if not exists ops_expense_import_batch_idx on public.ops_expenses(import_batch_id);
create index if not exists ops_income_import_batch_idx on public.ops_income_adjustments(import_batch_id);

create or replace function public.ops_touch_invoice_template()
returns trigger language plpgsql set search_path='public'
as $$ begin new.updated_at=now(); return new; end; $$;

drop trigger if exists ops_invoice_templates_touch on public.ops_invoice_templates;
create trigger ops_invoice_templates_touch before update on public.ops_invoice_templates
for each row execute function public.ops_touch_invoice_template();

create or replace function public.ops_calc_proforma_line()
returns trigger language plpgsql set search_path='public'
as $$
begin
  new.base_amount=round(new.quantity*new.unit_price_base*(1-new.discount_pct/100),2);
  new.vat_amount=round(new.base_amount*new.vat_rate/100,2);
  new.total_amount=round(new.base_amount+new.vat_amount,2);
  return new;
end;
$$;

create or replace function public.ops_recalc_proforma_totals()
returns trigger language plpgsql set search_path='public'
as $$
declare pid uuid;
begin
  pid=coalesce(new.proforma_id,old.proforma_id);
  update public.ops_proformas p set
    base_amount=coalesce((select sum(base_amount) from public.ops_proforma_lines where proforma_id=pid),0),
    vat_amount=coalesce((select sum(vat_amount) from public.ops_proforma_lines where proforma_id=pid),0),
    total_amount=coalesce((select sum(total_amount) from public.ops_proforma_lines where proforma_id=pid),0),
    updated_at=now()
  where p.id=pid;
  return coalesce(new,old);
end;
$$;

drop trigger if exists ops_proforma_line_calc on public.ops_proforma_lines;
create trigger ops_proforma_line_calc before insert or update on public.ops_proforma_lines
for each row execute function public.ops_calc_proforma_line();

drop trigger if exists ops_proforma_line_totals on public.ops_proforma_lines;
create trigger ops_proforma_line_totals after insert or update or delete on public.ops_proforma_lines
for each row execute function public.ops_recalc_proforma_totals();

create or replace function public.ops_next_proforma_number(p_series_id uuid)
returns table(number integer, display_number text)
language plpgsql security definer set search_path='public'
as $$
declare s public.ops_proforma_series; n integer;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  select * into s from public.ops_proforma_series where id=p_series_id and active=true for update;
  if not found then raise exception 'Serie de proforma no disponible'; end if;
  n=s.next_number;
  update public.ops_proforma_series set next_number=n+1 where id=s.id;
  return query select n, s.prefix||lpad(n::text,s.padding,'0');
end;
$$;

create or replace function public.ops_convert_proforma(p_proforma_id uuid, p_invoice_series_id uuid)
returns uuid
language plpgsql security definer set search_path='public'
as $$
declare p public.ops_proformas; iid uuid;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  select * into p from public.ops_proformas where id=p_proforma_id for update;
  if not found then raise exception 'Proforma no encontrada'; end if;
  if p.status='convertida' and p.converted_invoice_id is not null then return p.converted_invoice_id; end if;
  if p.status='anulada' then raise exception 'La proforma está anulada'; end if;

  insert into public.ops_sales_invoices(
    series_id,store_id,template_id,issue_date,due_date,origin,status,
    customer_name,customer_tax_id,customer_address,customer_email,concept,payment_method,
    paid_status,include_in_income,notes,created_by,source_proforma_id
  ) values(
    p_invoice_series_id,p.store_id,p.template_id,current_date,null,'totus','borrador',
    p.customer_name,p.customer_tax_id,p.customer_address,p.customer_email,p.concept,p.payment_method,
    'pendiente',false,p.notes,auth.uid(),p.id
  ) returning id into iid;

  insert into public.ops_sales_invoice_lines(invoice_id,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,base_amount,vat_amount,total_amount)
  select iid,sort_order,description,quantity,unit_price_base,discount_pct,vat_rate,base_amount,vat_amount,total_amount
  from public.ops_proforma_lines where proforma_id=p.id order by sort_order;

  update public.ops_proformas set status='convertida',converted_invoice_id=iid,updated_at=now() where id=p.id;
  return iid;
end;
$$;

create or replace function public.ops_issue_invoice(p_invoice_id uuid)
returns public.ops_sales_invoices
language plpgsql security definer set search_path='public'
as $$
declare inv public.ops_sales_invoices; ser public.ops_invoice_series; n integer; tpl public.ops_invoice_templates;
begin
  if not private.is_team_member() then raise exception 'Sin acceso'; end if;
  select * into inv from public.ops_sales_invoices where id=p_invoice_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if inv.status='emitida' then return inv; end if;
  if inv.status='anulada' then raise exception 'Una factura anulada no puede emitirse'; end if;
  if not exists(select 1 from public.ops_sales_invoice_lines where invoice_id=p_invoice_id)
    then raise exception 'La factura no tiene líneas'; end if;
  select * into ser from public.ops_invoice_series where id=inv.series_id for update;
  if not found or not ser.active then raise exception 'Serie no disponible'; end if;
  if ser.series_kind<>inv.invoice_kind then raise exception 'La serie no corresponde al tipo de factura'; end if;

  n=ser.next_number;
  update public.ops_invoice_series set next_number=n+1 where id=ser.id;
  select * into tpl from public.ops_invoice_templates where id=inv.template_id;
  update public.ops_sales_invoices set
    number=n,
    display_number=ser.prefix||lpad(n::text,ser.padding,'0'),
    status='emitida',
    template_snapshot=case when tpl.id is null then '{}'::jsonb else to_jsonb(tpl) end,
    updated_at=now()
  where id=p_invoice_id returning * into inv;
  return inv;
end;
$$;

alter table public.ops_invoice_templates enable row level security;
alter table public.ops_proforma_series enable row level security;
alter table public.ops_proformas enable row level security;
alter table public.ops_proforma_lines enable row level security;
alter table public.ops_import_batches enable row level security;

drop policy if exists ops_invoice_templates_read on public.ops_invoice_templates;
drop policy if exists ops_invoice_templates_insert on public.ops_invoice_templates;
drop policy if exists ops_invoice_templates_update on public.ops_invoice_templates;
drop policy if exists ops_invoice_templates_delete on public.ops_invoice_templates;
create policy ops_invoice_templates_read on public.ops_invoice_templates for select to authenticated using(private.is_team_member());
create policy ops_invoice_templates_insert on public.ops_invoice_templates for insert to authenticated with check(private.is_manager());
create policy ops_invoice_templates_update on public.ops_invoice_templates for update to authenticated using(private.is_manager()) with check(private.is_manager());
create policy ops_invoice_templates_delete on public.ops_invoice_templates for delete to authenticated using(private.is_admin());

drop policy if exists ops_proforma_series_read on public.ops_proforma_series;
drop policy if exists ops_proforma_series_insert on public.ops_proforma_series;
drop policy if exists ops_proforma_series_update on public.ops_proforma_series;
drop policy if exists ops_proforma_series_delete on public.ops_proforma_series;
create policy ops_proforma_series_read on public.ops_proforma_series for select to authenticated using(private.is_team_member());
create policy ops_proforma_series_insert on public.ops_proforma_series for insert to authenticated with check(private.is_manager());
create policy ops_proforma_series_update on public.ops_proforma_series for update to authenticated using(private.is_manager()) with check(private.is_manager());
create policy ops_proforma_series_delete on public.ops_proforma_series for delete to authenticated using(private.is_admin());

drop policy if exists ops_proformas_read on public.ops_proformas;
drop policy if exists ops_proformas_insert on public.ops_proformas;
drop policy if exists ops_proformas_update on public.ops_proformas;
drop policy if exists ops_proformas_delete on public.ops_proformas;
create policy ops_proformas_read on public.ops_proformas for select to authenticated using(private.is_team_member());
create policy ops_proformas_insert on public.ops_proformas for insert to authenticated with check(private.is_team_member());
create policy ops_proformas_update on public.ops_proformas for update to authenticated using(private.is_team_member()) with check(private.is_team_member());
create policy ops_proformas_delete on public.ops_proformas for delete to authenticated using(private.is_manager() and status='borrador');

drop policy if exists ops_proforma_lines_read on public.ops_proforma_lines;
drop policy if exists ops_proforma_lines_insert on public.ops_proforma_lines;
drop policy if exists ops_proforma_lines_update on public.ops_proforma_lines;
drop policy if exists ops_proforma_lines_delete on public.ops_proforma_lines;
create policy ops_proforma_lines_read on public.ops_proforma_lines for select to authenticated using(private.is_team_member());
create policy ops_proforma_lines_insert on public.ops_proforma_lines for insert to authenticated with check(private.is_team_member());
create policy ops_proforma_lines_update on public.ops_proforma_lines for update to authenticated using(private.is_team_member()) with check(private.is_team_member());
create policy ops_proforma_lines_delete on public.ops_proforma_lines for delete to authenticated using(private.is_team_member());

drop policy if exists ops_import_batches_read on public.ops_import_batches;
drop policy if exists ops_import_batches_insert on public.ops_import_batches;
create policy ops_import_batches_read on public.ops_import_batches for select to authenticated using(private.is_team_member());
create policy ops_import_batches_insert on public.ops_import_batches for insert to authenticated with check(private.is_manager());

revoke all on function public.ops_next_proforma_number(uuid) from anon,public;
revoke all on function public.ops_convert_proforma(uuid,uuid) from anon,public;
grant execute on function public.ops_next_proforma_number(uuid) to authenticated;
grant execute on function public.ops_convert_proforma(uuid,uuid) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('business-assets','business-assets',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists ops_assets_select on storage.objects;
drop policy if exists ops_assets_insert on storage.objects;
drop policy if exists ops_assets_update on storage.objects;
drop policy if exists ops_assets_delete on storage.objects;
create policy ops_assets_select on storage.objects for select to authenticated
using(bucket_id='business-assets' and private.is_team_member());
create policy ops_assets_insert on storage.objects for insert to authenticated
with check(bucket_id='business-assets' and private.is_manager());
create policy ops_assets_update on storage.objects for update to authenticated
using(bucket_id='business-assets' and private.is_manager())
with check(bucket_id='business-assets' and private.is_manager());
create policy ops_assets_delete on storage.objects for delete to authenticated
using(bucket_id='business-assets' and private.is_manager());