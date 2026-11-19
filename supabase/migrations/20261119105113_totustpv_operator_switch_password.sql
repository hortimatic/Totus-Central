begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_operator_switch_settings(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 require_before_switch boolean not null default false,revision bigint not null check(revision>0),
 updated_by uuid not null references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id));
alter table private.totus_tpv_operator_switch_settings enable row level security;
revoke all on private.totus_tpv_operator_switch_settings from public,anon,authenticated,service_role;
grant select on private.totus_tpv_operator_switch_settings to service_role;
create policy tpv_operator_switch_settings_service on private.totus_tpv_operator_switch_settings for select to service_role using(true);
-- Separate RPC and revision preserve strict old responses and prevent one
-- settings form from making another, unrelated form stale after its own save.
create function totus_tpv_internal.operator_switch_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();s private.totus_tpv_operator_switch_settings;required boolean;rev bigint;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_OPERATOR_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['requireBeforeSwitch','expectedRevision']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'requireBeforeSwitch') is distinct from 'boolean' or jsonb_typeof(p_settings->'expectedRevision') is distinct from 'number'
   or coalesce(p_settings->>'expectedRevision','')!~'^(0|[1-9][0-9]{0,14})$' then raise exception 'TPV_OPERATOR_SETTINGS_INVALID';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('tpv-operator-switch-policy:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
 select * into s from private.totus_tpv_operator_switch_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 required:=coalesce(s.require_before_switch,false);rev:=coalesce(s.revision,0);
 if p_settings is not null and required is distinct from (p_settings->>'requireBeforeSwitch')::boolean then
  if (p_settings->>'expectedRevision')::bigint<>rev then raise exception 'TPV_OPERATOR_SETTINGS_STALE';end if;
  required:=(p_settings->>'requireBeforeSwitch')::boolean;rev:=rev+1;
  insert into private.totus_tpv_operator_switch_settings(connection_id,shop_id,drawer_id,require_before_switch,revision,updated_by)
   values(p_connection,p_shop,p_drawer,required,rev,actor)
  on conflict(connection_id,shop_id,drawer_id) do update set require_before_switch=excluded.require_before_switch,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('requireBeforeSwitch',required,'revision',rev);
end $$;
revoke all on function totus_tpv_internal.operator_switch_policy(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function totus_tpv_internal.operator_switch_policy(uuid,bigint,uuid,jsonb) to authenticated;
create function public.totus_tpv_operator_switch_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.operator_switch_policy(p_connection,p_shop,p_drawer,p_settings);$$;
revoke all on function public.totus_tpv_operator_switch_policy(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function public.totus_tpv_operator_switch_policy(uuid,bigint,uuid,jsonb) to authenticated;

-- Read-only proof check after the server has verified both signed Auth tokens.
-- A handoff never grants a new account access: that person must sign in with
-- their own credentials. No cash session, sale, approval or ledger is mutated.
create function public.totus_tpv_operator_switch_proof(p_actor uuid,p_proof jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare now_seconds bigint:=floor(extract(epoch from clock_timestamp()));password_time bigint;expiry bigint;proof_session uuid;
begin
 if p_actor is null or jsonb_typeof(p_proof) is distinct from 'object' or p_proof-array['actorId','proofSessionId','passwordAt','expiresAt']<>'{}'::jsonb
  or p_proof->>'actorId' is distinct from p_actor::text or coalesce(p_proof->>'proofSessionId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(p_proof->'passwordAt') is distinct from 'number' or jsonb_typeof(p_proof->'expiresAt') is distinct from 'number'
  or coalesce(p_proof->>'passwordAt','')!~'^[1-9][0-9]{0,11}$' or coalesce(p_proof->>'expiresAt','')!~'^[1-9][0-9]{0,11}$'
  then raise exception 'TPV_REAUTH_REQUIRED';end if;
 password_time:=(p_proof->>'passwordAt')::bigint;expiry:=(p_proof->>'expiresAt')::bigint;proof_session:=(p_proof->>'proofSessionId')::uuid;
 if password_time>now_seconds+5 or now_seconds-password_time>120 or expiry<=now_seconds or expiry>password_time+120
  or not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) and t.active where p.id=p_actor and p.active)
  or not exists(select 1 from auth.sessions where id=proof_session and user_id=p_actor) then raise exception 'TPV_REAUTH_REQUIRED';end if;
 return true;
end $$;
revoke all on function public.totus_tpv_operator_switch_proof(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_operator_switch_proof(uuid,jsonb) to service_role;
commit;
