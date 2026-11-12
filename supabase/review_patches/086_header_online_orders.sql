-- Reuse deliveries made by the existing scheduler: never infer online from payment.
-- Preferences are personal; access still requires sales and channel membership.
begin;
create or replace function public.totus_header_online_orders(p_action text default 'read',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb; config jsonb; uid uuid=auth.uid(); items jsonb; rules integer;
begin
 if uid is null or not coalesce(private.is_team_member(),false) or not private.totus_can('ventas','view') then raise exception 'No tienes acceso a los avisos de pedidos.';end if;
 if p_action not in ('read','save') then raise exception 'Acción no válida.';end if;
 select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=uid;
 config=coalesce(prefs->'online_order_alerts','{"enabled":true,"stores":["hortimatic","newoldsmok"],"seen":[]}'::jsonb);
 if p_action='save' then
  if jsonb_typeof(p_data) is distinct from 'object' or p_data-array['enabled','stores','seen']<>'{}'::jsonb
   or jsonb_typeof(p_data->'enabled') is distinct from 'boolean' or jsonb_typeof(p_data->'stores') is distinct from 'array'
   or jsonb_typeof(p_data->'seen') is distinct from 'array' or jsonb_array_length(p_data->'stores')>2 or jsonb_array_length(p_data->'seen')>500
   or exists(select 1 from jsonb_array_elements_text(p_data->'stores') x where x not in ('hortimatic','newoldsmok'))
   or exists(select 1 from jsonb_array_elements_text(p_data->'seen') x where x!~'^(hortimatic|newoldsmok):[0-9]{1,15}$') then raise exception 'Preferencias de avisos no válidas.';end if;
  update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'),'{online_order_alerts}',p_data) where id=uid;
  if not found then raise exception 'Completa primero tu perfil de usuario.';end if;
  config=p_data;
 end if;
 select count(*) into rules from private.totus_prestashop_automations a where a.recipe='online_orders' and a.enabled and a.deleted_at is null and private.totus_chat_member(a.channel_id);
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into items from (
  select * from (select distinct on (d.store,d.order_id) d.store,d.order_id,m.body,d.created_at
  from private.totus_prestashop_deliveries d join private.totus_prestashop_automations a on a.id=d.automation_id
  join public.ops_chat_messages m on m.id=d.message_id
  where a.recipe='online_orders' and a.deleted_at is null and d.order_id~'^[0-9]{1,15}$'
   and d.created_at>=now()-interval '7 days' and m.deleted_at is null and private.totus_chat_member(m.channel_id)
  order by d.store,d.order_id,d.created_at desc) unique_orders order by created_at desc limit 100
 ) x;
 return jsonb_build_object('config',config,'rows',items,'active_rules',rules,'checked_at',now());
end $$;
revoke all on function public.totus_header_online_orders(text,jsonb) from public,anon;
grant execute on function public.totus_header_online_orders(text,jsonb) to authenticated;
commit;
