\set ON_ERROR_STOP on
begin;
-- Isolate the function's authorization boundary from the role matrix already tested elsewhere.
create or replace function private.totus_can(p_module text,p_action text) returns boolean language sql as $$select coalesce(nullif(current_setting('qa.table_access',true),''),'true')::boolean$$;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_products_table_layout('11111111-1111-4111-8111-111111111111','{"columns":["name","image"],"widths":{"name":210},"views":[{"name":"Mi vista","columns":["name","image"],"widths":{"name":210},"size":20,"query":"privado"}],"viewName":"Mi vista"}');
select public.qa_assert(public.totus_products_table_layout('11111111-1111-4111-8111-111111111111',null)#>>'{views,0,name}'='Mi vista','named views persist across sessions');
select public.qa_denied($q$select public.totus_products_table_layout('22222222-2222-4222-8222-222222222222',null)$q$,'otra cuenta');
select public.qa_denied($q$select public.totus_products_table_layout('11111111-1111-4111-8111-111111111111','{"columns":["name"],"widths":{"name":9999}}')$q$,'Ancho');
select public.totus_table_profiles('products','share',null,'Equipo','{"columns":["name","image"],"widths":{"name":210},"query":"not shared"}');
select public.qa_assert(not((public.totus_table_profiles('products')->0->'layout')?'query'),'shared profile excludes private filters and queries');
select set_config('qa.shared_profile_id',public.totus_table_profiles('products')->0->>'id',true);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_assert(jsonb_array_length(public.totus_table_profiles('products'))=1,'another authorized user sees shared profile');
select public.qa_assert(public.totus_products_table_layout('22222222-2222-4222-8222-222222222222',null) is null,'sharing does not replace another personal layout');
select public.qa_denied(format('select public.totus_table_profiles(''products'',''remove'',%L::uuid)',current_setting('qa.shared_profile_id')),'Solo puedes retirar');
select public.totus_orders_table_layout('22222222-2222-4222-8222-222222222222','{"columns":["id","total","margin"],"widths":{"margin":150},"views":[{"name":"Ventas","columns":["id","margin"],"widths":{}}],"pageSize":"50","density":"compact"}');
select public.qa_assert(public.totus_orders_table_layout('22222222-2222-4222-8222-222222222222',null)->>'pageSize'='50','orders layout persists');
select set_config('qa.table_access','false',true);
select public.qa_denied($q$select public.totus_table_profiles('products')$q$,'No tienes acceso');
select public.qa_denied($q$select public.totus_orders_table_layout('22222222-2222-4222-8222-222222222222',null)$q$,'otra cuenta');
reset role;
rollback;

