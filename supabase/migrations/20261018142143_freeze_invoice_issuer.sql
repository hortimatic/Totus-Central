-- Preserve the issuer at issuance; never infer or rewrite historic issuers.
create or replace function private.totus_freeze_invoice_issuer()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare issuer jsonb;
begin
  if new.status='emitida' and (tg_op='INSERT' or old.status='borrador') then
    select jsonb_build_object(
      'business_name',s.business_name,'tax_id',s.tax_id,
      'business_address',s.business_address,'business_email',s.business_email,
      'business_phone',s.business_phone
    ) into issuer from public.ops_business_settings s where s.id=1;
    new.template_snapshot:=coalesce(new.template_snapshot,'{}'::jsonb)||jsonb_build_object('issuer',coalesce(issuer,'{}'::jsonb));
    new.design_snapshot:=coalesce(new.design_snapshot,'{}'::jsonb)||jsonb_build_object('issuer',coalesce(issuer,'{}'::jsonb));
  end if;
  return new;
end;
$$;
revoke all on function private.totus_freeze_invoice_issuer() from public,anon,authenticated;
create trigger ops_freeze_invoice_issuer_tg
before insert or update on public.ops_sales_invoices
for each row execute function private.totus_freeze_invoice_issuer();
