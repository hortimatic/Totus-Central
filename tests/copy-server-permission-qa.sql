set role service_role;
do $$begin
 if not public.qa_copy_claim('hortimatic','11111111-1111-4111-8111-111111111111') then raise exception 'Server cannot claim copy';end if;
 if public.qa_copy_claim('newoldsmok','11111111-1111-4111-8111-111111111111') then raise exception 'Cross-shop accepted';end if;
end$$;reset role;
do $$begin
 if has_function_privilege('anon','private.totus_website_matches(text,uuid)','EXECUTE') or has_function_privilege('authenticated','private.totus_website_matches(text,uuid)','EXECUTE') then raise exception 'Browser access expanded';end if;
end$$;
