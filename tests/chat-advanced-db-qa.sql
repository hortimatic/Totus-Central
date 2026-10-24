\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('create_direct','{"email":"staff@example.invalid"}') as direct \gset
select (:'direct'::jsonb->>'id') as direct_id \gset
select public.qa_assert((:'direct'::jsonb->>'channel_kind')='direct','direct channel kind');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_assert(public.totus_chat_command('create_direct','{"email":"admin@example.invalid"}')->>'id'=:'direct_id','pair is unique regardless of caller order');
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','member_save',jsonb_build_object('channel_id',:'direct_id','email','other@example.invalid','member_role','member')),'responsables');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'direct_id','client_id',gen_random_uuid(),'body','Revisar @{staff@example.invalid}')) as mention \gset
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_assert(jsonb_array_length(public.totus_chat_inbox(true))=1,'mentions inbox');
select public.totus_chat_command('member_preferences',jsonb_build_object('channel_id',:'direct_id','notify_level','none','hidden',true,'sort_order',-5));
select public.qa_assert(jsonb_array_length(public.totus_chat_inbox(false))=0,'silent channel excluded');
select public.totus_chat_command('member_preferences',jsonb_build_object('channel_id',:'direct_id','notify_level','mentions'));
select public.qa_assert(jsonb_array_length(public.totus_chat_inbox(false))=1,'preferences re-enable mentions');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','send',jsonb_build_object('channel_id',:'direct_id','client_id',gen_random_uuid(),'body','No autorizado @{other@example.invalid}')),'mención');
select public.totus_chat_command('create_assistant','{}') as assistant \gset
select (:'assistant'::jsonb->>'id') as assistant_id \gset
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'assistant_id','client_id',gen_random_uuid(),'body','Leer esta factura','expected_files',1)) as sent \gset
select (:'sent'::jsonb->>'id') as msg_id \gset
select id as request_id from public.ops_chat_agent_requests where message_id=:'msg_id' \gset
select public.qa_denied('select public.totus_chat_agent_context()','permission denied');
select public.totus_chat_file_begin(:'msg_id',gen_random_uuid(),'factura.pdf',9,repeat('a',64),'application/pdf') as reserved \gset
select (:'reserved'::jsonb->>'id') as file_id \gset
select public.qa_assert(:'reserved'::jsonb->>'storage_path' like 'chat/%','file virtual path');
select public.qa_denied(format('select public.totus_chat_file_verified(%L,%L,%L)',:'file_id','item','11111111-1111-4111-8111-111111111111'),'permission denied');
select public.qa_denied('update public.ops_chat_files set status=''ready''','permission denied');
reset role;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.qa_denied(format('select public.totus_chat_agent_context(%L,%L)',:'request_id',gen_random_uuid()),'terminen las subidas');
select public.qa_denied(format('select public.totus_chat_file_verified(%L,%L,%L)',:'file_id','item','22222222-2222-4222-8222-222222222222'),'permiso');
select public.totus_chat_file_verified(:'file_id','item-test','11111111-1111-4111-8111-111111111111');
select public.totus_chat_agent_context(:'request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') as context \gset
select public.qa_assert(:'context'::jsonb->'permissions'->>'accounting_writes'='false','agent scope is reply/propose');
select public.qa_denied(format('select public.totus_chat_agent_context(%L,%L)',:'request_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),'Otra ejecución');
select public.qa_denied(format('select public.totus_chat_agent_reply(%L,%L,%L)',:'request_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Wrong execution'),'Recoge la solicitud');
reset role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','edit',jsonb_build_object('channel_id',:'assistant_id','message_id',:'msg_id','body','Cambiar fuente')),'otro mensaje');
select public.totus_chat_file_remove(:'file_id');
reset role;
set role service_role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.qa_denied(format('select public.totus_chat_agent_reply(%L,%L,%L)',:'request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Old context'),'cambiaron');
select public.totus_chat_agent_context(:'request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
select public.totus_chat_agent_reply(:'request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Recibido. No he registrado ningún gasto.') as reply \gset
select public.qa_assert(public.totus_chat_agent_reply(:'request_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Retry')->>'already_completed'='true','assistant reply is idempotent');
reset role;
select public.qa_assert((select count(*) from auth.users)=3,'assistant has no fake login');
select public.qa_assert((select count(*) from public.ops_chat_messages where author_kind='assistant')=1,'one honest assistant identity');
reset role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'direct_id','client_id',gen_random_uuid(),'body','Two pending attachments','expected_files',2)) as removal_message \gset
select (:'removal_message'::jsonb->>'id') as removal_message_id \gset
select public.totus_chat_file_begin(:'removal_message_id',gen_random_uuid(),'first.pdf',10,repeat('a',64),'application/pdf') as removal_file \gset
select (:'removal_file'::jsonb->>'id') as removal_file_id \gset
select public.totus_chat_file_begin(:'removal_message_id',gen_random_uuid(),'second.pdf',10,repeat('b',64),'application/pdf');
select public.totus_chat_file_remove(:'removal_file_id');
select public.totus_chat_file_remove(:'removal_file_id');
select public.qa_assert((select expected_files from public.ops_chat_messages where id=:'removal_message_id')=1,'retrying removal preserves the other pending attachment');
reset role;
select public.qa_assert((select count(*) from public.ops_chat_events where entity_id=:'removal_file_id' and action='file_detached')=1,'attachment removal is audited once');
reset role;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333"}',true);
select public.qa_assert((select count(*) from public.ops_chat_agent_requests)=0,'foreign user sees no assistant requests');
select public.qa_assert((select count(*) from public.ops_chat_files)=0,'foreign user sees no private files');
reset role;
rollback;
select 'CHAT ADVANCED DB QA: private DMs, mentions, notification preferences, attachment authorization, incomplete uploads, scoped assistant, leases, stale context and idempotent replies OK';
