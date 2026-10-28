create schema auth; create schema private;
create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
create function private.totus_can(text,text) returns boolean language sql stable as $$select coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>$2)::boolean,false)$$;
create function private.totus_business_today() returns date language sql stable set search_path='' as $$select (current_timestamp at time zone 'Europe/Madrid')::date$$;
create table public.qa_audit(area text,action text,entity uuid,detail jsonb);
create function private.totus_audit(text,text,uuid,jsonb) returns void language sql as $$insert into public.qa_audit values($1,$2,$3,$4)$$;
create table public.ops_cash_drawers(id uuid primary key,store_id uuid not null,active boolean not null default true);
create table public.ops_daily_closings(
 id uuid primary key default gen_random_uuid(),store_id uuid not null,business_date date not null,
 opening_cash numeric not null default 0,cash_sales numeric not null default 0,card_sales numeric not null default 0,
 bizum_sales numeric not null default 0,online_sales numeric not null default 0,other_income numeric not null default 0,
 cash_withdrawals numeric not null default 0,cash_expenses_declared numeric not null default 0,
 expected_cash numeric not null default 0,actual_cash numeric not null default 0,difference numeric not null default 0,
 notes text not null default '',status text not null default 'borrador',created_by uuid,closed_by uuid,
 source text,include_in_income boolean not null default true,reported_total_sales numeric,entry_mode text,
 cash_extra_in numeric not null default 0,cash_extra_out numeric not null default 0,source_ref text,
 unique(store_id,business_date));
create table public.ops_daily_closing_drawers(
 id uuid primary key default gen_random_uuid(),closing_id uuid references public.ops_daily_closings(id),drawer_id uuid references public.ops_cash_drawers(id),
 opening_cash numeric not null default 0,closing_cash numeric not null default 0,notes text not null default '',
 card_sales numeric not null default 0,bizum_sales numeric not null default 0,online_sales numeric not null default 0,
 other_income numeric not null default 0,cash_withdrawals numeric not null default 0,cash_expenses_declared numeric not null default 0,
 cash_extra_in numeric not null default 0,cash_extra_out numeric not null default 0,unique(closing_id,drawer_id));
insert into public.ops_cash_drawers values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('22222222-2222-4222-8222-222222222222','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),
 ('33333333-3333-4333-8333-333333333333','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
create function qa_assert(ok boolean,message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'QA: %',message;end if;end$$;
