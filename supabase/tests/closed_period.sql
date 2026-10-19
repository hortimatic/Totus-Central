-- Every fixture and audit entry rolls back in a subtransaction.
do $test$
declare actor uuid; email text; e public.ops_expenses; income uuid; old_amount numeric; rejected boolean; n integer;
begin
 begin
  select p.id,p.email into actor,email from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) where t.active and t.role='admin' limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','email',email)::text,true);
  perform public.totus_set_closed_period('2026-09-30','QA rollback: operational protection, unresolved accountant comparison retained');
  select * into e from public.ops_expenses where expense_date<'2026-10-01' and accounting_amount>0 and fiscal_reviewed limit 1;
  rejected=false;
  begin update public.ops_expenses set expense_date='2026-10-01' where id=e.id;
  exception when others then if sqlerrm like 'Periodo cerrado%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Closed expense could move to an open period'; end if;
  rejected=false;
  begin update public.ops_expense_lines set base_amount=base_amount+1 where expense_id=e.id;
  exception when others then if sqlerrm like 'Periodo cerrado%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Closed expense lines could change'; end if;
  rejected=false;
  begin delete from public.ops_daily_closings where id=(select id from public.ops_daily_closings where business_date<'2026-10-01' limit 1);
  exception when others then if sqlerrm like 'Periodo cerrado%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Closed cash day could be deleted'; end if;
  select id,amount into income,old_amount from public.ops_income_adjustments where income_date<'2026-10-01' limit 1;
  rejected=false;
  begin update public.ops_income_adjustments set amount=amount+1 where id=income;
  exception when others then if sqlerrm like 'Periodo cerrado%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Closed income could change'; end if;
  insert into public.ops_income_adjustments(income_date,amount,concept,created_by) values('2026-10-01',1,'QA ROLLBACK',actor);
  select count(*) into n from public.ops_expense_lines where expense_id=e.id;
  perform public.totus_set_expense_payment(e.id,'pagado',round(e.base_amount+e.vat_amount+e.re_amount-e.withholding_amount,2),'2026-10-01');
  if (select accounting_amount<>e.accounting_amount from public.ops_expenses where id=e.id) or (select count(*)<>n from public.ops_expense_lines where expense_id=e.id) then raise exception 'Payment changed expense totals or lines'; end if;
  rejected=false;
  begin perform public.totus_set_expense_payment(e.id,'pagado',99999999,'2026-10-01');
  exception when others then if sqlerrm like 'Estado, importe%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Invalid payment accepted'; end if;
  perform public.totus_set_closed_period(null,'QA rollback: reopening explicitly audited');
  update public.ops_income_adjustments set amount=old_amount+1 where id=income;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  perform set_config('request.jwt.claims','{"role":"authenticated","email":"qa-denied@example.invalid"}',true);
  rejected=false;
  begin perform public.totus_set_closed_period(null,'QA unauthorized reopen must fail');
  exception when others then if sqlerrm like 'Solo administración%' then rejected=true; else raise; end if; end;
  if not rejected then raise exception 'Non-admin could reopen'; end if;
  raise exception using errcode='ZX001',message='QA_ROLLBACK_SUCCESS';
 exception when sqlstate 'ZX001' then null;
 end;
end $test$;
