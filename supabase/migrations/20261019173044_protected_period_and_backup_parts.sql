-- STAGING ONLY. Operational protection, not a statement that tax filings agree.
alter table public.ops_business_settings add column if not exists closed_through date;
alter table public.ops_business_settings add column if not exists period_close_notes text not null default '';

create function public.totus_set_closed_period(p_through date,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare before_row jsonb;
begin
 if auth.uid() is null or not private.is_admin() then raise exception 'Solo administración puede cerrar o reabrir un periodo'; end if;
 if length(btrim(coalesce(p_reason,'')))<15 then raise exception 'Indica el motivo y los asuntos pendientes del cierre o reapertura'; end if;
 if p_through is not null and (p_through>=current_date or p_through<>(date_trunc('quarter',p_through)+interval '3 months - 1 day')::date) then
  raise exception 'Selecciona el último día de un trimestre ya terminado';
 end if;
 select to_jsonb(s) into before_row from public.ops_business_settings s where id=1 for update;
 update public.ops_business_settings set closed_through=p_through,period_close_notes=btrim(p_reason),updated_at=now() where id=1;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(auth.uid(),auth.jwt()->>'email','fiscalidad','periodo_cierre',jsonb_build_object('before',before_row->'closed_through','through',p_through,'reason',btrim(p_reason)));
end $$;
revoke all on function public.totus_set_closed_period(date,text) from public,anon;
grant execute on function public.totus_set_closed_period(date,text) to authenticated;

create function private.totus_guard_closed_period() returns trigger
language plpgsql security definer set search_path='' as $$
declare cutoff date; old_date date; new_date date; parent_id uuid; old_json jsonb; new_json jsonb;
begin
 select closed_through into cutoff from public.ops_business_settings where id=1 for share;
 if cutoff is null then if tg_op='DELETE' then return old; else return new; end if; end if;
 if tg_op<>'INSERT' then old_json=to_jsonb(old); end if;
 if tg_op<>'DELETE' then new_json=to_jsonb(new); end if;
 if tg_table_name='ops_expense_lines' then
  select expense_date into old_date from public.ops_expenses where id=(old_json->>'expense_id')::uuid;
  select expense_date into new_date from public.ops_expenses where id=(new_json->>'expense_id')::uuid;
 elsif tg_table_name='ops_daily_closing_drawers' then
  select business_date into old_date from public.ops_daily_closings where id=(old_json->>'closing_id')::uuid;
  select business_date into new_date from public.ops_daily_closings where id=(new_json->>'closing_id')::uuid;
 elsif tg_table_name='ops_sales_invoice_lines' then
  select issue_date into old_date from public.ops_sales_invoices where id=(old_json->>'invoice_id')::uuid;
  select issue_date into new_date from public.ops_sales_invoices where id=(new_json->>'invoice_id')::uuid;
 else
  old_date=(old_json->>tg_argv[0])::date;new_date=(new_json->>tg_argv[0])::date;
 end if;
 if old_date<=cutoff or new_date<=cutoff then
  -- Settling an existing bill or attaching its evidence must not count it again.
  if tg_table_name in ('ops_expenses','ops_sales_invoices') and tg_op='UPDATE'
   and old_json-ARRAY['paid_status','paid_amount','amount_paid','paid_date','payment_method','notes','document_id','source_ref','updated_at']
       =new_json-ARRAY['paid_status','paid_amount','amount_paid','paid_date','payment_method','notes','document_id','source_ref','updated_at'] then return new; end if;
  raise exception 'Periodo cerrado hasta %. Sus importes están protegidos. Administración debe reabrirlo con un motivo antes de corregir datos históricos.',to_char(cutoff,'DD/MM/YYYY');
 end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;

create function public.totus_set_expense_payment(p_id uuid,p_status text,p_amount numeric,p_date date) returns void
language plpgsql security definer set search_path='' as $$
declare e public.ops_expenses; net numeric;
begin
 if auth.uid() is null or not private.totus_can('gastos','edit') then raise exception 'Sin permiso para registrar pagos'; end if;
 select * into e from public.ops_expenses where id=p_id for update;
 if not found then raise exception 'Gasto no encontrado'; end if;
 net=round(e.base_amount+e.vat_amount+e.re_amount-e.withholding_amount,2);
 if p_status is null or p_status not in ('pendiente','parcial','pagado') or p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity')
  or (net>=0 and p_amount<0) or (net<0 and p_amount>0) or abs(p_amount)>abs(net)+0.02
  or (p_status='pendiente' and abs(p_amount)>0.02)
  or (p_status='pagado' and abs(p_amount-net)>0.02)
  or (p_status='parcial' and (abs(p_amount)<=0 or abs(p_amount)>=abs(net)-0.02))
  or (p_status<>'pendiente' and p_date is null) or p_date>current_date then raise exception 'Estado, importe o fecha de pago no válidos'; end if;
 update public.ops_expenses set paid_status=p_status,amount_paid=round(p_amount,2),paid_date=case when p_status='pendiente' then null else p_date end where id=p_id;
 insert into public.ops_audit_log(user_id,user_email,area,action,entity_id,detail)
 values(auth.uid(),auth.jwt()->>'email','gastos','pago_registrado',p_id,jsonb_build_object('before',jsonb_build_object('status',e.paid_status,'amount',e.amount_paid,'date',e.paid_date),'status',p_status,'amount',p_amount,'date',p_date));
end $$;
revoke all on function public.totus_set_expense_payment(uuid,text,numeric,date) from public,anon;
grant execute on function public.totus_set_expense_payment(uuid,text,numeric,date) to authenticated;
revoke all on function private.totus_guard_closed_period() from public,anon,authenticated;
do $$
declare table_name text; date_field text;
begin
 for table_name,date_field in select * from (values
  ('ops_expenses','expense_date'),('ops_expense_lines',''),('ops_daily_closings','business_date'),('ops_daily_closing_drawers',''),
  ('ops_sales_invoices','issue_date'),('ops_sales_invoice_lines',''),('ops_income_adjustments','income_date'),('ops_fiscal_adjustments','adjustment_date')) as x(t,d)
 loop
  execute format('create trigger totus_closed_period_guard before insert or update or delete on public.%I for each row execute function private.totus_guard_closed_period(%L)',table_name,date_field);
 end loop;
end $$;

-- Same administrator, own request folder, immutable writes, unchanged bucket cap.
alter policy totus_recovery_source_insert on storage.objects with check
 (bucket_id='business-backups' and private.is_admin()
 and split_part(name,'/',3)=(select auth.uid())::text
 and name ~ '^restauraciones/solicitudes/[0-9a-f-]{36}/[0-9a-f-]{36}\.totusbackup(\.part-[0-9]{4})?$');
