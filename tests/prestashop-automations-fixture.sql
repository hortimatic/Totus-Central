-- Extends the isolated permission fixture. No real external requests.
create schema extensions; create extension pgcrypto with schema extensions;
create role service_role;
create function auth.role() returns text language sql stable as $$select current_setting('qa.role',true)$$;
create table auth.users(id uuid primary key,email text);
insert into auth.users values('33333333-3333-4333-8333-333333333333','admin@example.invalid');
create table public.ops_chat_channels(id uuid primary key,channel_kind text,name text,group_name text,archived boolean default false,deleted_at timestamptz);
create table public.ops_chat_members(channel_id uuid,email text);
create table public.ops_chat_messages(id uuid primary key default gen_random_uuid(),channel_id uuid,author_id uuid,author_kind text constraint ops_chat_messages_author_kind_check check(author_kind in ('human','assistant')),author_email text,client_id uuid,body text,constraint ops_chat_messages_check check(author_kind='human' and author_id is not null or author_kind='assistant' and author_id is null and author_email='chatgpt@totus.invalid'));
create table public.ops_chat_events(channel_id uuid,actor_email text,action text,entity_id uuid,detail jsonb);
insert into public.ops_chat_channels values('44444444-4444-4444-8444-444444444444','channel','Pruebas','QA',false,null);
insert into public.ops_chat_members values('44444444-4444-4444-8444-444444444444','admin@example.invalid');
create schema net; create table public.qa_jobs(body jsonb);
create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) returns bigint language plpgsql as $$begin insert into public.qa_jobs values(body);return 1;end$$;
create schema cron;create table public.qa_cron(name text,schedule text,command text);
create function cron.schedule(text,text,text) returns bigint language sql as $$insert into public.qa_cron values($1,$2,$3);select 1::bigint$$;
