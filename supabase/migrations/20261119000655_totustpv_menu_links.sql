begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table private.totus_tpv_workspace_preferences add column if not exists menu_links jsonb not null default '[]'::jsonb;
-- Dedicated non-exposed implementation schema: no access to the existing private schema.
create schema if not exists totus_tpv_internal;
revoke all on schema totus_tpv_internal from public,anon;
grant usage on schema totus_tpv_internal to authenticated;
create or replace function totus_tpv_internal.menu_links(p_actor uuid,p_connection uuid,p_shop bigint,p_drawer uuid,p_links jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item jsonb; label text; url text; result jsonb;
begin
 if actor is null or p_actor is distinct from actor then raise exception 'TPV_MENU_LINKS_FORBIDDEN';end if;
 -- The existing read contract verifies active account, connection, shop, drawer
 -- and reconciliation access. It creates no order, cash movement or native call.
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_links is not null then
  if jsonb_typeof(p_links) is distinct from 'array' then raise exception 'TPV_MENU_LINKS_INVALID';end if;
  if jsonb_array_length(p_links)>6 or length(p_links::text)>4000 then raise exception 'TPV_MENU_LINKS_INVALID';end if;
  for item in select value from jsonb_array_elements(p_links) loop
   if jsonb_typeof(item) is distinct from 'object' or not(item?&array['label','url']) or item-array['label','url']<>'{}'::jsonb
    or jsonb_typeof(item->'label') is distinct from 'string' or jsonb_typeof(item->'url') is distinct from 'string'
    then raise exception 'TPV_MENU_LINKS_INVALID';end if;
   label:=item->>'label';url:=item->>'url';
   if char_length(label) not between 1 and 48 or btrim(label)<>label or label~'[[:cntrl:]]'
    or char_length(url) not between 1 and 500 or url~'[[:space:]]' or position(chr(92) in url)>0
    or not(url~'^/[a-zA-Z0-9/_-]*([?#].*)?$' and left(url,2)<>'//' or url~'^https://[a-zA-Z0-9.-]+(:[0-9]{1,5})?(/.*)?$')
    or url~*'[?#&](token|access_token|api_key|key|password|passwd|secret|authorization|ws_key)='
    or url~'[?#&][^=&#]*%' then raise exception 'TPV_MENU_LINKS_INVALID';end if;
  end loop;
  if (select count(distinct lower(value->>'label')) from jsonb_array_elements(p_links))<>jsonb_array_length(p_links)
   or (select count(distinct value->>'url') from jsonb_array_elements(p_links))<>jsonb_array_length(p_links) then raise exception 'TPV_MENU_LINKS_INVALID';end if;
  perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,'{}'::jsonb);
  update private.totus_tpv_workspace_preferences set menu_links=p_links,updated_at=clock_timestamp()
   where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 end if;
 select menu_links into result from private.totus_tpv_workspace_preferences
  where actor_id=actor and connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return coalesce(result,'[]'::jsonb);
end $$;
revoke all on function totus_tpv_internal.menu_links(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function totus_tpv_internal.menu_links(uuid,uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.totus_tpv_menu_links(p_actor uuid,p_connection uuid,p_shop bigint,p_drawer uuid,p_links jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$
 select totus_tpv_internal.menu_links(p_actor,p_connection,p_shop,p_drawer,p_links);
$$;
revoke all on function public.totus_tpv_menu_links(uuid,uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_menu_links(uuid,uuid,bigint,uuid,jsonb) to authenticated;
commit;
