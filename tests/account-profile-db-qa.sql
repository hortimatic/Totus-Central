\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"a@example.invalid"}',true);
select public.totus_save_my_account('{"job_title":"Gerencia","department":"Tienda","contact_email":"trabajo@example.invalid","notes":"Conservar nota antigua","notebook":[{"id":"11111111-1111-4111-8111-111111111111","title":"Nota de prueba","body":"Texto","category":"Trabajo","pinned":true,"archived":false,"created_at":"2026-11-12T10:00:00.000Z","updated_at":"2026-11-12T10:00:00.000Z"}]}',0);
select public.totus_save_my_account('{"display_name":"Cliente antiguo"}',1);
select public.qa_assert((select ui_preferences#>>'{account,config,job_title}'='Gerencia' and ui_preferences#>>'{account,config,notes}'='Conservar nota antigua' and jsonb_array_length(ui_preferences#>'{account,config,notebook}')=1 from public.profiles where id=auth.uid()),'old clients preserve professional fields and notebook');
do $$declare rejected boolean;begin
 rejected=false;begin perform public.totus_save_my_account('{"notebook":[{"id":"bad"}]}',2);exception when others then rejected=true;end;perform public.qa_assert(rejected,'invalid notebook rejected');
 rejected=false;begin perform public.totus_save_my_account('{"role":"admin"}',2);exception when others then rejected=true;end;perform public.qa_assert(rejected,'new profile cannot grant permissions');
 rejected=false;begin perform public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"job_title":"Otro"}',0);exception when others then rejected=true;end;perform public.qa_assert(rejected,'staff cannot edit another notebook');
end$$;
reset role;
rollback;
