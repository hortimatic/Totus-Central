-- Product and new variants are one transaction; existing related rows are never replaced.
create unique index if not exists products_normalized_sku on public.products (lower(btrim(sku)));
create unique index if not exists variants_normalized_sku on public.product_variants (lower(btrim(sku)));
alter policy totus_history_create on public.price_history with check
 ((select private.totus_can('pricing','create') or private.totus_can('pricing','edit')) and user_id=(select auth.uid()));

create or replace function public.totus_pricing_save_product(p_product jsonb,p_variants jsonb default '[]'::jsonb,p_provider jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid:=(p_product->>'id')::uuid;
 v_new boolean:=coalesce((p_product->>'is_new')::boolean,false);
 v_row public.products%rowtype; v_old public.products%rowtype;
 v_variant jsonb; v_item public.product_variants%rowtype;
 v_fingerprint text:=md5((jsonb_build_object('product',p_product-'updated_at'-'expected_updated_at','variants',p_variants,'provider',p_provider))::text);
 v_saved_fingerprint text; v_provider_id uuid; v_provider_name text;
begin
 if auth.uid() is null or not private.totus_can('pricing',case when v_new then 'create' else 'edit' end) then
  raise exception 'No tienes permiso para guardar este producto.' using errcode='42501';
 end if;
 if v_id is null or jsonb_typeof(p_variants) is distinct from 'array' or jsonb_array_length(p_variants)>200 then raise exception 'Solicitud de producto no válida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 select * into v_old from public.products where id=v_id for update;
 if v_new and v_old.id is not null then
  select snapshot->>'request_fingerprint' into v_saved_fingerprint from public.price_history
   where product_id=v_id and snapshot->>'action'='PRODUCTO_CREADO' and user_id=auth.uid() order by created_at desc limit 1;
  if v_saved_fingerprint=v_fingerprint then return jsonb_build_object('product',to_jsonb(v_old),'replayed',true); end if;
  raise exception 'Este producto ya se guardó. Vuelve a abrirlo antes de modificarlo.';
 end if;
 if not v_new and (v_old.id is null or nullif(p_product->>'expected_updated_at','')::timestamptz is distinct from v_old.updated_at) then
  raise exception 'El producto ha cambiado. Vuelve a abrirlo para no sobrescribir cambios de otra persona.';
 end if;
 if coalesce(p_product->>'product_type','') not in ('simple','variants') or coalesce(p_product->>'status','') not in ('PENDIENTE','ACEPTADO') then raise exception 'Tipo o estado no válido.'; end if;
 if nullif(btrim(p_product->>'sku'),'') is null or nullif(btrim(p_product->>'name'),'') is null then raise exception 'Indica nombre y referencia.'; end if;
 v_row:=jsonb_populate_record(null::public.products,p_product);
 if v_row.current_pvp<0 or v_row.proposed_pvp<0 or v_row.quick_competitor<0 or v_row.quick_discount is null or v_row.quick_discount not between 0 and 100 or v_row.units_month is null or v_row.units_month<0 then raise exception 'Precios, descuento o unidades no válidos.'; end if;
 if exists(select 1 from unnest(array[v_row.current_pvp,v_row.proposed_pvp,v_row.quick_competitor,v_row.quick_discount]) n where n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Los importes deben ser números finitos.';end if;
 if v_row.product_type='simple' and jsonb_array_length(p_variants)>0 then raise exception 'Las variantes necesitan un producto con variantes.'; end if;
 if v_row.product_type='variants' and jsonb_array_length(p_variants)=0 and not exists(select 1 from public.product_variants where product_id=v_id) then raise exception 'Añade al menos una variante.'; end if;
 if v_new then
  insert into public.products(id,family_id,sku,name,product_type,status,current_pvp,proposed_pvp,quick_competitor,quick_discount,units_month,notes,created_by)
  values(v_id,v_row.family_id,btrim(v_row.sku),btrim(v_row.name),v_row.product_type,v_row.status,v_row.current_pvp,v_row.proposed_pvp,v_row.quick_competitor,v_row.quick_discount,v_row.units_month,coalesce(v_row.notes,''),auth.uid()) returning * into v_row;
 else
  update public.products set family_id=v_row.family_id,sku=btrim(v_row.sku),name=btrim(v_row.name),product_type=v_row.product_type,status=v_row.status,
   current_pvp=v_row.current_pvp,proposed_pvp=v_row.proposed_pvp,quick_competitor=v_row.quick_competitor,quick_discount=v_row.quick_discount,units_month=v_row.units_month,notes=coalesce(v_row.notes,''),updated_at=clock_timestamp()
   where id=v_id returning * into v_row;
 end if;
 for v_variant in select value from jsonb_array_elements(p_variants) loop
  v_item:=jsonb_populate_record(null::public.product_variants,v_variant);
  if v_item.id is null or nullif(btrim(v_item.name),'') is null or nullif(btrim(v_item.sku),'') is null or v_item.cost_net is null or v_item.pvp is null or v_item.cost_net<0 or v_item.pvp<0 or v_item.nicotine_mg_ml<0 or v_item.volume_ml<0 or jsonb_typeof(coalesce(v_item.attributes,'{}'::jsonb))<>'object' then raise exception 'Variante incompleta o con valores no válidos.'; end if;
  if exists(select 1 from unnest(array[v_item.cost_net,v_item.pvp,v_item.nicotine_mg_ml,v_item.volume_ml]) n where n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Los importes de variante deben ser números finitos.';end if;
  insert into public.product_variants(id,product_id,sku,name,attributes,nicotine_mg_ml,volume_ml,cost_net,pvp,active)
   values(v_item.id,v_id,btrim(v_item.sku),btrim(v_item.name),coalesce(v_item.attributes,'{}'::jsonb),v_item.nicotine_mg_ml,v_item.volume_ml,v_item.cost_net,v_item.pvp,coalesce(v_item.active,true));
 end loop;
 if p_provider is not null then
  if not v_new or v_row.product_type<>'simple' then raise exception 'El coste inicial solo se aplica al crear productos simples.';end if;
  v_provider_name:=btrim(p_provider->>'name');
  if nullif(v_provider_name,'') is null then raise exception 'Indica el proveedor.';end if;
  perform pg_advisory_xact_lock(hashtextextended('provider:'||lower(v_provider_name),0));
  if nullif(p_provider->>'id','') is not null then
   select id into v_provider_id from public.providers where id=(p_provider->>'id')::uuid;
   if v_provider_id is null then raise exception 'Proveedor no disponible.';end if;
  else
   select id into v_provider_id from public.providers where lower(btrim(name))=lower(v_provider_name) order by id limit 1;
  end if;
  if v_provider_id is null then insert into public.providers(name) values(v_provider_name) returning id into v_provider_id;end if;
  perform public.totus_pricing_save_provider(jsonb_build_object('product_id',v_id,'provider_id',v_provider_id,'net_cost',p_provider->'net_cost','provider_discount',coalesce(p_provider->'provider_discount','0'::jsonb),'shipping_unit',coalesce(p_provider->'shipping_unit','0'::jsonb),'moq',0,'selected',true));
 end if;
 insert into public.price_history(product_id,user_id,snapshot) values(v_id,auth.uid(),jsonb_build_object(
  'action',case when v_new then 'PRODUCTO_CREADO' else 'PRODUCTO_EDITADO' end,
  'request_fingerprint',v_fingerprint,'product',to_jsonb(v_row),
  'variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where product_id=v_id),'[]'::jsonb),
  'providers',coalesce((select jsonb_agg(to_jsonb(p)) from public.product_provider_prices p where product_id=v_id),'[]'::jsonb),
  'competitors',coalesce((select jsonb_agg(to_jsonb(c)) from public.product_competitor_prices c where product_id=v_id),'[]'::jsonb)));
 if nullif(p_product->>'consultation_id','') is not null then
  if not v_new then raise exception 'La conversión debe crear un producto nuevo.';end if;
  insert into public.consultation_history(consultation_id,user_id,action,consultation_query,snapshot)
   select c.id,auth.uid(),'CONVERTIDA',c.query,to_jsonb(c)||jsonb_build_object('product_id',v_id) from public.consultations c where id=(p_product->>'consultation_id')::uuid;
  if not found then raise exception 'Consulta no disponible. No se ha creado el producto.';end if;
 end if;
 return jsonb_build_object('product',to_jsonb(v_row),'replayed',false);
end $$;
revoke all on function public.totus_pricing_save_product(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.totus_pricing_save_product(jsonb,jsonb,jsonb) to authenticated;

-- Selecting a supplier must not unselect the previous one if saving fails.
create or replace function public.totus_pricing_save_provider(p_price jsonb) returns uuid
language plpgsql security invoker set search_path='' as $$
declare
 v public.product_provider_prices%rowtype:=jsonb_populate_record(null::public.product_provider_prices,p_price);
 v_id uuid; v_new boolean:=v.id is null;
begin
 if auth.uid() is null or not private.totus_can('pricing',case when v_new then 'create' else 'edit' end) then raise exception 'No tienes permiso para guardar el coste.' using errcode='42501';end if;
 if v.product_id is null or v.provider_id is null or v.net_cost is null or v.net_cost<0 or v.provider_discount is null or v.provider_discount not between 0 and 100 or v.shipping_unit is null or v.shipping_unit<0 or v.moq is null or v.moq<0 then raise exception 'Proveedor o importes no válidos.';end if;
 if exists(select 1 from unnest(array[v.net_cost,v.provider_discount,v.shipping_unit]) n where n::text in ('NaN','Infinity','-Infinity')) then raise exception 'Los importes deben ser números finitos.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v.product_id::text,0));
 if not exists(select 1 from public.products where id=v.product_id) then raise exception 'Producto no disponible.';end if;
 if not v_new and not exists(select 1 from public.product_provider_prices where id=v.id and product_id=v.product_id and variant_id is null) then raise exception 'Coste no disponible. Vuelve a abrirlo.';end if;
 if v.selected then update public.product_provider_prices set selected=false where product_id=v.product_id and variant_id is null and selected;end if;
 if v_new then
  insert into public.product_provider_prices(product_id,provider_id,net_cost,provider_discount,shipping_unit,moq,stock_status,price_date,notes,selected,purchase_origin,apply_special_tax,special_tax_amount)
   values(v.product_id,v.provider_id,v.net_cost,v.provider_discount,v.shipping_unit,v.moq,coalesce(v.stock_status,''),v.price_date,coalesce(v.notes,''),coalesce(v.selected,false),coalesce(v.purchase_origin,'España'),false,0) returning id into v_id;
 else
  update public.product_provider_prices set provider_id=v.provider_id,net_cost=v.net_cost,provider_discount=v.provider_discount,shipping_unit=v.shipping_unit,moq=v.moq,stock_status=coalesce(v.stock_status,''),price_date=v.price_date,notes=coalesce(v.notes,''),selected=coalesce(v.selected,false),purchase_origin=coalesce(v.purchase_origin,'España'),apply_special_tax=false,special_tax_amount=0
   where id=v.id returning id into v_id;
 end if;
 insert into public.price_history(product_id,user_id,snapshot) values(v.product_id,auth.uid(),jsonb_build_object('action','PROVEEDOR_EDITADO','provider_price_id',v_id,'product',(select to_jsonb(p) from public.products p where id=v.product_id),'providers',(select jsonb_agg(to_jsonb(p)) from public.product_provider_prices p where product_id=v.product_id)));
 return v_id;
end $$;
revoke all on function public.totus_pricing_save_provider(jsonb) from public,anon;
grant execute on function public.totus_pricing_save_provider(jsonb) to authenticated;

alter policy totus_consultation_history_create on public.consultation_history with check ((select private.totus_can('pricing','create') or private.totus_can('pricing','edit')) and user_id=(select auth.uid()));
