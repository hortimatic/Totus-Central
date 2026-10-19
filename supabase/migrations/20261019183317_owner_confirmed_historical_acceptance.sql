do $accept$
begin
 alter table public.ops_business_settings add column if not exists historical_acceptance jsonb;
 update public.ops_business_settings set historical_acceptance=jsonb_build_object(
 'accepted_at',now(),'confirmed_by','Titular: confirmación expresa en el chat',
 'reason','El titular confirma los tres primeros trimestres presentados y acepta y concilia los gastos y cajas históricos. Se conservan importes, originales y diferencias documentadas. No acredita importes de impuestos ni reconstruye desgloses ausentes.',
 'presented_periods',jsonb_build_array('2026-T1','2026-T2','2026-T3'),
 'expense_ids',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from public.ops_expenses where expense_date between date '2026-01-01' and date '2026-09-30'),
 'closing_ids',(select coalesce(jsonb_agg(id order by id),'[]'::jsonb) from public.ops_daily_closings where business_date between date '2026-01-01' and date '2026-09-30')
 ),updated_at=now() where id=1 and historical_acceptance is null;
 if found then
 insert into public.ops_audit_log(user_email,area,action,detail)
 select 'confirmacion-titular','fiscalidad','historico_aceptado',
 jsonb_build_object('through','2026-09-30','presented_periods',historical_acceptance->'presented_periods','expenses',jsonb_array_length(historical_acceptance->'expense_ids'),'closings',jsonb_array_length(historical_acceptance->'closing_ids'),'reason',historical_acceptance->>'reason')
 from public.ops_business_settings where id=1;
 end if;
end $accept$;
