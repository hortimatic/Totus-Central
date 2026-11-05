begin;
do $$begin
 if not private.totus_module_can('admin@example.invalid','prestashop','delete') then raise exception 'Admin access lost';end if;
 if private.totus_module_can('manager@example.invalid','prestashop','view') then raise exception 'Unexpected default store access';end if;
 if not private.totus_module_can('staff@example.invalid','documentos','create') then raise exception 'Receipt access lost';end if;
 if private.totus_module_can('admin@example.invalid','unknown','view') then raise exception 'Unknown module allowed';end if;
 if has_function_privilege('anon','public.totus_prestashop_context()','EXECUTE') then raise exception 'Anonymous context access';end if;
end $$;
insert into public.ops_role_permissions values('gerente','prestashop',true,false,false,false,true);
select set_config('qa.uid','33333333-3333-4333-8333-333333333333',true),set_config('qa.email','manager@example.invalid',true);
do $$declare ctx jsonb;begin
 if not private.totus_module_can('manager@example.invalid','prestashop','view') then raise exception 'Role grant ignored';end if;
 if private.totus_module_can('manager@example.invalid','prestashop','edit') then raise exception 'View grant escalated';end if;
 ctx=public.totus_prestashop_context();
 if jsonb_array_length(ctx->'connections')<>1 or (ctx->'connections'->0->>'configured')::boolean is not true then raise exception 'Context filtering failed';end if;
 if ctx::text like '%fictional-test-key%' or ctx::text like '%Other private service%' then raise exception 'Context leaked private information';end if;
end $$;
insert into public.ops_user_permissions values('manager@example.invalid','prestashop',false,true,true,true,true);
do $$begin
 if private.totus_module_can('manager@example.invalid','prestashop','edit') then raise exception 'View gate bypassed';end if;
 begin perform public.totus_prestashop_context();raise exception 'Expected denial';exception when others then if sqlerrm='Expected denial' then raise;end if;end;
end $$;
delete from public.ops_user_permissions;
update public.team_members set active=false where email='manager@example.invalid';
do $$begin if private.totus_module_can('manager@example.invalid','prestashop','view') then raise exception 'Inactive user allowed';end if;end $$;
rollback;
