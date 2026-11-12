begin;
do $$begin
 if not private.totus_module_can('admin@example.invalid','ventas','view') then raise exception 'Admin sales access lost';end if;
 if private.totus_module_can('staff@example.invalid','ventas','view') then raise exception 'Sales access granted implicitly';end if;
 if not private.totus_module_can('staff@example.invalid','documentos','create') then raise exception 'Existing permissions changed';end if;
 if has_function_privilege('anon','public.totus_sales_context()','execute') then raise exception 'Anonymous sales access';end if;
end $$;
insert into public.ops_user_permissions(email,module,can_view) values('staff@example.invalid','ventas',true);
select set_config('qa.uid','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true),set_config('qa.email','staff@example.invalid',true);
set local role authenticated;
do $$declare c jsonb;begin c:=public.totus_sales_context();if jsonb_array_length(c->'connections')<>1 or c::text like '%fictional-test-key%' then raise exception 'Wrong context or secret exposed';end if;end $$;
rollback;
