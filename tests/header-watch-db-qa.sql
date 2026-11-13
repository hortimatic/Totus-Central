\set ON_ERROR_STOP on
create role anon;create role authenticated;create role service_role;
create schema private;create schema auth;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('qa.uid',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select current_setting('qa.role',true)$$;
create table auth.users(id uuid primary key,email text);
create table public.team_members(email text,role text,active boolean);
create table public.profiles(id uuid primary key,ui_preferences jsonb);
create function private.is_team_member() returns boolean language sql stable as $$select exists(select 1 from auth.users u join public.team_members t on t.email=u.email and t.active where u.id=auth.uid())$$;
create function private.totus_module_can(e text,m text,a text) returns boolean language sql stable as $$select e='admin@qa.invalid' or (m='ventas' and a='view')$$;
create function private.totus_can(m text,a text) returns boolean language sql stable as $$select coalesce(current_setting('qa.deny',true),'')<>'yes' and exists(select 1 from auth.users where id=auth.uid() and private.totus_module_can(email,m,a))$$;
create function private.totus_audit(text,text,uuid,jsonb) returns void language plpgsql as $$begin return;end$$;
create function private.totus_chat_member(uuid) returns boolean language sql stable as $$select $1='11111111-1111-4111-8111-111111111111'::uuid$$;
create table public.ops_chat_channels(id uuid,name text,archived boolean default false,deleted_at timestamptz);
create table public.ops_chat_members(channel_id uuid,email text);
create table public.ops_chat_messages(id uuid primary key default gen_random_uuid(),channel_id uuid,body text,deleted_at timestamptz,author_id uuid,author_kind text,author_email text,client_id uuid);
create table public.ops_chat_events(channel_id uuid,actor_email text,action text,entity_id uuid,detail jsonb);
create table private.totus_prestashop_automations(id uuid primary key default gen_random_uuid(),owner_id uuid,name text,stores text[],recipe text default 'online_orders',enabled boolean default false,deleted_at timestamptz,channel_id uuid,offline_modules jsonb,interval_hours integer default 2,frequency text default 'interval',revision bigint default 1,starts_at timestamptz default now(),next_run_at timestamptz default now(),last_success_at timestamptz,last_error text,created_at timestamptz default now(),updated_at timestamptz default now());
create table private.totus_prestashop_deliveries(automation_id uuid,store text,order_id text,message_id uuid,created_at timestamptz default now(),primary key(automation_id,store,order_id));
create table private.totus_prestashop_jobs(id uuid primary key,automation_id uuid,revision bigint,status text,expires_at timestamptz);
create table private.totus_api_connections(protocol text,name text,enabled boolean,real_data_authorized boolean,verified_revision bigint,revision bigint);
create function private.totus_prestashop_next_run(p_id uuid,p_after timestamptz default now()) returns timestamptz language plpgsql as $$declare a private.totus_prestashop_automations;begin select * into strict a from private.totus_prestashop_automations where id=p_id;if a.frequency='interval' then return p_after+make_interval(hours=>a.interval_hours);end if;return p_after;end$$;
\i supabase/review_patches/086_header_online_orders.sql
\i supabase/review_patches/088_header_order_watch.sql
\i supabase/review_patches/088_header_order_watch.sql
create trigger totus_prestashop_pause_orphan before update on private.totus_prestashop_automations for each row execute function private.totus_prestashop_pause_orphan();
insert into auth.users values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','admin@qa.invalid'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','staff@qa.invalid');
insert into public.team_members values('admin@qa.invalid','admin',true),('staff@qa.invalid','staff',true);
insert into public.profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}');
insert into private.totus_api_connections values('prestashop','PrestaShop · Hortimatic',true,true,1,1),('prestashop','PrestaShop · NewOldSmok',true,true,1,1);
grant usage on schema auth,private to authenticated,service_role;
create function public.qa_assert(b boolean,label text) returns void language plpgsql as $$begin if b is not true then raise exception 'QA: %',label;end if;end$$;
begin;
set local role authenticated;
select set_config('qa.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true);
select public.totus_online_order_watch('{"enabled":true,"stores":["hortimatic","newoldsmok"],"offline_modules":{"hortimatic":["tpvtienda","bo_order"],"newoldsmok":["tpvtienda","bo_order"]},"interval_minutes":2}');
select public.totus_online_order_watch('{"enabled":true,"stores":["hortimatic","newoldsmok"],"offline_modules":{"hortimatic":["tpvtienda","bo_order"],"newoldsmok":["tpvtienda","bo_order"]},"interval_minutes":5}');
select set_config('qa.uid','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',true);
do $$declare blocked boolean=false;r jsonb;begin
 r=public.totus_online_order_watch();perform public.qa_assert(not(r->>'can_configure')::boolean,'Staff cannot configure shared watcher');
 begin perform public.totus_online_order_watch('{"enabled":false}');exception when others then blocked=true;end;
 perform public.qa_assert(blocked,'Staff mutation denied');
 perform public.qa_assert(not has_function_privilege('anon','public.totus_online_order_watch(jsonb)','EXECUTE'),'Anonymous watcher denied');
 perform public.qa_assert(not has_function_privilege('authenticated','public.totus_prestashop_job_deliver(uuid,text,text,text)','EXECUTE'),'Members cannot forge notices');
end$$;
reset role;
do $$declare a private.totus_prestashop_automations;begin
 select * into strict a from private.totus_prestashop_automations where delivery_mode='header';
 perform public.qa_assert(a.enabled and a.channel_id is null,'Header rule enabled without chat');
 perform public.qa_assert(private.totus_prestashop_rule_allowed(a.id),'Owner permissions without chat');
 perform public.qa_assert(private.totus_prestashop_next_run(a.id,now())=now()+interval '5 minutes','Minute scheduling');
 insert into private.totus_prestashop_jobs values('cccccccc-cccc-4ccc-8ccc-cccccccccccc',a.id,a.revision,'working',now()+interval '3 minutes');
end$$;
set local role service_role;
select set_config('qa.role','service_role',true);
select public.totus_prestashop_job_deliver('cccccccc-cccc-4ccc-8ccc-cccccccccccc','hortimatic','123','QA header order');
select public.totus_prestashop_job_deliver('cccccccc-cccc-4ccc-8ccc-cccccccccccc','hortimatic','123','QA header order');
reset role;
select public.qa_assert((select count(*)=1 from private.totus_prestashop_deliveries),'Idempotent header delivery');
select public.qa_assert((select count(*)=0 from public.ops_chat_messages),'No chat needed or written');
set local role authenticated;
do $$declare r jsonb;begin
 r=public.totus_header_online_orders();perform public.qa_assert(jsonb_array_length(r->'rows')=1 and r->'rows'->0->>'body'='QA header order','Sales user receives header notice without channel');
 perform set_config('qa.deny','yes',true);
 begin perform public.totus_header_online_orders();raise exception 'Unexpected access';exception when others then if sqlerrm='Unexpected access' then raise;end if;end;
end$$;
rollback;
