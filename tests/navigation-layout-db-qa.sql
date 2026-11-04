\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.totus_save_my_appearance('{"navigationOrder":"gastos,cajas,prestashop","navigationCollapsed":"operations,analysis","navigationBackground":"#102030","navigationText":"#ffffff","navigationSectionText":"#aabbcc","navigationActive":"#00aacc","startModule":"prestashop"}',0);
select public.qa_denied('select public.totus_save_my_appearance(''{"navigationBackground":"url(x)"}'',1)','Color');
select public.qa_denied('select public.totus_save_my_appearance(''{"role":"admin"}'',1)','Campo');
select public.qa_denied('select public.totus_save_my_appearance(''{"startModule":"prestashop"}'',0)','otra ventana');
reset role;
select public.qa_assert((select ui_preferences#>>'{interface,config,navigationOrder}'='gastos,cajas,prestashop' from public.profiles where id='22222222-2222-4222-8222-222222222222'),'own layout stored');
select public.qa_assert((select coalesce(ui_preferences#>>'{interface,config,navigationCollapsed}','')='' from public.profiles where id='11111111-1111-4111-8111-111111111111'),'other account unchanged');
rollback;
