create role anon;create role authenticated;create role service_role;
create schema private;grant usage on schema private to service_role;
create function private.totus_website_matches(p_key text,p_connection uuid) returns boolean language sql security definer set search_path='' as $$select p_key='hortimatic' and p_connection='11111111-1111-4111-8111-111111111111'::uuid$$;
revoke all on function private.totus_website_matches(text,uuid) from public,anon,authenticated;
create function public.qa_copy_claim(p_key text,p_connection uuid) returns boolean language sql set search_path='' as $$select private.totus_website_matches(p_key,p_connection)$$;
revoke all on function public.qa_copy_claim(text,uuid) from public,anon,authenticated;grant execute on function public.qa_copy_claim(text,uuid) to service_role;
set role service_role;
do $$begin perform public.qa_copy_claim('hortimatic','11111111-1111-4111-8111-111111111111');raise exception 'Missing denial before repair';exception when insufficient_privilege then null;end$$;
reset role;
