-- Disposable fixture only, after the journal tests.
reset role;
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key,email text);
create table if not exists public.team_members(email text primary key,full_name text);
create or replace function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
create or replace function private.totus_can(text,text) returns boolean language sql stable as $$select current_setting('test.allowed',true)='yes'$$;
insert into auth.users values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','qa@example.invalid') on conflict(id) do nothing;
insert into public.team_members values('qa@example.invalid','ChatGPT QA') on conflict(email) do nothing;
\ir ../supabase/review_patches/072_product_creation_metadata.sql
set role authenticated;
select set_config('test.actor','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
select set_config('test.allowed','yes',false);
do $$declare r jsonb;begin
 r=public.totus_products_creation_metadata('hortimatic',array['999999999999']);if r<>'[]'::jsonb then raise exception 'Invented creator';end if;
 begin perform public.totus_products_creation_metadata('otro',array['1']);raise exception 'Invalid shop accepted';exception when others then if sqlerrm='Invalid shop accepted' then raise;end if;end;
end$$;
reset role;
do $$declare p text;r jsonb;begin
 select product_id::text into p from private.totus_prestashop_product_create_requests where status='completed' and store='hortimatic' and actor_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' limit 1;
 if p is null then raise exception 'Completed fixture missing';end if;
 r=public.totus_products_creation_metadata('hortimatic',array[p]);if r->0->>'creator'<>'ChatGPT QA' then raise exception 'Wrong creator %',r;end if;
 if r->0->>'registered_at' is null then raise exception 'Missing timestamp';end if;
end$$;
select set_config('test.allowed','no',false);
do $$begin begin perform public.totus_products_creation_metadata('hortimatic',array['1']);raise exception 'Denied role accepted';exception when others then if sqlerrm='Denied role accepted' then raise;end if;end;end$$;
select set_config('test.actor','',false);
select set_config('test.allowed','yes',false);
do $$begin begin perform public.totus_products_creation_metadata('hortimatic',array['1']);raise exception 'Anonymous accepted';exception when others then if sqlerrm='Anonymous accepted' then raise;end if;end;end$$;
