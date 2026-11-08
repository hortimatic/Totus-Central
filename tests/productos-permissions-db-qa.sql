begin;
do $$ begin
 if private.totus_module_can('manager@example.invalid','productos','view') then raise exception 'Products default widened';end if;
 if not private.totus_module_can('admin@example.invalid','productos','edit') then raise exception 'Admin lost Products';end if;
end $$;
insert into public.ops_user_permissions(email,module,can_view,can_create,can_edit,can_delete,can_export)
values('manager@example.invalid','productos',true,false,true,false,false);
select set_config('qa.uid','33333333-3333-4333-8333-333333333333',true),set_config('qa.email','manager@example.invalid',true);
do $$ declare result jsonb;begin
 result:=public.totus_products_context('edit');
 if jsonb_array_length(result->'connections')<>1 or result::text like '%fictional-test-key%' or result::text like '%Other private service%' then raise exception 'Connection scope leaked';end if;
 begin perform public.totus_products_context('create');raise exception 'Create unexpectedly allowed';exception when raise_exception then if sqlerrm='Create unexpectedly allowed' then raise;end if;end;
 begin perform public.totus_products_context('delete');raise exception 'Delete unexpectedly allowed';exception when raise_exception then if sqlerrm='Delete unexpectedly allowed' then raise;end if;end;
end $$;
rollback;
