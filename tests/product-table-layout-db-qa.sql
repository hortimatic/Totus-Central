-- Disposable fixture only.
reset role;
create table if not exists public.profiles(id uuid primary key,ui_preferences jsonb);
insert into public.profiles values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','{"interface":{"config":{"primary":"#abcdef"}}}'),('dddddddd-dddd-4ddd-8ddd-dddddddddddd','{}') on conflict(id) do nothing;
\ir ../supabase/review_patches/074_product_table_layout.sql
\ir ../supabase/review_patches/074_product_table_layout.sql
set role authenticated;
select set_config('test.actor','cccccccc-cccc-4ccc-8ccc-cccccccccccc',false);
select set_config('test.allowed','yes',false);
do $$declare own uuid:='cccccccc-cccc-4ccc-8ccc-cccccccccccc';r jsonb;begin
 r=public.totus_products_table_layout(own,'{"columns":["name","image","marginTotal"],"widths":{"name":310,"image":90,"marginTotal":130}}');if r is distinct from public.totus_products_table_layout(own,null) then raise exception 'Layout not retained';end if;
 begin perform public.totus_products_table_layout('dddddddd-dddd-4ddd-8ddd-dddddddddddd',r);raise exception 'Another account accepted';exception when others then if sqlerrm='Another account accepted' then raise;end if;end;
 begin perform public.totus_products_table_layout(own,'{"columns":["name","bogus"],"widths":{}}');raise exception 'Unknown column accepted';exception when others then if sqlerrm='Unknown column accepted' then raise;end if;end;
 begin perform public.totus_products_table_layout(own,'{"columns":["name"],"widths":{"name":999999}}');raise exception 'Invalid width accepted';exception when others then if sqlerrm='Invalid width accepted' then raise;end if;end;
 begin perform public.totus_products_table_layout(own,'{"columns":["name","name"],"widths":{}}');raise exception 'Duplicate accepted';exception when others then if sqlerrm='Duplicate accepted' then raise;end if;end;
end$$;
reset role;
do $$begin if (select ui_preferences->'interface'->'config'->>'primary' from public.profiles where id='cccccccc-cccc-4ccc-8ccc-cccccccccccc')<>'#abcdef' then raise exception 'Other settings changed';end if;if (select ui_preferences from public.profiles where id='dddddddd-dddd-4ddd-8ddd-dddddddddddd')<>'{}' then raise exception 'Another profile changed';end if;if has_function_privilege('anon','public.totus_products_table_layout(uuid,jsonb)','execute') then raise exception 'Anonymous grant';end if;end$$;
select set_config('test.allowed','no',false);
do $$begin begin perform public.totus_products_table_layout('cccccccc-cccc-4ccc-8ccc-cccccccccccc',null);raise exception 'Denied user accepted';exception when others then if sqlerrm='Denied user accepted' then raise;end if;end;end$$;
