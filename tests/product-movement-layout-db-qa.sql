set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';set test.allow_products='yes';
select public.totus_product_movements_layout('{"columns":["date","quantity","id"],"widths":{"date":180},"size":"50"}');
do $$begin
 if public.totus_product_movements_layout(null)->>'size'<>'50' then raise exception 'Layout not recovered';end if;
 begin perform public.totus_product_movements_layout('{"columns":["id","id"],"widths":{},"size":"20"}');raise exception 'Duplicate accepted';exception when raise_exception then if sqlerrm='Duplicate accepted' then raise;end if;end;
 begin perform public.totus_product_movements_layout('{"columns":["id"],"widths":{"id":1},"size":"20"}');raise exception 'Invalid width accepted';exception when raise_exception then if sqlerrm='Invalid width accepted' then raise;end if;end;
end$$;
set test.allow_products='no';
do $$begin begin perform public.totus_product_movements_layout(null);raise exception 'Denied role accepted';exception when raise_exception then if sqlerrm='Denied role accepted' then raise;end if;end;end$$;
reset role;
do $$begin
 if (select ui_preferences->'products_table' from public.profiles where id='11111111-1111-4111-8111-111111111111')<>'{"keep":true}'::jsonb then raise exception 'Existing preferences changed';end if;
 if (select ui_preferences from public.profiles where id='22222222-2222-4222-8222-222222222222')<>'{"private":"untouched"}'::jsonb then raise exception 'Other user changed';end if;
 if has_function_privilege('anon','public.totus_product_movements_layout(jsonb)','execute') then raise exception 'Anonymous access';end if;
end$$;
