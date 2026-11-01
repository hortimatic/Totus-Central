\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.totus_save_my_appearance('{"navigationMode":"compact","startModule":"equipo"}',0);
reset role;
select public.qa_assert((select ui_preferences#>>'{interface,config,startModule}'='equipo' from public.profiles where id='22222222-2222-4222-8222-222222222222'),'startup module stored on own profile');
select public.qa_assert((select ui_preferences#>>'{interface,config,navigationMode}'='compact' from public.profiles where id=auth.uid()),'compact rail stored on own profile');
set role authenticated;
select public.qa_denied('select public.totus_save_my_appearance(''{"startModule":"unknown"}'',1)','Opción');
select public.qa_denied('select public.totus_save_my_appearance(''{"navigationMode":"admin"}'',1)','Opción');
select public.qa_denied('select public.totus_save_my_appearance(''{"role":"admin"}'',1)','Campo');
select public.qa_denied('select public.totus_save_my_appearance(''{"startModule":"cajas"}'',0)','otra ventana');
reset role;
select public.qa_assert((select coalesce(ui_preferences#>>'{interface,config,startModule}','inicio')='inicio' from public.profiles where id='11111111-1111-4111-8111-111111111111'),'other account unchanged');
rollback;
