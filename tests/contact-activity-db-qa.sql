\set ON_ERROR_STOP on
\ir ../supabase/review_patches/043_contact_activity.sql
\ir ../supabase/review_patches/043_contact_activity.sql
begin;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
set local role authenticated;
select public.totus_record_activity('clientes','abrir_modulo');
select public.totus_record_activity('proveedores','abrir_modulo');
select public.totus_record_activity('marcas','abrir_modulo');
select public.qa_denied('select public.totus_record_activity(''inventado'',''abrir_modulo'')','no válida');
reset role;
insert into public.ops_user_permissions values('staff@example.invalid','pricing',false,false,false,false,false) on conflict(email,module) do update set can_view=false;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
set local role authenticated;
select public.qa_denied('select public.totus_record_activity(''marcas'',''abrir_modulo'')','Sin acceso');
select public.qa_denied('select public.totus_record_activity(''clientes'',''abrir_modulo'',null,''admin@example.invalid'')','sesión');
rollback;
select 'CONTACT ACTIVITY QA OK';
