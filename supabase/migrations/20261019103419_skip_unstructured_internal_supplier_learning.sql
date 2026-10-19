-- Preserve explicit supplier selection, but do not learn suppliers from unstructured internal payment labels.
create or replace function private.ops_expense_supplier_link_trigger()
returns trigger
language plpgsql
security definer
set search_path='public'
as $function$
begin
  if nullif(btrim(coalesce(new.supplier_name,'')),'') is null then
    new.supplier_id:=null;
    return new;
  end if;
  if new.management_only
     and new.document_kind='otro'
     and nullif(btrim(coalesce(new.supplier_tax_id,'')),'') is null
     and new.supplier_id is null then
    return new;
  end if;
  new.supplier_id:=private.ops_resolve_supplier(
    new.supplier_name,new.supplier_tax_id,new.payment_method,new.document_kind
  );
  return new;
end
$function$;
