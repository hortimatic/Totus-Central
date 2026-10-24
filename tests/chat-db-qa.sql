\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('create_channel','{"name":"Cajas H","group_name":"Hortimatic","is_private":true}') as created \gset
select (:'created'::jsonb->>'id') as channel \gset
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'channel','client_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','body','Total ventas 463,10 · Vape y Head')) as sent \gset
select (:'sent'::jsonb->>'id') as message \gset
select public.qa_assert(public.totus_chat_command('send',jsonb_build_object('channel_id',:'channel','client_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','body','Total ventas 463,10 · Vape y Head'))->>'id'=:'message','retry is idempotent');
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','send',jsonb_build_object('channel_id',:'channel','client_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','body','Different')),'otro mensaje');
select public.totus_chat_command('member_save',jsonb_build_object('channel_id',:'channel','email','staff@example.invalid','member_role','member'));
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','member_remove',jsonb_build_object('channel_id',:'channel','email','admin@example.invalid')),'al menos un responsable');
select public.totus_chat_command('pin',jsonb_build_object('channel_id',:'channel','message_id',:'message','pinned',true));
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'channel',null,'',null,null,'pinned')->'messages')=1,'pinned filter');
select public.totus_chat_command('task',jsonb_build_object('channel_id',:'channel','message_id',:'message','task_state','pending'));
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','task',jsonb_build_object('channel_id',:'channel','message_id',:'message','task_state','done')),'qué se ha realizado');
select public.totus_chat_command('create_channel','{"name":"Segundo","is_private":true}') as second \gset
select (:'second'::jsonb->>'id') as other_channel \gset
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','send',jsonb_build_object('channel_id',:'other_channel','parent_id',:'message','client_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','body','Cross channel')),'no pertenece');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_assert(jsonb_array_length(public.totus_chat_context()->'channels')=1,'private channels hidden');
select public.qa_assert((select count(*) from public.ops_chat_channels)=1,'direct table RLS');
select public.qa_denied(format('select public.totus_chat_context(%L::uuid)',:'other_channel'),'No tienes acceso');
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','edit',jsonb_build_object('channel_id',:'channel','message_id',:'message','body','Spoof')),'propios mensajes');
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','pin',jsonb_build_object('channel_id',:'channel','message_id',:'message','pinned',false)),'responsables');
select public.qa_denied('update public.ops_chat_channels set is_private=false','permission denied');
select public.totus_chat_command('send',jsonb_build_object('channel_id',:'channel','parent_id',:'message','client_id','cccccccc-cccc-4ccc-8ccc-cccccccccccc','body','Respuesta <script>alert(1)</script>')) as reply \gset
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'channel',null,'',null,null,'all',:'message')->'messages')=2,'thread includes root and reply');
select public.totus_chat_command('reaction',jsonb_build_object('channel_id',:'channel','message_id',:'message','emoji','👍'));
select public.qa_assert((select count(*) from public.ops_chat_reactions)=1,'reaction added');
select public.totus_chat_command('reaction',jsonb_build_object('channel_id',:'channel','message_id',:'message','emoji','👍'));
select public.qa_assert((select count(*) from public.ops_chat_reactions)=0,'reaction toggled');
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'channel',null,'Respuesta')->'messages')=1,'search finds thread replies');
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'channel',null,'',current_date+1,null)->'messages')=0,'future date filter');
select public.totus_chat_command('read',jsonb_build_object('channel_id',:'channel','seq',999999));
select public.qa_assert((select max(last_read_seq) from public.ops_chat_members where email='staff@example.invalid')=(select max(seq) from public.ops_chat_messages),'read cursor is bounded');
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333"}',true);
select public.qa_assert((select count(*) from public.ops_chat_messages)=0,'nonmember sees no messages');
select public.qa_assert((select count(*) from public.ops_chat_reactions)=0,'nonmember sees no reactions');
select public.qa_denied(format('select public.totus_chat_context(%L::uuid)',:'channel'),'No tienes acceso');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('edit',jsonb_build_object('channel_id',:'channel','message_id',:'message','body','Corregido'));
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','edit',jsonb_build_object('channel_id',:'channel','message_id',:'message','body','Stale','expected_edited_at',null)),'mensaje cambió');
select public.totus_chat_command('channel_update',jsonb_build_object('channel_id',:'channel','name','Cajas H','group_name','Hortimatic','archived',true));
select public.qa_denied(format('select public.totus_chat_command(%L,%L::jsonb)','send',jsonb_build_object('channel_id',:'channel','client_id','dddddddd-dddd-4ddd-8ddd-dddddddddddd','body','Archived')),'archivado');
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'channel')->'messages')=1,'archive remains readable');
select public.totus_chat_command('channel_delete',jsonb_build_object('channel_id',:'channel'));
select public.qa_assert((select count(*) from public.ops_chat_messages)=0,'retired channel inaccessible');
reset role;
select public.qa_assert((select count(*) from public.ops_chat_messages)=2,'retirement preserves history');
set role authenticated;
select public.totus_chat_command('create_channel','{"name":"General abierto"}') as open_channel \gset
select (:'open_channel'::jsonb->>'id') as open_id \gset
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333"}',true);
select public.qa_denied(format('select public.totus_chat_context(%L::uuid)',:'open_id'),'No tienes acceso');
select public.totus_chat_command('join',jsonb_build_object('channel_id',:'open_id'));
select set_config('qa.open_id',:'open_id',true);
do $begin for n in 1..55 loop
 perform public.totus_chat_command('send',jsonb_build_object('channel_id',current_setting('qa.open_id'),'client_id',gen_random_uuid(),'body','Paginación '||n));
end loop;end$;
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'open_id')->'messages')=51,'keyset page includes one lookahead');
select public.qa_assert(jsonb_array_length(public.totus_chat_context(:'open_id',(public.totus_chat_context(:'open_id')->'messages'->0->>'seq')::bigint)->'messages')=4,'older keyset page without overlap');
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_command('member_remove',jsonb_build_object('channel_id',:'open_id','email','other@example.invalid'));
select set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333"}',true);
select public.qa_denied(format('select public.totus_chat_context(%L::uuid)',:'open_id'),'No tienes acceso');
reset role;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
update public.team_members set active=false where email='admin@example.invalid';
set role authenticated;
select public.qa_denied('select public.totus_chat_context()','no activo');
select public.qa_assert((select count(*) from public.ops_chat_channels)=0,'suspension immediate in RLS');
reset role;
set role anon;
select public.qa_denied('select public.totus_chat_context()','permission denied');
select public.qa_denied('select * from public.ops_chat_messages','permission denied');
reset role;
rollback;
select 'CHAT DATABASE QA: identity, membership, private channels, RLS, anonymous denial, idempotency, concurrency, threads, search, dates, tasks, reactions, retirement and suspension OK';
