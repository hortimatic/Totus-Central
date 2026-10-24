-- Product and new variants are one transaction; existing related rows are never replaced.
create unique index if not exists products_normalized_sku on public.products (lower(btrim(sku)));
create unique index if not exists variants_normalized_sku on public.product_variants (lower(btrim(sku)));
alter policy totus_history_create on public.price_history with check
 ((select private.totus_can('pricing','create') or private.totus_can('pricing','edit')) and user_id=(select auth.uid()));

create or replace function public.totus_pricing_save_product(p_product jsonb,p_variants jsonb default '[]'::jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 v_id uuid:=(p_product->>'id')::uuid;
 v_new boolean:=coalesce((p_product->>'is_new')::boolean,false);
 v_row public.products%rowtype; v_old public.products%rowtype;
 v_variant jsonb; v_item public.product_variants%rowtype;
 v_fingerprint text:=md5((jsonb_build_object('product',p_product-'updated_at'-'expected_updated_at','variants',p_variants))::text);
 v_saved_fingerprint text;
begin
 if auth.uid() is null or not private.totus_can('pricing',case when v_new then 'create' else 'edit' end) then
  raise exception 'No tienes permiso para guardar este producto.' using errcode='42501';
 end if;
 if v_id is null or jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants)>200 then raise exception 'Solicitud de producto no válida.'; end if;
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
  insert into public.product_variants(id,product_id,sku,name,attributes,nicotine_mg_ml,volume_ml,cost_net,pvp,active)
   values(v_item.id,v_id,btrim(v_item.sku),btrim(v_item.name),coalesce(v_item.attributes,'{}'::jsonb),v_item.nicotine_mg_ml,v_item.volume_ml,v_item.cost_net,v_item.pvp,coalesce(v_item.active,true));
 end loop;
 insert into public.price_history(product_id,user_id,snapshot) values(v_id,auth.uid(),jsonb_build_object(
  'action',case when v_new then 'PRODUCTO_CREADO' else 'PRODUCTO_EDITADO' end,
  'request_fingerprint',v_fingerprint,'product',to_jsonb(v_row),
  'variants',coalesce((select jsonb_agg(to_jsonb(v)) from public.product_variants v where product_id=v_id),'[]'::jsonb),
  'providers',coalesce((select jsonb_agg(to_jsonb(p)) from public.product_provider_prices p where product_id=v_id),'[]'::jsonb),
  'competitors',coalesce((select jsonb_agg(to_jsonb(c)) from public.product_competitor_prices c where product_id=v_id),'[]'::jsonb)));
 return jsonb_build_object('product',to_jsonb(v_row),'replayed',false);
end $$;
revoke all on function public.totus_pricing_save_product(jsonb,jsonb) from public,anon;
grant execute on function public.totus_pricing_save_product(jsonb,jsonb) to authenticated;
