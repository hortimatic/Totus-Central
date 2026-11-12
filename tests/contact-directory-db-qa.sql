\i tests/prestashop-permissions-fixture.sql
create role service_role bypassrls;
\i supabase/review_patches/071_product_permissions.sql
\i supabase/review_patches/076_contact_directory.sql
create function public.qa_directory_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is not true then raise exception 'QA: %',label;end if;end$$;
grant usage on schema public,private,auth to authenticated,service_role;
grant select on private.totus_api_connections to service_role;
grant execute on function auth.uid() to authenticated;
set role authenticated;
set qa.uid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
set qa.email='manager@example.invalid';
select public.qa_directory_assert(jsonb_array_length(public.totus_directory_context('clientes','view')->'connections')=1,'customer module permission maps to invoicing and returns only shop connections');
select public.qa_directory_assert(not(public.totus_directory_context('marcas','edit')::text like '%fictional-test-key%'),'never exposes a service key');
do $$begin
 begin perform public.totus_directory_context('atributos','view');raise exception 'QA unauthorized attributes';exception when others then if sqlerrm='QA unauthorized attributes' then raise;end if;end;
 begin perform public.totus_directory_context('administracion','view');raise exception 'QA unknown directory';exception when others then if sqlerrm='QA unknown directory' then raise;end if;end;
 begin perform public.totus_directory_operation('lookup','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','{}');raise exception 'QA browser journal access';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.totus_directory_operations;raise exception 'QA direct table access';exception when insufficient_privilege then null;end;
end$$;
set qa.uid='';
do $$begin begin perform public.totus_directory_context('clientes','view');raise exception 'QA unauthenticated';exception when others then if sqlerrm='QA unauthenticated' then raise;end if;end;end$$;
reset role;
set role service_role;
do $$declare d jsonb:=jsonb_build_object('actor_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','connection_id','11111111-1111-4111-8111-111111111111','revision',1,'signature',repeat('a',64),'resource','customers','operation','update','record_id','12');r jsonb;
begin
 perform public.qa_directory_assert(public.totus_directory_operation('lookup','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d) is null,'unclaimed lookup is empty');
 r=public.totus_directory_operation('claim','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d);
 perform public.qa_directory_assert(r->>'status'='claimed','first claim wins');
 r=public.totus_directory_operation('claim','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d);
 perform public.qa_directory_assert(r->>'status'='pending','replay cannot claim twice');
 begin perform public.totus_directory_operation('lookup','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d||'{"actor_id":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}');raise exception 'QA actor mismatch';exception when others then if sqlerrm='QA actor mismatch' then raise;end if;end;
 r=public.totus_directory_operation('uncertain','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d);
 perform public.qa_directory_assert(r->>'status'='uncertain','uncertain state is durable');
 r=public.totus_directory_operation('complete','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d);
 perform public.qa_directory_assert(r->>'status'='completed' and r->>'record_id'='12','verified completion retains ID');
 begin perform public.totus_directory_operation('uncertain','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',d);raise exception 'QA completed downgrade';exception when others then if sqlerrm='QA completed downgrade' then raise;end if;end;
end$$;
reset role;
