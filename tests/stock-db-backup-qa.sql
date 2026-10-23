
-- Rehearsal restores only into temporary tables; both generations must work.
set request.jwt.claims='{"role":"service_role"}';
do $test$
declare payload jsonb='{}';tab text;rows jsonb;proof jsonb;
begin
 foreach tab in array private.totus_recovery_tables() loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',tab) into rows;
  payload=payload||jsonb_build_object(tab,rows);
 end loop;
 proof=public.totus_verify_recovery_rows(payload);
 if proof->>'verified'<>'true' or (proof->>'table_count')::integer<>42 then raise exception 'Current backup rehearsal failed';end if;
 raise notice 'STOCK BACKUP DB QA: 42 tables and stock foreign keys rehearsed without live writes';
end $test$;
do $test$
declare payload jsonb='{}';tab text;rows jsonb;proof jsonb;extras text[]=array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences'];
begin
 foreach tab in array private.totus_recovery_tables() loop
  if tab=any(extras) then continue;end if;
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) from public.%I r',tab) into rows;
  payload=payload||jsonb_build_object(tab,rows);
 end loop;
 proof=public.totus_verify_recovery_rows(payload);
 if proof->>'verified'<>'true' or proof->'counts'->>'ops_stock_sources'<>'0' then raise exception 'Legacy backup rehearsal failed';end if;
 raise notice 'STOCK BACKUP DB QA: exact pre-module backup restores four empty stock tables';
end $test$;

-- REST hoists this bounded timeout only for the server-side rehearsal RPC.
do $$ begin
 if not exists(select 1 from pg_proc where oid='public.totus_verify_recovery_rows(jsonb)'::regprocedure and 'statement_timeout=60s'=any(proconfig)) then raise exception 'Rehearsal timeout not configured'; end if;
 if exists(select 1 from pg_proc where oid='public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure and 'statement_timeout=60s'=any(proconfig)) then raise exception 'Live recovery timeout was unexpectedly changed'; end if;
end $$;
