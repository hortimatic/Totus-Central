\set ON_ERROR_STOP on
begin;
set role authenticated;
select set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111"}',true);
select public.totus_chat_save_layout('{"sound_volume":85,"sound_style":"digital","chat_background":"color","chat_background_color":"#abcdef"}');
select public.qa_assert(public.totus_chat_context()->'layout'->>'sound_volume'='85','personal volume persists');
select public.totus_chat_save_layout('{"chat_background":"image","chat_background_image":"data:image/png;base64,AAAA","sound_volume":35}');
select public.qa_assert(not ((public.totus_chat_notification_context()->'layout')?'chat_background_image'),'polling excludes image');
select public.totus_chat_personalized_context('{}','') as personal \gset
select public.qa_assert(:'personal'::jsonb#>>'{layout,chat_background_image}'='data:image/png;base64,AAAA','first response carries own image');
select public.qa_assert(not ((public.totus_chat_personalized_context('{}',:'personal'::jsonb->>'background_hash')->'layout')?'chat_background_image'),'same hash skips repeated bytes');
select public.qa_denied('select public.totus_chat_save_layout(''{"sound_volume":101}'')','Volumen');
select public.qa_denied('select public.totus_chat_save_layout(''{"sound_style":"bad"}'')','Sonido');
select public.qa_denied('select public.totus_chat_save_layout(''{"chat_background_image":"https://evil.invalid"}'')','Imagen');
select public.qa_denied('select public.totus_chat_save_layout(''{"chat_background":"image"}'')','imagen');
select public.totus_chat_command('create_channel','{"name":"Buzz QA","is_private":true}') as channel_json \gset
select (:'channel_json'::jsonb->>'id') as channel_id \gset
select public.totus_chat_buzz(:'channel_id','bbbbbbbb-1234-4567-8000-123456789012') as sent \gset
select public.qa_assert(public.totus_chat_buzz(:'channel_id','bbbbbbbb-1234-4567-8000-123456789012')->>'id'=(:'sent'::jsonb->>'id'),'same retry returns same message');
select public.qa_denied(format('select public.totus_chat_buzz(%L,%L)',:'channel_id','cccccccc-1234-4567-8000-123456789012'),'30 segundos');
select set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222"}',true);
select public.qa_denied(format('select public.totus_chat_buzz(%L,%L)',:'channel_id','dddddddd-1234-4567-8000-123456789012'),'permiso');
select public.qa_assert(public.totus_chat_context()->'layout'='{}'::jsonb,'personal settings remain private');
reset role;
set role anon;
select public.qa_denied(format('select public.totus_chat_buzz(%L,%L)',:'channel_id','eeeeeeee-1234-4567-8000-123456789012'),'permission denied');
reset role;
rollback;
