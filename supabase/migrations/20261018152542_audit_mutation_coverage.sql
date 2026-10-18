-- STAGING: cover committed mutations that do not pass through business RPCs.
-- Record identifiers and changed field names, never raw row contents or secrets.
create or replace function private.totus_log_table_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare item jsonb; before_item jsonb; changed jsonb; actor uuid; entity uuid; label text;
begin
  item:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_op='UPDATE' then
    before_item:=to_jsonb(old);
    select coalesce(jsonb_agg(key order by key),'[]'::jsonb) into changed
    from jsonb_object_keys(item) key
    where key not in ('created_at','updated_at') and item->key is distinct from before_item->key;
    if changed='[]'::jsonb then return new; end if;
  else changed:='[]'::jsonb;
  end if;
  select id into actor from public.profiles where id=auth.uid();
  if coalesce(item->>'id','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then entity:=(item->>'id')::uuid; end if;
  label:=left(coalesce(nullif(item->>'name',''),nullif(item->>'original_name',''),nullif(item->>'full_name',''),nullif(item->>'invoice_number',''),nullif(item->>'query',''),nullif(item->>'code',''),nullif(item->>'email',''),tg_table_name),160);
  insert into public.ops_audit_log(user_id,user_email,area,action,entity_id,detail)
  values(actor,coalesce(nullif(auth.jwt()->>'email',''),'Sistema / mantenimiento'),tg_argv[0],
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'actualizar' else 'eliminar' end,entity,
    jsonb_build_object('tabla',tg_table_name,'registro',label,'campos',changed,'origen','registro automático'));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.totus_log_table_change() from public,anon,authenticated;
do $$
declare entry record;
begin
 for entry in select * from (values
  ('ops_documents','documentos'),('ops_suppliers','gastos'),('ops_customers','facturacion'),('ops_document_templates','facturacion'),
  ('ops_invoice_series','facturacion'),('products','pricing'),('product_variants','pricing'),('product_provider_prices','pricing'),
  ('product_competitor_prices','pricing'),('providers','pricing'),('brands','pricing'),('families','pricing'),('consultations','pricing'),
  ('ops_business_settings','administracion'),('ops_stores','administracion'),('ops_cash_drawers','administracion'),('ops_expense_categories','fiscalidad'),
  ('ops_roles','administracion'),('ops_role_permissions','administracion'),('ops_user_permissions','administracion'),('team_members','usuarios'),
  ('ops_tax_payments','fiscalidad'),('ops_fiscal_adjustments','fiscalidad'),('ops_income_adjustments','fiscalidad')
 ) as items(table_name,area)
 loop
  execute format('create trigger totus_audit_mutation after insert or update or delete on public.%I for each row execute function private.totus_log_table_change(%L)',entry.table_name,entry.area);
 end loop;
end;
$$;
