select id as checked_id,revision as checked_revision from private.totus_api_connections where name='IA propia' \gset
select gen_random_uuid() as check_id \gset
select public.totus_api_call(:'checked_id',:'checked_revision',:'check_id');
select public.totus_api_call(:'checked_id',:'checked_revision',:'check_id','{"ok":false,"verification_failed":true}');
select public.qa_assert((select not enabled and verified_revision is null from private.totus_api_connections where id=:'checked_id'),'failed probe cannot remain green or active');
select public.qa_assert((select not enabled and verified_revision is null from private.totus_ai_config where id),'selected failed provider is disabled');
select public.qa_assert((select count(*)=0 from ops_expenses) and (select count(*)=0 from ops_daily_closings),'failure does not alter accounting');
select gen_random_uuid() as new_check \gset
select public.totus_api_call(:'checked_id',:'checked_revision',:'new_check');
select public.totus_api_call(:'checked_id',:'checked_revision',:'new_check','{"ok":true}');
select public.qa_assert((select not enabled and verified_revision=revision from private.totus_api_connections where id=:'checked_id'),'successful recheck needs explicit activation');
select 'API VERIFICATION FAILURE QA OK';
