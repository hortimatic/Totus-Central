\set ON_ERROR_STOP on
begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"a@example.invalid"}',true);
select public.totus_save_my_account('{"notes":"QA own notes","display_name":"Cuenta A"}',0);
select public.qa_assert((select ui_preferences#>>'{account,config,notes}'='QA own notes' from public.profiles where id=auth.uid()),'Own notes persisted');
select public.qa_assert((select count(*)=0 from public.profiles where email='b@example.invalid'),'Staff cannot read another profile or its notes');
-- An old browser that sends only name/phone/photo must preserve notes.
select public.totus_save_my_account('{"display_name":"Cuenta A actualizada","phone":"123","photo":""}',1);
select public.qa_assert((select ui_preferences#>>'{account,config,notes}'='QA own notes' from public.profiles where id=auth.uid()),'Legacy profile update preserves notes');
do $$declare denied boolean;begin
 denied:=false;begin perform public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',0);exception when others then denied:=sqlerrm like '%administración%';end;perform public.qa_assert(denied,'Admin endpoint denies staff');
 denied:=false;begin perform private.totus_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',0);exception when others then denied:=sqlerrm like '%administración%';end;perform public.qa_assert(denied,'Core writer also denies foreign target');
 denied:=false;begin perform public.totus_save_my_account(jsonb_build_object('notes',repeat('x',10001)),2);exception when others then denied:=sqlerrm like '%notas%';end;perform public.qa_assert(denied,'Oversized notes rejected');
 denied:=false;begin perform public.totus_save_my_account('{"role":"admin"}',2);exception when others then denied:=sqlerrm like '%no permitido%';end;perform public.qa_assert(denied,'Notes cannot change authorization');
end$$;
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"admin@example.invalid"}',true);
select public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"display_name":"Perfil B","phone":"456","photo":"data:image/png;base64,AAAA","notes":"QA target notes"}',0);
do $$declare denied boolean:=false;begin
 begin perform public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"notes":"stale"}',0);exception when others then denied:=sqlerrm like '%cambió%';end;perform public.qa_assert(denied,'Administrative edits retain optimistic revision');
 denied:=false;begin perform public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"photo":"data:image/svg+xml;base64,AAAA"}',1);exception when others then denied:=sqlerrm like '%foto%';end;perform public.qa_assert(denied,'Administrative image validation is identical');
end$$;
reset role;
select public.qa_assert((select ui_preferences#>>'{account,config,notes}'='QA target notes' and role='empleado' from public.profiles where email='b@example.invalid'),'Target data saved without changing role');
select public.qa_assert((select ui_preferences#>>'{account,config,notes}'='QA own notes' and ui_preferences#>>'{interface,config,primary}'='#123456' from public.profiles where email='a@example.invalid'),'Other account and appearance unchanged');
select public.qa_assert((select count(*)=1 from public.ops_audit_log where action='perfil_usuario_guardado' and user_id='cccccccc-cccc-4ccc-8ccc-cccccccccccc' and detail->>'target_user_id'='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'Admin audit identifies caller and target');
select public.qa_assert((select count(*)=0 from public.ops_audit_log where detail::text like '%QA target notes%' or detail::text like '%data:image%'),'Audit excludes note content and photo bytes');
select public.qa_assert(not has_function_privilege('anon','public.totus_admin_save_account(uuid,jsonb,bigint)','execute'),'No anonymous administrative endpoint');
update public.team_members set active=false where email='admin@example.invalid';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"admin@example.invalid"}',true);
do $$declare denied boolean:=false;begin begin perform public.totus_admin_save_account('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{}',1);exception when others then denied:=sqlerrm like '%administración%' or sqlerrm like '%activo%';end;perform public.qa_assert(denied,'Inactive administration denied');end$$;
reset role;
rollback;
