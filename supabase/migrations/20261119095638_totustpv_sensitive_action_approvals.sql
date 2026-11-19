begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_sensitive_settings(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 require_refund boolean not null default false,require_price boolean not null default false,
 revision bigint not null check(revision>0),updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default clock_timestamp(),primary key(connection_id,shop_id,drawer_id));
alter table private.totus_tpv_sensitive_settings enable row level security;
revoke all on private.totus_tpv_sensitive_settings from public,anon,authenticated,service_role;
grant select on private.totus_tpv_sensitive_settings to service_role;
create policy tpv_sensitive_settings_service on private.totus_tpv_sensitive_settings for select to service_role using(true);

create function totus_tpv_internal.sensitive_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();s private.totus_tpv_sensitive_settings;refund boolean;price boolean;rev bigint;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_SENSITIVE_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['requireRefund','requirePrice','expectedRevision']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'requireRefund') is distinct from 'boolean' or jsonb_typeof(p_settings->'requirePrice') is distinct from 'boolean'
   or jsonb_typeof(p_settings->'expectedRevision') is distinct from 'number' or coalesce(p_settings->>'expectedRevision','')!~'^(0|[1-9][0-9]{0,14})$'
   then raise exception 'TPV_SENSITIVE_SETTINGS_INVALID';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('tpv-sensitive:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
 select * into s from private.totus_tpv_sensitive_settings where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 refund:=coalesce(s.require_refund,false);price:=coalesce(s.require_price,false);rev:=coalesce(s.revision,0);
 if p_settings is not null and (refund is distinct from (p_settings->>'requireRefund')::boolean or price is distinct from (p_settings->>'requirePrice')::boolean) then
  if (p_settings->>'expectedRevision')::bigint<>rev then raise exception 'TPV_SENSITIVE_SETTINGS_STALE';end if;
  refund:=(p_settings->>'requireRefund')::boolean;price:=(p_settings->>'requirePrice')::boolean;rev:=rev+1;
  insert into private.totus_tpv_sensitive_settings(connection_id,shop_id,drawer_id,require_refund,require_price,revision,updated_by)
   values(p_connection,p_shop,p_drawer,refund,price,rev,actor)
  on conflict(connection_id,shop_id,drawer_id) do update set require_refund=excluded.require_refund,require_price=excluded.require_price,
   revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp();
 end if;
 return jsonb_build_object('requireRefund',refund,'requirePrice',price,'revision',rev);
end $$;
revoke all on function totus_tpv_internal.sensitive_settings(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function totus_tpv_internal.sensitive_settings(uuid,bigint,uuid,jsonb) to authenticated;
create function public.totus_tpv_sensitive_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.sensitive_settings(p_connection,p_shop,p_drawer,p_settings);$$;
revoke all on function public.totus_tpv_sensitive_settings(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function public.totus_tpv_sensitive_settings(uuid,bigint,uuid,jsonb) to authenticated;

-- No passwords, access/refresh tokens or caller-supplied commercial snapshots.
create table private.totus_tpv_action_approvals(
 id uuid primary key,operation_id uuid not null,kind text not null check(kind in ('refund','price')),
 actor_id uuid not null references public.profiles(id),scope jsonb not null,
 settings_revision bigint not null,fingerprint text not null check(fingerprint~'^[a-f0-9]{64}$'),
 proof_session_id uuid not null unique,password_at bigint not null,expires_at bigint not null,
 issued_at timestamptz not null default clock_timestamp(),consumed_at timestamptz);
alter table private.totus_tpv_action_approvals enable row level security;
revoke all on private.totus_tpv_action_approvals from public,anon,authenticated,service_role;
grant select on private.totus_tpv_action_approvals to service_role;
create policy tpv_action_approvals_service on private.totus_tpv_action_approvals for select to service_role using(true);

create function totus_tpv_internal.sensitive_binding(p_kind text,p_operation uuid,p_scope jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s private.totus_tpv_sensitive_settings;sale private.totus_tpv_operations;refund private.totus_tpv_refunds;snapshot jsonb;required boolean;
begin
 if p_kind is null or p_kind not in ('refund','price') or p_operation is null then raise exception 'TPV_APPROVAL_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,'sell');
 perform pg_advisory_xact_lock(hashtextextended('tpv-sensitive:'||(p_scope->>'connectionId')::uuid::text||':'||(p_scope->>'shopId')::bigint::text||':'||(p_scope->>'drawerId')::uuid::text,0));
 select * into s from private.totus_tpv_sensitive_settings where connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 if p_kind='refund' then
  if not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit') then raise exception 'TPV_REFUND_FORBIDDEN';end if;
  select * into refund from private.totus_tpv_refunds where id=p_operation for update;
  if not found then raise exception 'TPV_REFUND_NOT_FOUND';end if;
  if refund.scope<>p_scope then raise exception 'TPV_APPROVAL_SCOPE_INVALID';end if;
  if refund.status<>'ready' then return null;end if;
  snapshot:=jsonb_build_object('scope',refund.scope,'intent',refund.intent,'lineAmounts',refund.line_amounts,'totalCents',refund.total_cents);
  required:=coalesce(s.require_refund,false);
 else
  select * into sale from private.totus_tpv_operations where id=p_operation for update;
  if not found then raise exception 'TPV_OPERATION_NOT_FOUND';end if;
  if private.totus_tpv_operation_json(sale)->'scope'<>p_scope then raise exception 'TPV_APPROVAL_SCOPE_INVALID';end if;
  if sale.status<>'ready' then return null;end if;
  snapshot:=jsonb_build_object('scope',private.totus_tpv_operation_json(sale)->'scope','expected',sale.expected,'revision',sale.revision,'quoteExpiresAt',sale.quote_expires_at);
  required:=coalesce(s.require_price,false) and sale.expected->'hasPriceOverride'='true'::jsonb;
 end if;
 return jsonb_build_object('required',coalesce(required,false),'revision',coalesce(s.revision,0),'fingerprint',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'));
end $$;
revoke all on function totus_tpv_internal.sensitive_binding(text,uuid,jsonb) from public,anon,authenticated,service_role;

create function public.totus_tpv_issue_action_approval(p_id uuid,p_kind text,p_operation uuid,p_scope jsonb,p_proof jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare binding jsonb;a private.totus_tpv_action_approvals;now_seconds bigint:=floor(extract(epoch from clock_timestamp()));password_time bigint;expiry bigint;proof_session uuid;
begin
 binding:=totus_tpv_internal.sensitive_binding(p_kind,p_operation,p_scope);
 if binding is null then raise exception 'TPV_APPROVAL_OPERATION_CLOSED';end if;
 if binding->'required' is distinct from 'true'::jsonb then raise exception 'TPV_APPROVAL_NOT_REQUIRED';end if;
 if p_id is null or jsonb_typeof(p_proof) is distinct from 'object' or p_proof-array['actorId','proofSessionId','passwordAt','expiresAt']<>'{}'::jsonb
  or p_proof->>'actorId' is distinct from p_scope->>'actorId' or coalesce(p_proof->>'proofSessionId','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  or jsonb_typeof(p_proof->'passwordAt') is distinct from 'number' or jsonb_typeof(p_proof->'expiresAt') is distinct from 'number'
  or coalesce(p_proof->>'passwordAt','')!~'^[1-9][0-9]{0,11}$' or coalesce(p_proof->>'expiresAt','')!~'^[1-9][0-9]{0,11}$'
  then raise exception 'TPV_REAUTH_REQUIRED';end if;
 password_time:=(p_proof->>'passwordAt')::bigint;expiry:=(p_proof->>'expiresAt')::bigint;proof_session:=(p_proof->>'proofSessionId')::uuid;
 if password_time>now_seconds+5 or now_seconds-password_time>120 or expiry<=now_seconds or expiry>password_time+120 then raise exception 'TPV_REAUTH_REQUIRED';end if;
 select * into a from private.totus_tpv_action_approvals where id=p_id for update;
 if found then
  if a.operation_id<>p_operation or a.kind<>p_kind or a.scope<>p_scope or a.fingerprint<>binding->>'fingerprint' or a.settings_revision<>(binding->>'revision')::bigint
   or a.proof_session_id<>proof_session or a.password_at<>password_time or a.expires_at<>expiry then raise exception 'TPV_APPROVAL_ALREADY_BOUND';end if;
 else
  if not exists(select 1 from auth.sessions where id=proof_session and user_id=(p_scope->>'actorId')::uuid) then raise exception 'TPV_REAUTH_REQUIRED';end if;
  begin
   insert into private.totus_tpv_action_approvals(id,operation_id,kind,actor_id,scope,settings_revision,fingerprint,proof_session_id,password_at,expires_at)
    values(p_id,p_operation,p_kind,(p_scope->>'actorId')::uuid,p_scope,(binding->>'revision')::bigint,binding->>'fingerprint',proof_session,password_time,expiry) returning * into a;
  exception when unique_violation then raise exception 'TPV_APPROVAL_PROOF_USED';end;
 end if;
 return jsonb_build_object('approvalId',a.id,'operationId',a.operation_id,'kind',a.kind,'expiresAt',a.expires_at*1000);
end $$;
revoke all on function public.totus_tpv_issue_action_approval(uuid,text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_issue_action_approval(uuid,text,uuid,jsonb,jsonb) to service_role;

create function totus_tpv_internal.check_action_approval(p_kind text,p_operation uuid,p_scope jsonb,p_approval jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare binding jsonb;a private.totus_tpv_action_approvals;
begin
 binding:=totus_tpv_internal.sensitive_binding(p_kind,p_operation,p_scope);
 if binding is null or binding->'required' is distinct from 'true'::jsonb then return null;end if;
 if jsonb_typeof(p_approval) is distinct from 'string' or coalesce(p_approval#>>'{}','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' then raise exception 'TPV_ACTION_APPROVAL_REQUIRED';end if;
 select * into a from private.totus_tpv_action_approvals where id=(p_approval#>>'{}')::uuid for update;
 if not found or a.kind<>p_kind or a.operation_id<>p_operation or a.actor_id<>(p_scope->>'actorId')::uuid or a.scope<>p_scope
  or a.settings_revision<>(binding->>'revision')::bigint or a.fingerprint<>binding->>'fingerprint' or a.consumed_at is not null
  or a.expires_at<=floor(extract(epoch from clock_timestamp())) then raise exception 'TPV_ACTION_APPROVAL_REQUIRED';end if;
 return a.id;
end $$;
revoke all on function totus_tpv_internal.check_action_approval(text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;

-- Wrap existing claims, preserving every previous validation, result and replay.
alter function public.totus_tpv_journal(text,uuid,jsonb,jsonb) set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_journal(text,uuid,jsonb,jsonb) rename to journal_before_sensitive;
revoke all on function totus_tpv_internal.journal_before_sensitive(text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.totus_tpv_journal(p_action text,p_operation_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare approval uuid;result jsonb;
begin
 if p_action='claim' then approval:=totus_tpv_internal.check_action_approval('price',p_operation_id,p_scope,p_data->'approvalId');end if;
 result:=totus_tpv_internal.journal_before_sensitive(p_action,p_operation_id,p_scope,p_data-'approvalId');
 if p_action='claim' and result->'won'='true'::jsonb and approval is not null then update private.totus_tpv_action_approvals set consumed_at=clock_timestamp() where id=approval;end if;
 return result;
end $$;
revoke all on function public.totus_tpv_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_journal(text,uuid,jsonb,jsonb) to service_role;
alter function public.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) set schema totus_tpv_internal;
alter function totus_tpv_internal.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) rename to refund_before_sensitive;
revoke all on function totus_tpv_internal.refund_before_sensitive(text,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.totus_tpv_refund_journal(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare approval uuid;result jsonb;
begin
 if p_action='claim' then approval:=totus_tpv_internal.check_action_approval('refund',p_id,p_scope,p_data->'approvalId');end if;
 result:=totus_tpv_internal.refund_before_sensitive(p_action,p_id,p_scope,p_data-'approvalId');
 if p_action='claim' and result->'won'='true'::jsonb and approval is not null then update private.totus_tpv_action_approvals set consumed_at=clock_timestamp() where id=approval;end if;
 return result;
end $$;
revoke all on function public.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_refund_journal(text,uuid,jsonb,jsonb) to service_role;
commit;
