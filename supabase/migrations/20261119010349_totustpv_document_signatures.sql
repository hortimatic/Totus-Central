begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_signature_policies(
 connection_id uuid not null,shop_id bigint not null,drawer_id uuid not null,
 enabled boolean not null default false,acceptance_text text not null default '',updated_by uuid not null,updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,drawer_id),check(char_length(acceptance_text)<=500));
alter table private.totus_tpv_signature_policies enable row level security;
create policy tpv_signature_policy_service_read on private.totus_tpv_signature_policies for select to service_role using(true);
revoke all on private.totus_tpv_signature_policies from public,anon,authenticated;
grant select on private.totus_tpv_signature_policies to service_role;
create or replace function totus_tpv_internal.signature_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();r private.totus_tpv_signature_policies;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 perform public.totus_tpv_workspace_preferences(p_connection,p_shop,p_drawer,null);
 if p_settings is not null then
  if not private.totus_can('ventas','edit') then raise exception 'TPV_SIGNATURE_POLICY_FORBIDDEN';end if;
  perform pg_advisory_xact_lock(hashtextextended('tpv-signature-policy:'||p_connection::text||':'||p_shop::text||':'||p_drawer::text,0));
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['enabled','acceptanceText']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'enabled') is distinct from 'boolean' or jsonb_typeof(p_settings->'acceptanceText') is distinct from 'string'
   or char_length(p_settings->>'acceptanceText')>500 or p_settings->>'acceptanceText'~'[[:cntrl:]]' then raise exception 'TPV_SIGNATURE_POLICY_INVALID';end if;
  insert into private.totus_tpv_signature_policies(connection_id,shop_id,drawer_id,enabled,acceptance_text,updated_by)
   values(p_connection,p_shop,p_drawer,(p_settings->>'enabled')::boolean,p_settings->>'acceptanceText',actor)
   on conflict(connection_id,shop_id,drawer_id) do update set enabled=excluded.enabled,acceptance_text=excluded.acceptance_text,updated_by=actor,updated_at=clock_timestamp();
 end if;
 select * into r from private.totus_tpv_signature_policies where connection_id=p_connection and shop_id=p_shop and drawer_id=p_drawer;
 return jsonb_build_object('enabled',coalesce(r.enabled,false),'acceptanceText',coalesce(r.acceptance_text,''));
end $$;
revoke all on function totus_tpv_internal.signature_policy(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function totus_tpv_internal.signature_policy(uuid,bigint,uuid,jsonb) to authenticated;
create or replace function public.totus_tpv_signature_policy(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language sql security invoker set search_path='' as $$select totus_tpv_internal.signature_policy(p_connection,p_shop,p_drawer,p_settings);$$;
revoke all on function public.totus_tpv_signature_policy(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_signature_policy(uuid,bigint,uuid,jsonb) to authenticated;
create table private.totus_tpv_signatures(
 id uuid primary key,connection_id uuid not null,shop_id bigint not null,store_id uuid not null,drawer_id uuid not null,session_id uuid not null,
 operation_id uuid not null references private.totus_tpv_operations(id),order_id bigint not null,actor_id uuid not null,
 actor_name text not null,acceptance_text text not null,original_data jsonb not null,
 status text not null default 'prepared' check(status in ('prepared','signed','cancelled')),ink jsonb,signed_data jsonb,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null default clock_timestamp()+interval '10 minutes',signed_at timestamptz,
 check((status='signed' and ink is not null and signed_data is not null and signed_at is not null) or (status<>'signed' and ink is null and signed_data is null and signed_at is null)));
create unique index tpv_signature_one_signed_invoice on private.totus_tpv_signatures(operation_id) where status='signed';
alter table private.totus_tpv_signatures enable row level security;
create policy tpv_signature_service on private.totus_tpv_signatures to service_role using(true) with check(true);
revoke all on private.totus_tpv_signatures from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_signatures to service_role;
create or replace function private.totus_tpv_signature_row(r private.totus_tpv_signatures) returns jsonb
language sql security invoker set search_path='' as $$select jsonb_build_object('id',r.id,'operationId',r.operation_id,'orderId',r.order_id,'sessionId',r.session_id,'actorName',r.actor_name,'acceptanceText',r.acceptance_text,'original',r.original_data,'status',r.status,'ink',r.ink,'signed',r.signed_data,'createdAt',r.created_at,'expiresAt',r.expires_at,'signedAt',r.signed_at);$$;
revoke all on function private.totus_tpv_signature_row(private.totus_tpv_signatures) from public,anon,authenticated;
grant execute on function private.totus_tpv_signature_row(private.totus_tpv_signatures) to service_role;
create or replace function public.totus_tpv_signature_journal(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor uuid:=(p_scope->>'actorId')::uuid;r private.totus_tpv_signatures;sale private.totus_tpv_operations;policy private.totus_tpv_signature_policies;doc jsonb;points integer:=0;distance numeric:=0;stroke jsonb;point jsonb;previous_point jsonb;
begin
 if p_action not in ('find','get','prepare','sign','cancel') or p_id is null or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'TPV_SIGNATURE_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action in ('get','find') then 'read' else 'sell' end);
 if p_action not in ('get','find') then perform pg_advisory_xact_lock(hashtextextended('tpv-signature-policy:'||(p_scope->>'connectionId')||':'||(p_scope->>'shopId')||':'||(p_scope->>'drawerId'),0));end if;
 if p_action='find' then
  select * into r from private.totus_tpv_signatures where operation_id=p_id and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and store_id=(p_scope->>'storeId')::uuid and drawer_id=(p_scope->>'drawerId')::uuid and (status='signed' or status='prepared' and actor_id=actor and expires_at>clock_timestamp()) order by case when status='signed' then 0 else 1 end,created_at desc,id desc limit 1;
  if not found then return null;end if;return private.totus_tpv_signature_row(r);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('totus-tpv-signature:'||p_id::text,0));
 select * into r from private.totus_tpv_signatures where id=p_id for update;
 if found then
  if r.connection_id<>(p_scope->>'connectionId')::uuid or r.shop_id<>(p_scope->>'shopId')::bigint or r.store_id<>(p_scope->>'storeId')::uuid or r.drawer_id<>(p_scope->>'drawerId')::uuid or (r.status<>'signed' and r.actor_id<>actor) then raise exception 'TPV_SIGNATURE_FORBIDDEN';end if;
  if p_action='get' then return private.totus_tpv_signature_row(r);end if;
  if r.actor_id<>actor or r.session_id<>(p_scope->>'sessionId')::uuid then raise exception 'TPV_SIGNATURE_FORBIDDEN';end if;
  if p_action='prepare' then
   if p_data->>'saleId' is distinct from r.operation_id::text or p_data->'original'->>'sha256' is distinct from r.original_data->>'sha256' then raise exception 'TPV_SIGNATURE_ALREADY_BOUND';end if;
   return private.totus_tpv_signature_row(r);
  end if;
  if p_action='cancel' then
   if r.status='signed' then raise exception 'TPV_SIGNATURE_ALREADY_SIGNED';end if;
   update private.totus_tpv_signatures set status='cancelled' where id=r.id returning * into r;return private.totus_tpv_signature_row(r);
  end if;
  if r.status='signed' then
   if r.ink is distinct from p_data->'ink' then raise exception 'TPV_SIGNATURE_ALREADY_BOUND';end if;
   return private.totus_tpv_signature_row(r);
  end if;
  if r.status<>'prepared' or r.expires_at<=clock_timestamp() then raise exception 'TPV_SIGNATURE_EXPIRED';end if;
  select * into policy from private.totus_tpv_signature_policies where connection_id=r.connection_id and shop_id=r.shop_id and drawer_id=r.drawer_id;
  if policy.enabled is distinct from true or policy.acceptance_text<>r.acceptance_text then raise exception 'TPV_SIGNATURE_POLICY_CHANGED';end if;
  if p_data-array['ink','signed','signedAt']<>'{}'::jsonb or jsonb_typeof(p_data->'ink') is distinct from 'object' or (p_data->'ink')-array['width','height','strokes']<>'{}'::jsonb or p_data->'ink'->'width' is distinct from '1000'::jsonb or p_data->'ink'->'height' is distinct from '400'::jsonb or jsonb_typeof(p_data->'ink'->'strokes') is distinct from 'array' or jsonb_array_length(p_data->'ink'->'strokes') not between 1 and 128 then raise exception 'TPV_SIGNATURE_INK_INVALID';end if;
  for stroke in select value from jsonb_array_elements(p_data->'ink'->'strokes') loop
   if jsonb_typeof(stroke)<>'array' or jsonb_array_length(stroke)<2 then raise exception 'TPV_SIGNATURE_INK_INVALID';end if;
   previous_point:=null;
   for point in select value from jsonb_array_elements(stroke) loop
    points:=points+1;
    if points>4096 or jsonb_typeof(point)<>'array' or jsonb_array_length(point)<>2 or jsonb_typeof(point->0) is distinct from 'number' or jsonb_typeof(point->1) is distinct from 'number' or coalesce(point->>0,'')!~'^[0-9]{1,4}$' or coalesce(point->>1,'')!~'^[0-9]{1,3}$' or (point->>0)::integer>1000 or (point->>1)::integer>400 then raise exception 'TPV_SIGNATURE_INK_INVALID';end if;
    if previous_point is not null then distance:=distance+sqrt(power((point->>0)::numeric-(previous_point->>0)::numeric,2)+power((point->>1)::numeric-(previous_point->>1)::numeric,2));end if;previous_point:=point;
   end loop;
  end loop;
  if distance<12 then raise exception 'TPV_SIGNATURE_INK_INVALID';end if;
  doc:=p_data->'signed';
  if jsonb_typeof(doc) is distinct from 'object' or doc-array['mime','filename','base64','sha256','originalSha256','originalPages','pages']<>'{}'::jsonb or doc->>'mime' is distinct from 'application/pdf' or doc->>'filename' is distinct from ('totus-invoice-'||r.order_id::text||'-firmada.pdf') or doc->>'originalSha256' is distinct from r.original_data->>'sha256' or coalesce(doc->>'sha256','')!~'^[a-f0-9]{64}$' or left(doc->>'base64',7) is distinct from 'JVBERi0' or char_length(doc->>'base64')>3000000 or coalesce(doc->>'base64','')!~'^[A-Za-z0-9+/]+={0,2}$' or encode(sha256(decode(doc->>'base64','base64')),'hex')<>doc->>'sha256' or coalesce(p_data->>'signedAt','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$' or abs(extract(epoch from (clock_timestamp()-(p_data->>'signedAt')::timestamptz)))>60 then raise exception 'TPV_SIGNATURE_DOCUMENT_INVALID';end if;
  update private.totus_tpv_signatures set ink=p_data->'ink',signed_data=doc,signed_at=(p_data->>'signedAt')::timestamptz,status='signed' where id=r.id returning * into r;
  return private.totus_tpv_signature_row(r);
 end if;
 if p_action='get' then return null;end if;
 if p_action<>'prepare' then raise exception 'TPV_SIGNATURE_NOT_FOUND';end if;
 if p_data-array['saleId','original']<>'{}'::jsonb then raise exception 'TPV_SIGNATURE_REQUEST_INVALID';end if;
 select * into sale from private.totus_tpv_operations where id=(p_data->>'saleId')::uuid and status='confirmed' and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and store_id=(p_scope->>'storeId')::uuid and drawer_id=(p_scope->>'drawerId')::uuid;
 if not found then raise exception 'TPV_SIGNATURE_SALE_FORBIDDEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus-tpv-signature-sale:'||sale.id::text,0));
 select * into r from private.totus_tpv_signatures where operation_id=sale.id and status='signed';
 if found then return private.totus_tpv_signature_row(r);end if;
 select * into policy from private.totus_tpv_signature_policies where connection_id=sale.connection_id and shop_id=sale.shop_id and drawer_id=sale.drawer_id;
 if policy.enabled is distinct from true then raise exception 'TPV_SIGNATURE_DISABLED';end if;
 doc:=p_data->'original';
 if jsonb_typeof(doc) is distinct from 'object' or doc-array['kind','existing_document','mime','order_id','filename','base64','sha256']<>'{}'::jsonb or doc->>'kind' is distinct from 'invoice' or doc->>'mime' is distinct from 'application/pdf' or doc->'existing_document' is distinct from 'true'::jsonb or doc->'order_id' is distinct from to_jsonb(sale.order_id) or doc->>'filename' is distinct from ('totus-invoice-'||sale.order_id::text||'.pdf') or coalesce(doc->>'sha256','')!~'^[a-f0-9]{64}$' or left(doc->>'base64',7) is distinct from 'JVBERi0' or char_length(doc->>'base64')>1900000 or coalesce(doc->>'base64','')!~'^[A-Za-z0-9+/]+={0,2}$' or encode(sha256(decode(doc->>'base64','base64')),'hex')<>doc->>'sha256' then raise exception 'TPV_SIGNATURE_DOCUMENT_INVALID';end if;
 insert into private.totus_tpv_signatures(id,connection_id,shop_id,store_id,drawer_id,session_id,operation_id,order_id,actor_id,actor_name,acceptance_text,original_data)
  values(p_id,sale.connection_id,sale.shop_id,sale.store_id,sale.drawer_id,(p_scope->>'sessionId')::uuid,sale.id,sale.order_id,actor,(select coalesce(nullif(full_name,''),'Operador') from public.profiles where id=actor),policy.acceptance_text,doc) returning * into r;
 return private.totus_tpv_signature_row(r);
end $$;
revoke all on function public.totus_tpv_signature_journal(text,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_signature_journal(text,uuid,jsonb,jsonb) to service_role;
commit;
