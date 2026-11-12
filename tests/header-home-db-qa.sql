\set ON_ERROR_STOP on
create role anon;create role authenticated;
create schema auth;create schema private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
create table public.team_members(email text,role text,active boolean);
create table public.profiles(id uuid primary key,ui_preferences jsonb);
create function private.is_team_member() returns boolean language sql stable as $$select auth.uid() is not null$$;
create function private.totus_can(text,text) returns boolean language sql stable as $$select coalesce(current_setting('qa.deny',true),'')<>'yes' and auth.uid() is not null$$;
create function private.totus_tasks_context(date,date) returns jsonb language sql as $$select jsonb_build_object('actor',case when auth.uid()='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' then 'admin@qa.invalid' else 'staff@qa.invalid' end,'rows','[{"assigned_email":"admin@qa.invalid","title":"Admin"},{"assigned_email":"staff@qa.invalid","title":"Staff"},{"assigned_email":"other@qa.invalid","title":"Other"}]'::jsonb,'people','[{"email":"admin@qa.invalid","name":"Admin"},{"email":"staff@qa.invalid","name":"Staff"},{"email":"other@qa.invalid","name":"Other"}]'::jsonb,'archived_tasks','[1]'::jsonb,'deleted_tasks','[1]'::jsonb)$$;
create function public.totus_record_activity(p_area text,p_action text,p_reference text default null,p_expected_actor text default null,p_event uuid default null) returns void language plpgsql as $$begin if p_area not in ('clientes','proveedores','marcas') then raise exception 'area';end if;end$$;
create table private.totus_prestashop_automations(id uuid,recipe text,enabled boolean,deleted_at timestamptz,channel_id uuid);
create table private.totus_prestashop_deliveries(automation_id uuid,store text,order_id text,message_id uuid,created_at timestamptz);
create table public.ops_chat_messages(id uuid,channel_id uuid,body text,deleted_at timestamptz);
create function private.totus_chat_member(uuid) returns boolean language sql stable as $$select $1='11111111-1111-4111-8111-111111111111'::uuid$$;
\i supabase/review_patches/084_home_tasks_activity.sql
\i supabase/review_patches/086_header_online_orders.sql
\i supabase/review_patches/084_home_tasks_activity.sql
\i supabase/review_patches/086_header_online_orders.sql
insert into public.team_members values('admin@qa.invalid','admin',true),('staff@qa.invalid','staff',true);
insert into public.profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{"account":{"keep":true}}'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}');
insert into private.totus_prestashop_automations values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','online_orders',true,null,'11111111-1111-4111-8111-111111111111'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','sales_summary',true,null,'11111111-1111-4111-8111-111111111111');
insert into public.ops_chat_messages values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','11111111-1111-4111-8111-111111111111','QA online',null),('ffffffff-ffff-4fff-8fff-ffffffffffff','22222222-2222-4222-8222-222222222222','Private',null);
insert into private.totus_prestashop_deliveries values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','hortimatic','1','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now()),('cccccccc-cccc-4ccc-8ccc-cccccccccccc','newoldsmok','2','ffffffff-ffff-4fff-8fff-ffffffffffff',now()),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','hortimatic','3','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now());
create function public.qa_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'QA: %',label;end if;end$$;
grant usage on schema auth,private to authenticated;
grant select on public.team_members,public.profiles to authenticated;
begin;
set local role authenticated;
select set_config('qa.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
do $$declare r jsonb;begin
 r=public.totus_home_tasks_context(current_date,current_date);
 perform public.qa_assert(jsonb_array_length(r->'rows')=3 and (r->>'can_select_users')::boolean,'Admin puede seleccionar equipo');
 perform public.qa_assert(not(r?'archived_tasks') and not(r?'deleted_tasks'),'Inicio no recibe inventarios de gestión');
 r=public.totus_header_online_orders();
 perform public.qa_assert(jsonb_array_length(r->'rows')=1 and (r->'rows'->0->>'order_id')='1','Solo avisos online del canal autorizado');
 r=public.totus_header_online_orders('save','{"enabled":true,"stores":["hortimatic"],"seen":["hortimatic:1"]}');
 perform public.qa_assert(r->'config'->'seen'='["hortimatic:1"]','Leídos persistentes por usuario');
 perform public.qa_assert((select ui_preferences->'account'='{"keep":true}'::jsonb from public.profiles where id=auth.uid()),'Conservar otros ajustes');
end$$;
select set_config('qa.uid','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$declare r jsonb;blocked boolean=false;begin
 r=public.totus_home_tasks_context(current_date,current_date);
 perform public.qa_assert(jsonb_array_length(r->'rows')=1 and r->'rows'->0->>'title'='Staff' and not (r->>'can_select_users')::boolean,'Usuario normal solo sus tareas');
 perform public.qa_assert(jsonb_array_length(r->'people')=1,'No selector de compañeros');
 r=public.totus_header_online_orders();perform public.qa_assert(r->'config'->'seen'='[]','No trasladar leídos entre usuarios');
 perform set_config('qa.deny','yes',true);
 begin perform public.totus_header_online_orders();exception when others then blocked=true;end;
 perform public.qa_assert(blocked,'Sin permiso Ventas no hay datos');
 blocked=false;begin perform public.totus_home_tasks_context(current_date,current_date);exception when others then blocked=true;end;
 perform public.qa_assert(blocked,'Sin permiso Tareas no hay calendario');
 perform public.qa_assert(not has_function_privilege('anon','public.totus_header_online_orders(text,jsonb)','EXECUTE'),'Sin acceso anónimo');
end$$;
rollback;
