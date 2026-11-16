-- Single-dispatch Central journal for non-sale native commands. Sales retain
-- their dedicated checkout journal. No browser execution grant.
begin;
create table private.totus_tpv_native_commands (
 id uuid primary key,
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 command text not null check(command in ('setup.qa','cart.prepare','cart.quote','stock.receive')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 status text not null default 'dispatched' check(status in ('dispatched','uncertain','verified')),
 result jsonb check(jsonb_typeof(result)='object'),
 reason text,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check(status<>'verified' or result is not null)
);
create index totus_tpv_native_commands_session on private.totus_tpv_native_commands((scope->>'sessionId'),created_at);
alter table private.totus_tpv_native_commands enable row level security;
create policy tpv_native_command_server on private.totus_tpv_native_commands to service_role using(true) with check(true);
revoke all on private.totus_tpv_native_commands from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_native_commands to service_role;
create function public.totus_tpv_check(p_scope jsonb,p_action text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin perform private.totus_tpv_authorize(p_scope,p_action);return true;end $$;
create function public.totus_tpv_native_command(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_native_commands; won boolean:=false; command_name text;
begin
 if p_action not in ('claim','get','complete','uncertain') or p_id is null or jsonb_typeof(p_data) is distinct from 'object'
  then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
 select * into r from private.totus_tpv_native_commands where id=p_id;
 command_name:=case when p_action='claim' then p_data->>'command' else r.command end;
 if command_name='setup.qa' then
  if p_scope->>'environment' is distinct from 'qa' or p_scope->>'connectionId' is distinct from 'b554f6cc-4df1-412b-b063-e1cbd82d9e66'
   or not exists(select 1 from public.profiles actor join public.team_members t on lower(t.email)=lower(actor.email)
    where actor.id=(p_scope->>'actorId')::uuid and actor.active and t.active and t.role='admin'
     and private.totus_module_can(actor.email,'configuracion','edit'))
   or not exists(select 1 from private.totus_api_connections c join private.totus_websites w on w.connection_id=c.id
    join public.ops_stores s on s.id=(p_scope->>'storeId')::uuid and s.active
    join public.ops_cash_drawers d on d.id=(p_scope->>'drawerId')::uuid and d.store_id=s.id and d.active
    where c.id=(p_scope->>'connectionId')::uuid and c.revision=(p_scope->>'connectionRevision')::bigint
     and c.verified_revision=c.revision and c.enabled and c.real_data_authorized and c.protocol='prestashop'
     and w.status='active' and w.origin='https://preproduccion.hortimatic.com' and w.include_in_totals=false
     and (w.business_id is null or w.business_id=s.id)) then raise exception 'TPV_CONFIGURATION_FORBIDDEN';end if;
 else
  perform private.totus_tpv_authorize(p_scope,case when p_action='claim' then 'sell' else 'reconcile' end);
 end if;
 if p_action='claim' then
  if coalesce(p_data->>'command','') not in ('setup.qa','cart.prepare','cart.quote','stock.receive')
   or jsonb_typeof(p_data->'payload') is distinct from 'object' or length(p_data::text)>65536
   or (p_data-array['command','payload'])<>'{}'::jsonb then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
  if p_data->>'command'='stock.receive' and not private.totus_module_can(
    (select email from public.profiles where id=(p_scope->>'actorId')::uuid),'productos','edit')
   then raise exception 'TPV_STOCK_FORBIDDEN';end if;
  if p_data->>'command'='cart.prepare' and ((p_data->'payload') ? 'adjustment' or (p_data->'payload') ? 'coupon'
   or exists(select 1 from jsonb_array_elements(p_data->'payload'->'lines') l where l ? 'discount'))
   and not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit')
   then raise exception 'TPV_DISCOUNT_FORBIDDEN';end if;
  insert into private.totus_tpv_native_commands(id,scope,command,payload)
   values(p_id,p_scope,p_data->>'command',p_data->'payload') on conflict(id) do nothing;
  won:=found;
 end if;
 select * into r from private.totus_tpv_native_commands where id=p_id for update;
 if not found then return null;end if;
 if r.scope<>p_scope or (p_action='claim' and (r.command is distinct from p_data->>'command' or r.payload is distinct from p_data->'payload'))
  then raise exception 'TPV_NATIVE_REQUEST_ALREADY_BOUND';end if;
 if p_action='complete' then
  if jsonb_typeof(p_data->'result') is distinct from 'object' or p_data->'result'->'verified' is distinct from 'true'::jsonb
   or p_data->'result'->>'native_reference' is null or length(p_data::text)>262144 then raise exception 'TPV_NATIVE_READBACK_REQUIRED';end if;
  if r.status='verified' and r.result is distinct from p_data->'result' then raise exception 'TPV_NATIVE_RESULT_CHANGED';end if;
  update private.totus_tpv_native_commands set status='verified',result=p_data->'result',reason=null,updated_at=clock_timestamp() where id=p_id returning * into r;
 elsif p_action='uncertain' and r.status<>'verified' then
  update private.totus_tpv_native_commands set status='uncertain',reason='TPV_NATIVE_RESULT_UNCERTAIN',updated_at=clock_timestamp() where id=p_id returning * into r;
 end if;
 return jsonb_build_object('id',r.id,'scope',r.scope,'command',r.command,'payload',r.payload,'status',r.status,'result',r.result,'won',won);
end $$;
revoke all on function public.totus_tpv_check(jsonb,text),public.totus_tpv_native_command(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_check(jsonb,text),public.totus_tpv_native_command(text,uuid,jsonb,jsonb) to service_role;
commit;
