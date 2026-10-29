SELECT qa_assert(NOT has_function_privilege('anon','public.totus_log_cleanup(date,date,boolean,text)','execute'),'anonymous API access forbidden');
SELECT qa_assert(NOT has_table_privilege('authenticated','public.ops_audit_log','delete'),'no direct event deletion grant');
DO $$BEGIN
 BEGIN PERFORM public.totus_log_cleanup(NULL,'2020-03-29');RAISE EXCEPTION 'QA expected denial';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Solo administración%' THEN RAISE;END IF;END;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"staff"}',false);
DO $$BEGIN
 BEGIN PERFORM public.totus_log_cleanup(NULL,'2020-03-29');RAISE EXCEPTION 'QA expected staff denial';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Solo administración%' THEN RAISE;END IF;END;
END$$;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","email":"qa@example.invalid","role":"admin"}',false);
INSERT INTO public.ops_audit_log(created_at,action) VALUES('2020-03-28T22:59:59Z','old'),('2020-03-28T23:00:00Z','start'),('2020-03-29T21:59:59Z','end'),('2020-03-29T22:00:00Z','next'),('2020-03-28T23:00:00Z','limpiar_historial');
INSERT INTO public.team_user_audit_log(created_at,action) VALUES('2020-03-29T12:00:00Z','user');
INSERT INTO public.ops_chat_events(created_at,action) VALUES('2020-03-29T12:00:00Z','chat');
INSERT INTO public.ops_task_events(created_at,action) VALUES('2020-03-29T12:00:00Z','task');
SET ROLE authenticated;
DO $$DECLARE p jsonb;r jsonb;BEGIN
 BEGIN PERFORM public.totus_log_cleanup('2020-04-01','2020-03-29');RAISE EXCEPTION 'QA invalid range accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Indica un rango%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.totus_log_cleanup(NULL,current_date+2);RAISE EXCEPTION 'QA future accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Indica un rango%' THEN RAISE;END IF;END;
 BEGIN PERFORM public.totus_log_cleanup(NULL,'2020-03-29',true);RAISE EXCEPTION 'QA missing preview accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Consulta primero%' THEN RAISE;END IF;END;
 p:=public.totus_log_cleanup('2020-03-29','2020-03-29');
 PERFORM public.qa_assert((p->>'count')::integer=5,'Madrid DST date includes exactly five events');
 BEGIN PERFORM public.totus_log_cleanup('2020-03-29','2020-03-29',true,repeat('0',32));RAISE EXCEPTION 'QA stale signature accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'El historial ha cambiado%' THEN RAISE;END IF;END;
 r:=public.totus_log_cleanup('2020-03-29','2020-03-29',true,p->>'fingerprint');
 PERFORM public.qa_assert((r->>'deleted')::integer=5,'all four event sources cleaned together');
END$$;
RESET ROLE;
SELECT qa_assert((SELECT count(*)=4 FROM public.ops_audit_log),'only selected dates removed and cleanup markers retained');
SELECT qa_assert((SELECT count(*)=0 FROM public.team_user_audit_log),'user events removed');
SELECT qa_assert((SELECT count(*)=0 FROM public.ops_chat_events),'chat events removed, not messages');
SELECT qa_assert((SELECT count(*)=0 FROM public.ops_task_events),'task events removed, not tasks');
DO $$DECLARE p jsonb;BEGIN
 p:=public.totus_log_cleanup(NULL,'2021-01-01');
 INSERT INTO public.ops_audit_log(created_at,action) VALUES('2020-03-29T10:00:00Z','concurrent');
 BEGIN PERFORM public.totus_log_cleanup(NULL,'2021-01-01',true,p->>'fingerprint');RAISE EXCEPTION 'QA changed history accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'El historial ha cambiado%' THEN RAISE;END IF;END;
 PERFORM public.qa_assert((SELECT count(*)=5 FROM public.ops_audit_log),'changed preview cannot partially delete');
 p:=public.totus_log_cleanup(NULL,'2021-01-01');
 PERFORM public.totus_log_cleanup(NULL,'2021-01-01',true,p->>'fingerprint');
 PERFORM public.qa_assert((SELECT count(*)=3 FROM public.ops_audit_log),'older-than cleanup preserves all cleanup markers');
END$$;
SELECT qa_assert((SELECT count(*) FROM public.ops_expenses)+(SELECT count(*) FROM public.ops_daily_closings)+(SELECT count(*) FROM public.ops_chat_messages)+(SELECT count(*) FROM public.ops_tasks)+(SELECT count(*) FROM public.ops_stock_revisions)+(SELECT count(*) FROM public.ops_backup_runs)=6,'business data, messages, tasks, receipt revisions and backup runs intact');
