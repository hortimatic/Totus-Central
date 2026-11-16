-- TPV server-only RPCs invoke the existing permission evaluator as service_role.
-- Keep browser roles excluded; this grants no user, shop or API-key permission.
begin;
grant execute on function private.totus_module_can(text,text,text) to service_role;
do $$ begin
 if has_function_privilege('anon','private.totus_module_can(text,text,text)','EXECUTE')
 or has_function_privilege('authenticated','private.totus_module_can(text,text,text)','EXECUTE')
 then raise exception 'TPV_PERMISSION_HELPER_CLIENT_EXPOSURE';end if;
end $$;
commit;
