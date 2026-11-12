\i tests/prestashop-permissions-fixture.sql
\i supabase/review_patches/064_prestashop_permissions.sql
\i tests/prestashop-automations-fixture.sql
\i supabase/review_patches/065_prestashop_order_alerts.sql
\i tests/general-automations-db-setup.sql
\i supabase/review_patches/066_general_automations.sql
create table public.profiles(id uuid primary key,ui_preferences jsonb);
create table public.ops_suppliers(id uuid primary key,name text);
create table public.ops_stores(id uuid primary key,name text);
create table public.ops_audit_log(user_id uuid,user_email text,area text,action text,detail jsonb);
create function private.totus_chat_write_lock() returns void language plpgsql as $$begin return;end$$;
\i supabase/review_patches/081_recurring_expenses.sql
\i supabase/review_patches/082_recurring_expense_alerts.sql
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','manager@example.invalid');
insert into public.ops_chat_members values('44444444-4444-4444-8444-444444444444','manager@example.invalid');
insert into public.ops_recurring_expenses(title,amount_cents,first_on,frequency) values('Aviso ficticio',9000,current_date,'monthly');
select set_config('qa.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false),set_config('qa.email','manager@example.invalid',false),set_config('qa.role','authenticated',false);
do $$declare r jsonb;rid uuid;job uuid;ticket text;denied boolean:=false;begin
 r=public.totus_prestashop_automations('save','{"name":"Aviso gastos QA","recipe":"expense_due","message":"","min_count":1,"period_days":30,"daily_start":"00:00","daily_end":"23:59","stores":[],"online_modules":{},"channel_id":"44444444-4444-4444-8444-444444444444","interval_hours":2,"frequency":"daily","at_time":"09:00","weekdays":[1,2,3,4,5],"enabled":true,"sharing_confirmed":true}');rid=(r->>'changed_id')::uuid;
 update private.totus_api_connections set enabled=false;update public.ops_user_permissions set can_view=false where email='manager@example.invalid' and module='prestashop';
 if not private.totus_prestashop_rule_allowed(rid) then raise exception 'Expense rule depends on PrestaShop';end if;
 update private.totus_prestashop_automations set next_run_at=now()-interval '1 minute' where id=rid;
 if private.totus_prestashop_dispatch()<>1 then raise exception 'Expense rule not dispatched';end if;
 select (body->>'job')::uuid,body->>'ticket' into job,ticket from public.qa_jobs order by ctid desc limit 1;
 perform set_config('qa.role','service_role',true);perform public.totus_prestashop_job_claim(job,ticket);
 r=public.totus_recurring_expenses_for_job(job);if jsonb_array_length(r->'rows')<>1 then raise exception 'Expense dataset unavailable';end if;
 perform public.totus_prestashop_job_deliver(job,'general','report:1:20261112090000','Gasto previsto QA');
 insert into public.ops_user_permissions(email,module,can_view) values('manager@example.invalid','gastos',false);
 begin perform public.totus_recurring_expenses_for_job(job);exception when others then denied=true;end;if not denied then raise exception 'Removed expense grant still allowed a report';end if;
 if has_function_privilege('authenticated','public.totus_recurring_expenses_for_job(uuid)','execute') then raise exception 'Service report exposed to browser';end if;
end $$;
