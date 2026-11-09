-- Read-only attribution of products created through Totus. Native shop data is untouched.
begin;
create or replace function public.totus_products_creation_metadata(p_store text,p_product_ids text[]) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not coalesce(private.totus_can('productos','view'),false) then raise exception 'No tienes permiso para consultar Productos.';end if;
 if p_store not in ('hortimatic','newoldsmok') or p_store is null or p_product_ids is null or cardinality(p_product_ids) not between 1 and 100 or exists(select 1 from unnest(p_product_ids) x where x is null or x !~ '^[1-9][0-9]{0,14}$') then raise exception 'Selecciona productos de una tienda.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('product_id',r.product_id::text,'creator',coalesce(nullif(t.full_name,''),'Usuario retirado'),'registered_at',r.created_at,'completed_at',r.completed_at))
 from private.totus_prestashop_product_create_requests r left join auth.users u on u.id=r.actor_id left join public.team_members t on lower(t.email)=lower(u.email)
 where r.store=p_store and r.status='completed' and r.product_id::text=any(p_product_ids)),'[]'::jsonb);
end $$;
revoke all on function public.totus_products_creation_metadata(text,text[]) from public,anon;
grant execute on function public.totus_products_creation_metadata(text,text[]) to authenticated;
commit;
