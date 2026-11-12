-- Disposable database; no provider access or accounting writes.
\i tests/prestashop-permissions-fixture.sql
create role service_role bypassrls;
\i supabase/review_patches/064_prestashop_permissions.sql
create table auth.users(id uuid primary key,email text);
create table public.profiles(id uuid primary key,ui_preferences jsonb);
create table public.ops_suppliers(id uuid primary key,name text);
create table public.ops_stores(id uuid primary key,name text);
create table public.ops_audit_log(user_id uuid,user_email text,area text,action text,detail jsonb);
create function private.totus_chat_write_lock() returns void language plpgsql as $$begin return;end$$;
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','manager@example.invalid');
insert into public.profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"account":{"keep":true}}');
\i supabase/review_patches/081_recurring_expenses.sql
grant usage on schema public,private,auth to authenticated;
select set_config('qa.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false),set_config('qa.email','manager@example.invalid',false);
set role authenticated;
select public.totus_recurring_expenses('save','{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","revision":0,"title":"Alquiler","amount_cents":10000,"first_on":"2026-01-31","frequency":"monthly","notice_days":7,"active":true}'::jsonb);
select public.totus_recurring_expenses('resolve','{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","revision":1,"due_on":"2026-02-28","status":"paid"}'::jsonb);
do $$declare r jsonb;denied boolean:=false;begin
 r=public.totus_recurring_expenses();if r#>>'{rows,0,history,0,status}'<>'paid' or r#>>'{rows,0,revision}'<>'2' then raise exception 'Resolution not saved';end if;
 begin perform public.totus_recurring_expenses('resolve','{"id":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","revision":1,"due_on":"2026-02-28","status":"paid"}'::jsonb);exception when others then denied=true;end;if not denied then raise exception 'Stale update accepted';end if;
 perform public.totus_recurring_expense_layout('{"columns":["title","due_on"],"widths":{"title":180},"pageSize":20}'::jsonb);
end $$;
select set_config('qa.email','custom@example.invalid',false);
do $$declare denied boolean:=false;begin begin perform public.totus_recurring_expenses();exception when others then denied=true;end;if not denied then raise exception 'Denied user could read expense commitments';end if;end $$;
reset role;
do $$begin
 if (select ui_preferences#>>'{account,keep}' from public.profiles limit 1)<>'true' then raise exception 'Layout replaced other preferences';end if;
 if (select array_agg(d) from private.totus_recurring_dates('2028-01-31',null,'monthly','2028-01-01','2028-04-30')d)<>array['2028-01-31','2028-02-29','2028-03-31','2028-04-30']::date[] then raise exception 'Calendar drift';end if;
 if has_function_privilege('anon','public.totus_recurring_expenses(text,jsonb)','execute') then raise exception 'Anonymous API access';end if;
end $$;
