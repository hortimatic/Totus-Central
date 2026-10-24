\set ON_ERROR_STOP on
insert into auth.users(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
insert into public.profiles(id,email) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
update public.team_members set full_name='Equipo de prueba' where email='qa@example.invalid';
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',false);
select public.totus_chat_command('create_channel','{"name":"Cajas de prueba","group_name":"QA","is_private":true}') as channel \gset
select (:'channel'::jsonb->>'id') as channel_id \gset
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'channel_id','client_id',gen_random_uuid(),'body','Adjunto de prueba','expected_files',1)) as message \gset
select (:'message'::jsonb->>'id') as message_id \gset
select public.totus_chat_file_begin(:'message_id',gen_random_uuid(),'original.pdf',octet_length('%PDF-1.7'),encode(extensions.digest('%PDF-1.7','sha256'),'hex'),'application/pdf') as file \gset
select (:'file'::jsonb->>'id') as file_id \gset
select set_config('request.jwt.claims','{"role":"service_role"}',false);
select public.totus_chat_file_verified(:'file_id','item-verified','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.totus_export_recovery_snapshot() as snapshot \gset
select public.qa_assert(jsonb_object_length=49,'all 49 tables exported') from (select count(*) as jsonb_object_length from jsonb_object_keys(:'snapshot'::jsonb->'database')) t;
select public.qa_assert(jsonb_array_length(:'snapshot'::jsonb->'storage'->'business-documents')=1,'chat original included in archive inventory');
select public.qa_assert((public.totus_verify_recovery_rows(:'snapshot'::jsonb->'database')->>'table_count')::integer=49,'all chat tables and foreign keys rehearse');
-- A real commit is exercised only in this disposable CI database.
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','prepared','verified-fixture-checkpoint',:'snapshot'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',:'snapshot'::jsonb->'database',:'snapshot'::jsonb) as restored \gset
select public.qa_assert(:'restored'::jsonb->>'ops_chat_files'='1','complete chat file metadata restored');
select public.qa_assert((select count(*) from public.ops_chat_messages)=1,'chat messages restored');
-- Legacy 42-table snapshots remain recoverable and explicitly contain no chat.
select jsonb_object_agg(key,value) as legacy from jsonb_each(:'snapshot'::jsonb->'database') where key not like 'ops_chat_%' \gset
select public.qa_assert((public.totus_verify_recovery_rows(:'legacy'::jsonb)->'counts'->>'ops_chat_messages')::integer=0,'legacy snapshots normalize empty chat');
select public.totus_export_recovery_snapshot() as before_legacy \gset
insert into public.ops_recovery_jobs(id,status,checkpoint_path,before_revision,requested_by,requested_email)
 values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','prepared','verified-fixture-checkpoint',:'before_legacy'::jsonb->>'revision','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','qa@example.invalid');
select public.totus_commit_recovery('cccccccc-cccc-4ccc-8ccc-cccccccccccc',:'legacy'::jsonb,jsonb_set(:'snapshot'::jsonb,'{schema_hash}','"557e56cd01a94a52e443ddd1184b3088089c1864fddeaab91bf44ae6e2a2e1fd"')) as legacy_restored \gset
select public.qa_assert(:'legacy_restored'::jsonb->>'ops_chat_messages'='0','legacy restore succeeds with empty chat');
select public.qa_assert((select count(*) from public.profiles)=1,'legacy restore preserves the administrator');
select 'CHAT RECOVERY DB QA: 49-table snapshot, private original inventory, FK rehearsal, disposable real restore and legacy 42-table recovery OK';
