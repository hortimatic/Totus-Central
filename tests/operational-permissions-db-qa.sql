-- Disposable only; the production patch does not create these tables.
create table public.ops_roles(code text primary key);
insert into public.ops_roles values('admin'),('gerente'),('encargado'),('personalizado');
create table public.ops_role_permissions(role text references public.ops_roles(code),module text check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion')),can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_export boolean,primary key(role,module));
create table public.ops_user_permissions(email text references public.team_members(email),module text check(module in ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion')),can_view boolean,can_create boolean,can_edit boolean,can_delete boolean,can_export boolean,primary key(email,module));
create table public.ops_audit_log(id bigint generated always as identity primary key,created_at timestamptz not null default now(),user_id uuid references public.profiles(id),user_email text not null default '',area text not null,action text not null,entity_id uuid,detail jsonb not null default '{}'::jsonb);
create table public.ops_backup_config(id integer primary key,enabled boolean,updated_at timestamptz default now());
insert into public.ops_backup_config(id,enabled) values(1,false);
create function private.totus_recovery_tables() returns text[] language sql stable as $$select array['profiles','ops_role_permissions','ops_user_permissions']::text[]$$;
\ir ../supabase/migrations/20261024182743_preserve_recovery_hash_for_report_preferences.sql
select set_config('qa.recovery_hash_before',private.totus_recovery_schema_hash(),false);
\ir ../supabase/review_patches/011_operational_permissions_activity.sql
\ir ../supabase/review_patches/012_preserve_backup_permission_catalog_compatibility.sql
\ir ../supabase/review_patches/013_activity_numeric_identity.sql
select public.qa_assert(private.totus_recovery_schema_hash()=current_setting('qa.recovery_hash_before'),'Widened module catalogue preserves compatibility with existing backups');
begin;
alter table public.profiles add constraint qa_unrelated_structure check(id<>'00000000-0000-0000-0000-000000000000'::uuid);
select public.qa_assert(private.totus_recovery_schema_hash()<>current_setting('qa.recovery_hash_before'),'Other structural constraints must still invalidate incompatible backups');
rollback;
begin;
insert into public.ops_role_permissions values('encargado','equipo',false,false,false,false,false);
set role authenticated;
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',true);
select public.qa_denied('select public.totus_chat_context()','Usuario de equipo');
select public.qa_assert(public.totus_tasks_context('2026-10-01','2026-10-31') is not null,'Tasks independent from disabled Chat');
reset role;
insert into public.ops_user_permissions values('staff@example.invalid','equipo',true,false,false,false,false);
set role authenticated;
select public.qa_assert(public.totus_chat_context() is not null,'User override restores read');
select public.qa_denied('select public.totus_chat_command(''create_channel'',''{"name":"Denied"}''::jsonb)','No tienes permiso');
select public.qa_denied('select public.totus_chat_file_begin(null,null,''qa.txt'',1,repeat(''0'',64),''text/plain'')','No tienes permiso');
reset role;
insert into public.ops_user_permissions values('staff@example.invalid','tareas',true,false,false,false,false);
set role authenticated;
select public.qa_denied('select public.totus_task_command(''save'',''{}''::jsonb)','No tienes permiso');
select public.totus_record_activity('tareas','abrir_modulo',null,'staff@example.invalid','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select public.totus_record_activity('tareas','abrir_modulo',null,'staff@example.invalid','cccccccc-cccc-4ccc-8ccc-cccccccccccc');
select public.qa_denied('select public.totus_record_activity(''tareas'',''abrir_modulo'',null,''admin@example.invalid'')','sesión');
select public.qa_denied('select public.totus_record_activity(''tareas'',''inventado'')','no válida');
select public.qa_denied('select private.totus_module_can(''admin@example.invalid'',''tareas'',''view'')','permission denied');
reset role;
select public.qa_assert((select count(*) from public.ops_audit_log where detail->>'evento'='cccccccc-cccc-4ccc-8ccc-cccccccccccc')=1,'Audit retry cannot duplicate');
select public.qa_assert((select user_email from public.ops_audit_log where detail->>'evento'='cccccccc-cccc-4ccc-8ccc-cccccccccccc')='staff@example.invalid','Actor comes from verified auth');
update public.ops_user_permissions set can_view=false where email='staff@example.invalid' and module='tareas';
set role authenticated;
select public.qa_denied('select public.totus_tasks_context(''2026-10-01'',''2026-10-31'')','Usuario de equipo');
reset role;
update public.ops_backup_config set enabled=true where id=1;
select public.qa_assert(exists(select 1 from public.ops_audit_log where detail->>'tabla'='ops_backup_config' and detail->'campos' ? 'enabled'),'Backup settings audited by the server');
update public.profiles set ui_preferences='{"qa":true}'::jsonb where id='22222222-2222-4222-8222-222222222222';
select public.qa_assert(exists(select 1 from public.ops_audit_log where detail->>'tabla'='profiles' and detail->'campos' ? 'ui_preferences'),'Preferences audited without raw values');
rollback;
