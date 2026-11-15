\set ON_ERROR_STOP on
begin;
update public.profiles set ui_preferences=jsonb_build_object('interface_styles',jsonb_build_object('revision',4,'items',jsonb_build_array(jsonb_build_object('id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','name','Estilo equipo QA','config',jsonb_build_object('primary','#112233','fontSize',14,'brandName','Nombre privado','customLogoData','imagen privada','navigationOrder',jsonb_build_array('gastos'),'startModule','gastos'))))) where id='22222222-2222-4222-8222-222222222222';
set role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333"}',true);
select public.qa_assert(jsonb_array_length(public.totus_shared_interface_styles()->'items')>=1,'Other users can choose a shared style');
select public.qa_assert(exists(select 1 from jsonb_array_elements(public.totus_shared_interface_styles()->'items') s where s->>'name'='Estilo equipo QA' and s#>>'{config,primary}'='#112233' and not (s->'config' ?| array['brandName','customLogoData','navigationOrder','startModule']) and s->>'mine'='false'),'Shared style excludes private identity, images and navigation');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_assert(not exists(select 1 from jsonb_array_elements(public.totus_shared_interface_styles()->'items') s where s->>'name'='Estilo equipo QA'),'Own private library is not duplicated');
reset role;
select public.qa_assert((select ui_preferences#>>'{interface_styles,revision}' from public.profiles where id='22222222-2222-4222-8222-222222222222')='4','Reading never changes the author library');
set role anon;
select public.qa_denied('select public.totus_shared_interface_styles()','permission denied');
reset role;
rollback;
