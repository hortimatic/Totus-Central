-- Stable operation IDs for new supplier quotes; existing callers and permissions are preserved.
CREATE OR REPLACE FUNCTION public.totus_pricing_save_provider(p_price jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 v public.product_provider_prices%rowtype:=jsonb_populate_record(null::public.product_provider_prices,p_price);
 v_id uuid; v_new boolean:=v.id is null;
 v_request uuid:=nullif(p_price->>'request_id','')::uuid;
 v_fingerprint text:=md5((p_price-'request_id')::text);
 v_previous text;
begin
 if auth.uid() is null or not private.totus_can('pricing',case when v_new then 'create' else 'edit' end) then raise exception 'No tienes permiso para guardar el coste.' using errcode='42501';end if;
 if v.product_id is null or v.provider_id is null or v.net_cost is null or v.net_cost<0 or v.provider_discount is null or v.provider_discount not between 0 and 100 or v.shipping_unit is null or v.shipping_unit<0 or v.moq is null or v.moq<0 then raise exception 'Proveedor o importes no válidos.';end if;
 if exists(select 1 from unnest(array[v.net_cost,v.provider_discount,v.shipping_unit]) n where n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Los importes deben ser números finitos.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.product_id::text,0));
 if not exists(select 1 from public.products where id=v.product_id) then raise exception 'Producto no disponible.';end if;
 if not v_new and not exists(select 1 from public.product_provider_prices where id=v.id and product_id=v.product_id and variant_id is null) then raise exception 'Coste no disponible. Vuelve a abrirlo.';end if;
 if v_new and v_request is not null and exists(select 1 from public.product_provider_prices where id=v_request) then
  select snapshot->>'request_fingerprint' into v_previous from public.price_history
   where product_id=v.product_id and user_id=auth.uid() and snapshot->>'provider_price_id'=v_request::text
   and snapshot ? 'request_fingerprint' order by created_at desc limit 1;
  if v_previous=v_fingerprint then return v_request;end if;
  raise exception 'La operación ya se guardó con otros datos. Reabre el coste antes de crear otra oferta.';
 end if;
 if v.selected then update public.product_provider_prices set selected=false where product_id=v.product_id and variant_id is null and selected;end if;
 if v_new then
  insert into public.product_provider_prices(id,product_id,provider_id,net_cost,provider_discount,shipping_unit,moq,stock_status,price_date,notes,selected,purchase_origin,apply_special_tax,special_tax_amount)
   values(coalesce(v_request,gen_random_uuid()),v.product_id,v.provider_id,v.net_cost,v.provider_discount,v.shipping_unit,v.moq,coalesce(v.stock_status,''),v.price_date,coalesce(v.notes,''),coalesce(v.selected,false),coalesce(v.purchase_origin,'España'),false,0) returning id into v_id;
 else
  update public.product_provider_prices set provider_id=v.provider_id,net_cost=v.net_cost,provider_discount=v.provider_discount,shipping_unit=v.shipping_unit,moq=v.moq,stock_status=coalesce(v.stock_status,''),price_date=v.price_date,notes=coalesce(v.notes,''),selected=coalesce(v.selected,false),purchase_origin=coalesce(v.purchase_origin,'España'),apply_special_tax=false,special_tax_amount=0
   where id=v.id returning id into v_id;
 end if;
 insert into public.price_history(product_id,user_id,snapshot) values(v.product_id,auth.uid(),jsonb_build_object('action','PROVEEDOR_EDITADO','request_fingerprint',case when v_new and v_request is not null then v_fingerprint else null end,'tax_settings',(select jsonb_build_object('vat',default_sales_vat_rate,'re',purchase_re_rate) from public.ops_business_settings order by id limit 1),'provider_price_id',v_id,'product',(select to_jsonb(p) from public.products p where id=v.product_id),'providers',(select jsonb_agg(to_jsonb(p)) from public.product_provider_prices p where product_id=v.product_id)));
 return v_id;
end $function$
;
revoke all on function public.totus_pricing_save_provider(jsonb) from public,anon;
grant execute on function public.totus_pricing_save_provider(jsonb) to authenticated;
