\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_save_appearance('interfaz','{"brandName":"Marca QA","primary":"#123456"}',0);
select public.qa_assert((select tax_id='FICTICIO' and irpf_prepayment_rate=20 from public.ops_business_settings),'fiscal settings preserved');
select public.qa_denied('select public.totus_save_appearance(''interfaz'',''{"fontSize":999}'',1)','rango');
select public.qa_denied('select public.totus_save_appearance(''interfaz'',''{"role":"admin"}'',1)','Campo');
select public.qa_denied('select public.totus_save_appearance(''login'',''{"customLogoData":"https://bad.invalid"}'',1)','Imagen');
select public.qa_denied('select public.totus_save_appearance(''interfaz'',''{}'',0)','cambió');
select public.totus_save_appearance('login','{"loginBrandName":"Público QA","loginBackground":"tech-soft"}',1);
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_denied('select public.totus_save_appearance(''login'',''{}'',2)','administración');
reset role;
set role anon;
select public.qa_assert((select login_appearance->>'loginBrandName'='Público QA' from public.ops_business_settings),'public login readable');
select public.qa_denied('select * from public.ops_business_settings','permission denied');
select public.qa_denied('select tax_id from public.ops_business_settings','permission denied');
select public.qa_denied('select appearance_config from public.ops_business_settings','permission denied');
select public.qa_denied('update public.ops_business_settings set tax_id=''BAD''','permission denied');
select public.qa_denied('select public.totus_save_appearance(''login'',''{}'',2)','permission denied');
reset role;
-- Old recovery rows can supply null for the optional columns.
update public.ops_business_settings set appearance_config=null,login_appearance=null,appearance_revision=null;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_save_appearance('interfaz','{}',0);
reset role;
rollback;
