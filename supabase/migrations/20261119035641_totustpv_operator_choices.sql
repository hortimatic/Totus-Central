begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Authenticated colleagues in shared workstations only; never a public staff directory.
create function totus_tpv_internal.operator_choices(p_connection uuid default null,p_shop bigint default null,p_drawer uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;items jsonb;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 if ((p_connection is null and p_shop is null and p_drawer is null) or (p_connection is not null and p_shop>0 and p_drawer is not null)) is not true then raise exception 'TPV_OPERATOR_SCOPE_INVALID';end if;
 if not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) and t.active where p.id=actor and p.active) then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 ctx:=public.totus_tpv_context();
 if ctx->>'actorId' is distinct from actor::text then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 if p_connection is not null and not exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true') then raise exception 'TPV_OPERATOR_CHOICES_FORBIDDEN';end if;
 select coalesce(jsonb_agg(jsonb_build_object('operatorId',c.id,'name',c.name,'loginEmail',c.email) order by lower(c.name),c.id),'[]'::jsonb) into items from (
  select distinct p.id,coalesce(nullif(btrim(p.full_name),''),'Operador') name,lower(p.email) email
  from private.totus_tpv_assignments a join public.profiles p on p.id=a.actor_id and p.active
  where a.active and a.can_reconcile and a.environment='qa'
   and length(coalesce(p.email,'')) between 3 and 254 and p.email !~ '[[:space:][:cntrl:]]' and p.email like '%@%'
   and exists(select 1 from public.team_members t where lower(t.email)=lower(p.email) and t.active)
   and private.totus_module_can(p.email,'ventas','view') and private.totus_module_can(p.email,'cajas','view')
   and exists(select 1 from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=a.connection_id::text and w->>'shopId'=a.shop_id::text and w->>'drawerId'=a.drawer_id::text and w->>'storeId'=a.store_id::text and w->>'websiteKey'=a.website_key
    and w->>'canReconcile'='true' and (p_connection is null or a.connection_id=p_connection and a.shop_id=p_shop and a.drawer_id=p_drawer))
  order by p.id limit 2001
 ) c;
 if jsonb_array_length(items)>2000 then raise exception 'TPV_OPERATOR_CHOICES_LIMIT';end if;
 return jsonb_build_object('actorId',actor,'items',items);
end $$;
revoke all on function totus_tpv_internal.operator_choices(uuid,bigint,uuid) from public,anon,service_role;
grant execute on function totus_tpv_internal.operator_choices(uuid,bigint,uuid) to authenticated;
create function public.totus_tpv_operator_choices(p_connection uuid default null,p_shop bigint default null,p_drawer uuid default null)
returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.operator_choices(p_connection,p_shop,p_drawer);$$;
revoke all on function public.totus_tpv_operator_choices(uuid,bigint,uuid) from public,anon,service_role;
grant execute on function public.totus_tpv_operator_choices(uuid,bigint,uuid) to authenticated;
commit;
