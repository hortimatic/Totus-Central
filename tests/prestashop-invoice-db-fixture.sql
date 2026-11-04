do $$ begin create role anon;exception when duplicate_object then null;end $$;do $$ begin create role authenticated;exception when duplicate_object then null;end $$;create schema private;
create table public.ops_stores(id uuid primary key,name text);
create table public.ops_sales_invoices(id uuid primary key default gen_random_uuid(),store_id uuid,origin text,document_type text,invoice_kind text,purchase_order_ref text,include_in_income boolean);
