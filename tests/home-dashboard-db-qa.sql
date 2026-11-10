-- QA only. Run after fixture and migration in a disposable PostgreSQL instance.
select public.qa_assert(not has_function_privilege('anon','public.totus_home_dashboard(text,jsonb,integer)','execute'),'Anonymous user must not execute dashboard RPC');
select public.qa_assert(has_function_privilege('authenticated','public.totus_home_dashboard(text,jsonb,integer)','execute'),'Authenticated user must reach public RPC');
select public.qa_assert(not has_schema_privilege('authenticated','private','usage'),'Private schema must not need broad usage grant');

set role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"qa-one@example.invalid"}',false);
select public.qa_assert((public.totus_home_dashboard('read',null,null)->>'revision')='0','First read has revision zero');

do $qa$
declare
 layout jsonb='{"schemaVersion":1,"widgets":[{"id":"cash-h","type":"cash.openings","scope":{"store":"all"},"hidden":false,"filters":{},"layout":{"desktop":{"x":0,"y":0,"w":12,"h":3},"tablet":{"order":0},"mobile":{"order":0}}}]}';
 saved jsonb;
 checked jsonb;
begin
 saved:=public.totus_home_dashboard('save',layout,0);
 perform public.qa_assert(saved->>'revision'='1','Save increments personal revision');
 checked:=public.totus_home_dashboard('read',null,null);
 perform public.qa_assert(checked->'layout'=layout,'Read returns exact saved widgets');
 perform public.qa_assert(checked->>'revision'='1','Read confirms revision');
 perform public.qa_assert(public.qa_rejected('save',layout,0),'Stale revision must be rejected');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(layout,'{widgets,0,id}','"!!!"'),1),'Invalid widget identifier rejected');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(layout,'{widgets,0,type}','"not-a-module"'),1),'Unknown widget rejected');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(layout,'{widgets,0,layout,desktop,w}','27'),1),'Oversized widget rejected');
 perform public.qa_assert(public.qa_rejected('delete',null,null),'Unknown operations refused');
 perform public.qa_assert(public.qa_rejected(null,layout,1),'Null action must not save as an implicit operation');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(layout,'{schemaVersion}','"1"'),1),'Schema version must be a JSON number');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(layout,'{widgets,1}',layout->'widgets'->0,true),1),'Duplicate widget ID refused');
 saved:=public.totus_home_dashboard('save',jsonb_set(layout,'{settings}','{"gap":"20","width":"1600","density":"compact","background":"soft"}'),1);
 perform public.qa_assert(saved->>'revision'='2','Saving general settings increments revision');
 checked:=public.totus_home_dashboard('read',null,null);
 perform public.qa_assert(checked->'layout'->'settings'->>'gap'='20','General gap persists for this user');
 perform public.qa_assert(checked->'layout'->'settings'->>'density'='compact','Density persists for this user');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(checked->'layout','{settings,gap}','"999px"'),2),'Arbitrary gap rejected');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(checked->'layout','{settings,background}','"background:url(secret)"'),2),'Arbitrary background rejected');
 perform public.qa_assert(public.qa_rejected('save',jsonb_set(checked->'layout','{settings,unknown}','"secret-value"'),2),'Unknown settings rejected');

end$qa$;

reset role;
select public.qa_assert((ui_preferences->'interface'->>'accent')='blue','Previous interface preferences preserved') from public.profiles where email='qa-one@example.invalid';
select public.qa_assert((ui_preferences->'team_chat'->>'volume')::integer=40,'Previous chat preferences preserved') from public.profiles where email='qa-one@example.invalid';
select public.qa_assert(ui_preferences->'home_dashboard' is null,'Other user layout unchanged') from public.profiles where email='qa-two@example.invalid';

set role authenticated;
select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"qa-two@example.invalid"}',false);
select public.qa_assert((public.totus_home_dashboard('read',null,null)->>'revision')='0','Second user has isolated layout');
select public.qa_assert((public.totus_home_dashboard('read',null,null)->>'layout') is null,'Second user cannot read first layout');
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"qa-two@example.invalid"}',false);
select public.qa_assert(public.qa_rejected('read',null,null),'Mismatched signed-in email rejected');
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"qa-off@example.invalid"}',false);
select public.qa_assert(public.qa_rejected('read',null,null),'Inactive profile rejected');
select set_config('request.jwt.claims','{"sub":"","email":""}',false);
select public.qa_assert(public.qa_rejected('read',null,null),'No identity rejected');
reset role;
select 'HOME_DASHBOARD_DATABASE_QA_PASS' as result;
