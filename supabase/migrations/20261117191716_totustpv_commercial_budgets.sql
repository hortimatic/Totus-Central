begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- Commercial documents are not orders, invoices, receipts or cash movements.
create table private.totus_tpv_budgets (
 id uuid primary key,number bigint generated always as identity unique,
 reference text generated always as ('P-'||lpad(number::text,greatest(6,length(number::text)),'0')) stored unique,
 connection_id uuid not null references private.totus_api_connections(id),shop_id bigint not null check(shop_id>0),
 store_id uuid not null references public.ops_stores(id),drawer_id uuid not null references public.ops_cash_drawers(id),
 environment text not null check(environment='qa'),created_by uuid not null references public.profiles(id),
 title text not null check(length(title) between 1 and 120),public_note text not null default '' check(length(public_note)<=1000),
 store_name text not null,payload jsonb not null,snapshot jsonb not null,
 cart_command_id uuid not null references private.totus_tpv_native_commands(id),
 quote_command_id uuid not null unique references private.totus_tpv_native_commands(id),request_data jsonb not null,
 version bigint not null default 1,status text not null default 'saved' check(status in ('saved','checkout','sold','cancelled')),
 draft_id uuid unique references private.totus_tpv_drafts(id),order_id bigint,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 valid_until timestamptz not null,check(valid_until>created_at),check(status<>'sold' or order_id is not null)
);
create index tpv_budget_store on private.totus_tpv_budgets(connection_id,shop_id,store_id,created_at desc,id desc);
alter table private.totus_tpv_budgets enable row level security;
create policy tpv_budget_server on private.totus_tpv_budgets to service_role using(true) with check(true);
revoke all on private.totus_tpv_budgets from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_budgets to service_role;
grant usage on sequence private.totus_tpv_budgets_number_seq to service_role;

create function private.totus_tpv_budget_json(b private.totus_tpv_budgets,full_document boolean default true) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'reference',b.reference,'title',b.title,'storeName',b.store_name,'drawerId',b.drawer_id,
  'version',b.version,'status',b.status,'createdAt',b.created_at,'validUntil',b.valid_until,'expired',b.valid_until<=clock_timestamp(),
  'currency',b.snapshot->>'currency','totalCents',b.snapshot->'totalCents','draftId',b.draft_id,'orderId',b.order_id)
  ||case when full_document then jsonb_build_object('publicNote',b.public_note,'payload',b.payload,'snapshot',b.snapshot-array['nativeCartId','nativeQuoteFingerprint']) else '{}'::jsonb end
$$;

create function public.totus_tpv_budgets(p_action text,p_scope jsonb,p_id uuid default null,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b private.totus_tpv_budgets;c private.totus_tpv_native_commands;q private.totus_tpv_native_commands;
 actor uuid:=(p_scope->>'actorId')::uuid;payload jsonb;snapshot jsonb;line jsonb;native_line jsonb;source_line jsonb;field text;seen text[]:='{}';identity text;options jsonb;
 expires_ms numeric;days integer;results jsonb;cursor_time timestamptz;cursor_id uuid;page_limit integer:=30;search_text text:='';
begin
 perform private.totus_tpv_authorize(p_scope,'read');
 if p_action not in ('create','list','get','recover') or p_action is null or jsonb_typeof(p_data) is distinct from 'object' or length(p_data::text)>600000 then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 if p_action='list' then
  if p_data-array['cursor','limit','search']<>'{}'::jsonb then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
  if p_data?'limit' then
   if jsonb_typeof(p_data->'limit') is distinct from 'number' or p_data->>'limit' !~ '^[1-9][0-9]{0,2}$' then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
   page_limit:=(p_data->>'limit')::integer;if page_limit>100 then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
  end if;
  if p_data?'search' then if jsonb_typeof(p_data->'search') is distinct from 'string' or length(p_data->>'search')>120 then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;search_text:=btrim(p_data->>'search');end if;
  if p_data?'cursor' then
   if jsonb_typeof(p_data->'cursor') is distinct from 'object' or p_data->'cursor'-array['createdAt','id']<>'{}'::jsonb or jsonb_typeof(p_data->'cursor'->'createdAt') is distinct from 'string' or jsonb_typeof(p_data->'cursor'->'id') is distinct from 'string' then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
   cursor_time:=(p_data->'cursor'->>'createdAt')::timestamptz;cursor_id:=(p_data->'cursor'->>'id')::uuid;
  end if;
  select coalesce(jsonb_agg(private.totus_tpv_budget_json(x,false) order by x.created_at desc,x.id desc),'[]'::jsonb) into results from (
   select z.* from private.totus_tpv_budgets z where z.connection_id=(p_scope->>'connectionId')::uuid and z.shop_id=(p_scope->>'shopId')::bigint and z.store_id=(p_scope->>'storeId')::uuid and z.environment=p_scope->>'environment'
    and (cursor_time is null or (z.created_at,z.id)<(cursor_time,cursor_id)) and (search_text='' or position(lower(search_text) in lower(z.reference||' '||z.title))>0)
    order by z.created_at desc,z.id desc limit page_limit+1) x;
  return jsonb_build_object('items',case when jsonb_array_length(results)>page_limit then results-(page_limit) else results end,'hasMore',jsonb_array_length(results)>page_limit);
 end if;
 if p_id is null then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 if p_action='recover' and (p_data-array['intentHash']<>'{}'::jsonb or jsonb_typeof(p_data->'intentHash') is distinct from 'string' or p_data->>'intentHash' !~ '^[a-f0-9]{64}$') then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 if p_action='create' then perform pg_advisory_xact_lock(hashtextextended('totus-tpv-budget:'||p_id::text,0));end if;
 select * into b from private.totus_tpv_budgets where id=p_id for update;
 if found then
  if b.connection_id is distinct from (p_scope->>'connectionId')::uuid or b.shop_id is distinct from (p_scope->>'shopId')::bigint or b.store_id is distinct from (p_scope->>'storeId')::uuid or b.environment is distinct from p_scope->>'environment' then raise exception 'TPV_BUDGET_NOT_FOUND';end if;
  if p_action='create' and (b.created_by<>actor or b.request_data-'calculationExpiresAt' is distinct from p_data-'calculationExpiresAt') then raise exception 'TPV_BUDGET_ALREADY_BOUND';end if;
  if p_action='recover' and (b.created_by<>actor or p_data-array['intentHash']<>'{}'::jsonb or p_data->>'intentHash' is distinct from b.request_data->>'intentHash') then raise exception 'TPV_BUDGET_ALREADY_BOUND';end if;
  if p_action='get' and p_data<>'{}'::jsonb then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
  return private.totus_tpv_budget_json(b);
 end if;
 if p_action='recover' then return null;end if;
 if p_action<>'create' then raise exception 'TPV_BUDGET_NOT_FOUND';end if;
 if not private.totus_module_can((select email from public.profiles where id=actor),'ventas','create') then raise exception 'TPV_BUDGET_CREATE_FORBIDDEN';end if;
 if p_data-array['payload','snapshot','cartOperationId','quoteOperationId','calculationExpiresAt','validDays','title','publicNote','intentHash']<>'{}'::jsonb
  or jsonb_typeof(p_data->'intentHash') is distinct from 'string' or p_data->>'intentHash' !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(p_data->'snapshot') is distinct from 'object' or jsonb_typeof(p_data->'title') is distinct from 'string' or length(btrim(p_data->>'title')) not between 1 and 120
  or p_data->>'title' ~ '[[:cntrl:]]' or jsonb_typeof(p_data->'validDays') is distinct from 'number' or p_data->>'validDays' !~ '^[1-9][0-9]{0,2}$'
  or jsonb_typeof(p_data->'calculationExpiresAt') is distinct from 'number' or p_data->>'calculationExpiresAt' !~ '^[1-9][0-9]{0,14}$'
  or p_data?'publicNote' and (jsonb_typeof(p_data->'publicNote') is distinct from 'string' or length(p_data->>'publicNote')>1000)
  then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 days:=(p_data->>'validDays')::integer;if days>365 then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 payload:=private.totus_tpv_draft_payload(p_data->'payload');snapshot:=p_data->'snapshot';
 options:=public.totus_tpv_commercial_options(p_scope);
 if (payload?'adjustment' or payload?'coupon' or exists(select 1 from jsonb_array_elements(payload->'lines') x where x?'discount' or x?'displayName'))
  and not private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit') then raise exception 'TPV_PRICE_CHANGE_FORBIDDEN';end if;
 if exists(select 1 from jsonb_array_elements(payload->'lines') x where x->'discount'->>'kind'='price') and options->'allowPriceChanges' is distinct from 'true'::jsonb then raise exception 'TPV_PRICE_CHANGE_FORBIDDEN';end if;
 if exists(select 1 from jsonb_array_elements(payload->'lines') x where x?'displayName') and options->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
 select * into c from private.totus_tpv_native_commands where id=(p_data->>'cartOperationId')::uuid and command='cart.prepare' and status='verified' and scope=p_scope;
 if not found or c.payload->'commercial_only' is distinct from 'true'::jsonb or c.result->'commercial_only' is distinct from 'true'::jsonb or c.result->'verified' is distinct from 'true'::jsonb then raise exception 'TPV_BUDGET_NATIVE_PROOF_REQUIRED';end if;
 select * into q from private.totus_tpv_native_commands where id=(p_data->>'quoteOperationId')::uuid and command='cart.quote' and status='verified' and scope=p_scope;
 if not found or q.result->'verified' is distinct from 'true'::jsonb or q.result->'quote'->'commercial_only' is distinct from 'true'::jsonb
  or q.payload->'commercial_only' is distinct from 'true'::jsonb or q.payload->'cart_id' is distinct from c.result->'cart_id' or q.result->'quote'->'cart_id' is distinct from c.result->'cart_id'
  or snapshot->'nativeCartId' is distinct from c.result->'cart_id' or snapshot->>'nativeQuoteFingerprint' is distinct from q.result->>'quote_fingerprint'
  or snapshot->'totalCents' is distinct from q.result->'quote'->'total_cents' or snapshot->>'currency' is distinct from p_scope->>'currency'
  or jsonb_typeof(snapshot->'lines') is distinct from 'array' then raise exception 'TPV_BUDGET_NATIVE_PROOF_REQUIRED';end if;
 expires_ms:=(p_data->>'calculationExpiresAt')::numeric;
 if expires_ms<=extract(epoch from clock_timestamp())*1000 or expires_ms>(q.result->>'quoted_at')::numeric+120000 then raise exception 'TPV_NATIVE_QUOTE_EXPIRED';end if;
 if jsonb_array_length(payload->'lines')<>jsonb_array_length(c.payload->'lines') or jsonb_array_length(snapshot->'lines')<>jsonb_array_length(q.result->'quote'->'lines') then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 if payload->'adjustment' is distinct from c.payload->'adjustment' or payload->'coupon' is distinct from c.payload->'coupon' or payload->>'note' is distinct from c.payload->>'sale_note' then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 for line in select value from jsonb_array_elements(payload->'lines') loop
  select x into source_line from jsonb_array_elements(c.payload->'lines') x where x->'product_id'=line->'productId' and x->'attribute_id'=line->'attributeId';
  if source_line is null or line->'qty' is distinct from source_line->'quantity' or line->'discount' is distinct from source_line->'discount'
   or line->>'displayName' is distinct from source_line->>'display_name' then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 end loop;
 foreach field in array array['customerId','invoiceAddressId','deliveryAddressId'] loop
  if snapshot->field is distinct from c.payload->(case field when 'customerId' then 'customer_id' when 'invoiceAddressId' then 'invoice_address_id' else 'delivery_address_id' end) then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 end loop;
 for line in select value from jsonb_array_elements(snapshot->'lines') loop
  identity:=(line->>'productId')||':'||(line->>'attributeId');if identity is null or identity=any(seen) then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;seen:=array_append(seen,identity);
  select x into native_line from jsonb_array_elements(q.result->'quote'->'lines') x where x->'product_id'=line->'productId' and x->'attribute_id'=line->'attributeId';
  if native_line is null or line->'qty' is distinct from native_line->'quantity'
   or line->>'name' is distinct from coalesce(native_line->>'display_name',native_line->>'catalogue_name') or line->>'catalogueName' is distinct from native_line->>'catalogue_name'
   or (line->>'unitTaxInclMicros')::numeric is distinct from (native_line->>'unit_tax_incl')::numeric*1000000
   or (line->>'unitTaxExclMicros')::numeric is distinct from (native_line->>'unit_tax_excl')::numeric*1000000
   or (line->>'lineTaxInclCents')::numeric is distinct from (native_line->>'line_tax_incl')::numeric*100
   or (line->>'lineTaxExclCents')::numeric is distinct from (native_line->>'line_tax_excl')::numeric*100 then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 end loop;
 for field in select key from jsonb_each('{"totalTaxExclCents":"total_tax_excl","productsTaxInclCents":"products_tax_incl","productsTaxExclCents":"products_tax_excl","shippingCents":"shipping_tax_incl","discountCents":"discounts_tax_incl"}'::jsonb) loop
  if (snapshot->>field)::numeric is distinct from (q.result->'quote'->>('{"totalTaxExclCents":"total_tax_excl","productsTaxInclCents":"products_tax_incl","productsTaxExclCents":"products_tax_excl","shippingCents":"shipping_tax_incl","discountCents":"discounts_tax_incl"}'::jsonb->>field))::numeric*100 then raise exception 'TPV_BUDGET_SNAPSHOT_INVALID';end if;
 end loop;
 payload:=payload||jsonb_build_object('customerId',snapshot->'customerId','invoiceAddressId',snapshot->'invoiceAddressId','deliveryAddressId',snapshot->'deliveryAddressId');
 if snapshot?'merchant' and (snapshot->'merchant' is distinct from q.result->'quote'->'document_parties'->'merchant'
  or snapshot->'customer'<>'null'::jsonb and snapshot->'customer' is distinct from q.result->'quote'->'document_parties'->'customer'
  or snapshot->'delivery'<>'null'::jsonb and snapshot->'delivery' is distinct from q.result->'quote'->'document_parties'->'delivery') then raise exception 'TPV_BUDGET_DOCUMENT_INVALID';end if;
 insert into private.totus_tpv_budgets(id,connection_id,shop_id,store_id,drawer_id,environment,created_by,title,public_note,store_name,payload,snapshot,cart_command_id,quote_command_id,request_data,valid_until)
 values(p_id,(p_scope->>'connectionId')::uuid,(p_scope->>'shopId')::bigint,(p_scope->>'storeId')::uuid,(p_scope->>'drawerId')::uuid,p_scope->>'environment',actor,btrim(p_data->>'title'),coalesce(p_data->>'publicNote',''),coalesce((select name from public.ops_stores where id=(p_scope->>'storeId')::uuid),'Establecimiento'),payload,snapshot,c.id,q.id,p_data,clock_timestamp()+make_interval(days=>days)) returning * into b;
 return private.totus_tpv_budget_json(b);
end $$;
revoke all on function private.totus_tpv_budget_json(private.totus_tpv_budgets,boolean),public.totus_tpv_budgets(text,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.totus_tpv_budget_json(private.totus_tpv_budgets,boolean),public.totus_tpv_budgets(text,jsonb,uuid,jsonb) to service_role;

create function public.totus_tpv_commercial_options(p_scope jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare options jsonb;actor uuid:=(p_scope->>'actorId')::uuid;can_edit boolean;
begin
 perform private.totus_tpv_authorize(p_scope,'read');
 if not private.totus_module_can((select email from public.profiles where id=actor),'ventas','create') then raise exception 'TPV_BUDGET_CREATE_FORBIDDEN';end if;
 can_edit:=private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit');
 select line_options into options from private.totus_tpv_workspace_preferences where actor_id=actor and connection_id=(p_scope->>'connectionId')::uuid and shop_id=(p_scope->>'shopId')::bigint and drawer_id=(p_scope->>'drawerId')::uuid;
 return jsonb_build_object('allowPriceChanges',can_edit and coalesce((options->>'allowPriceChanges')::boolean,false),'allowNameChanges',can_edit and coalesce((options->>'allowNameChanges')::boolean,false));
end $$;
revoke all on function public.totus_tpv_commercial_options(jsonb) from public,anon,authenticated;
grant execute on function public.totus_tpv_commercial_options(jsonb) to service_role;

create or replace function public.totus_tpv_native_command(p_action text,p_id uuid,p_scope jsonb,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_native_commands; won boolean:=false; command_name text;commercial boolean;
begin
 if p_action not in ('claim','get','complete','uncertain') or p_id is null or jsonb_typeof(p_data) is distinct from 'object'
  then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
 select * into r from private.totus_tpv_native_commands where id=p_id;
 command_name:=case when p_action='claim' then p_data->>'command' else r.command end;
 commercial:=command_name in ('cart.prepare','cart.quote') and (case when p_action='claim' then p_data->'payload' else r.payload end)->'commercial_only'='true'::jsonb;
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
  perform private.totus_tpv_authorize(p_scope,case when commercial then 'read' when p_action='claim' then 'sell' else 'reconcile' end);
  if commercial and p_action='claim' and not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','create') then raise exception 'TPV_BUDGET_CREATE_FORBIDDEN';end if;
 end if;
 if p_action='claim' then
  if coalesce(p_data->>'command','') not in ('setup.qa','cart.prepare','cart.quote','stock.receive')
   or jsonb_typeof(p_data->'payload') is distinct from 'object' or length(p_data::text)>65536
   or (p_data-array['command','payload'])<>'{}'::jsonb then raise exception 'TPV_NATIVE_REQUEST_INVALID';end if;
  if p_data->>'command'='stock.receive' and not private.totus_module_can(
    (select email from public.profiles where id=(p_scope->>'actorId')::uuid),'productos','edit')
   then raise exception 'TPV_STOCK_FORBIDDEN';end if;
  if p_data->>'command'='cart.prepare' and ((p_data->'payload') ? 'adjustment' or (p_data->'payload') ? 'coupon'
   or exists(select 1 from jsonb_array_elements(p_data->'payload'->'lines') l where l ? 'discount' or l ? 'display_name'))
   and not private.totus_module_can((select email from public.profiles where id=(p_scope->>'actorId')::uuid),'ventas','edit')
   then raise exception 'TPV_DISCOUNT_FORBIDDEN';end if;
  if p_data->>'command'='cart.prepare' and exists(select 1 from jsonb_array_elements(p_data->'payload'->'lines') l where l?'display_name') and (case when commercial then public.totus_tpv_commercial_options(p_scope) else public.totus_tpv_line_options(p_scope) end)->'allowNameChanges' is distinct from 'true'::jsonb then raise exception 'TPV_LINE_NAME_FORBIDDEN';end if;
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

-- Conversion claims a separate ordinary checkout draft. The commercial native
-- cart is never made payable; the existing sale flow recalculates a new cart.
create function public.totus_tpv_budget_checkout(p_scope jsonb,p_id uuid,p_version bigint,p_action text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b private.totus_tpv_budgets;d private.totus_tpv_drafts;actor uuid:=(p_scope->>'actorId')::uuid;
begin
 if p_action not in ('open','cancel') or p_action is null or p_id is null or p_version is null or p_version<1 then raise exception 'TPV_BUDGET_REQUEST_INVALID';end if;
 perform private.totus_tpv_authorize(p_scope,case when p_action='open' then 'sell' else 'read' end);
 if p_action='cancel' and not private.totus_module_can((select email from public.profiles where id=actor),'ventas','edit') then raise exception 'TPV_BUDGET_CANCEL_FORBIDDEN';end if;
 select * into b from private.totus_tpv_budgets where id=p_id for update;
 if not found or b.connection_id is distinct from (p_scope->>'connectionId')::uuid or b.shop_id is distinct from (p_scope->>'shopId')::bigint or b.store_id is distinct from (p_scope->>'storeId')::uuid or b.environment is distinct from p_scope->>'environment' then raise exception 'TPV_BUDGET_NOT_FOUND';end if;
 if p_action='cancel' and b.status='cancelled' then return jsonb_build_object('budget',private.totus_tpv_budget_json(b));end if;
 if b.status in ('sold','cancelled') then raise exception 'TPV_BUDGET_CLOSED';end if;
 if p_action='open' and b.valid_until<=clock_timestamp() then raise exception 'TPV_BUDGET_EXPIRED';end if;
 if b.draft_id is not null then
  select * into d from private.totus_tpv_drafts where id=b.draft_id for update;
  if not found then raise exception 'TPV_BUDGET_IN_USE';end if;
  if d.status='sold' or exists(select 1 from private.totus_tpv_operations where id=d.checkout_id and status<>'ready') then raise exception 'TPV_BUDGET_IN_USE';end if;
  if d.status in ('claimed','checkout') and (d.claimed_by is distinct from actor or d.claimed_session is distinct from (p_scope->>'sessionId')::uuid)
   and exists(select 1 from private.totus_tpv_sessions where id=d.claimed_session and status='open') then raise exception 'TPV_BUDGET_IN_USE';end if;
  if p_action='open' and d.claimed_by=actor and d.claimed_session=(p_scope->>'sessionId')::uuid and d.drawer_id=(p_scope->>'drawerId')::uuid and d.status in ('claimed','checkout') then
   return jsonb_build_object('budget',private.totus_tpv_budget_json(b),'draft',private.totus_tpv_draft_json(d,actor));
  end if;
 end if;
 if b.version<>p_version then raise exception 'TPV_BUDGET_STALE';end if;
 if p_action='cancel' then
  update private.totus_tpv_budgets set status='cancelled',version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
  if d.id is not null then update private.totus_tpv_drafts set status='archived',version=version+1,updated_at=clock_timestamp() where id=d.id;end if;
 else
  if d.id is null then
   insert into private.totus_tpv_drafts(id,connection_id,store_id,drawer_id,shop_id,environment,created_by,claimed_by,claimed_session,version,status,label,payload,expires_at)
   values(gen_random_uuid(),b.connection_id,b.store_id,(p_scope->>'drawerId')::uuid,b.shop_id,b.environment,b.created_by,actor,(p_scope->>'sessionId')::uuid,1,'claimed',b.reference,b.payload,b.valid_until) returning * into d;
  else
   update private.totus_tpv_drafts set drawer_id=(p_scope->>'drawerId')::uuid,claimed_by=actor,claimed_session=(p_scope->>'sessionId')::uuid,status='claimed',checkout_id=null,version=version+1,expires_at=b.valid_until,updated_at=clock_timestamp() where id=d.id returning * into d;
  end if;
  update private.totus_tpv_budgets set status='checkout',draft_id=d.id,version=version+1,updated_at=clock_timestamp() where id=b.id returning * into b;
 end if;
 return jsonb_build_object('budget',private.totus_tpv_budget_json(b))||case when p_action='open' then jsonb_build_object('draft',private.totus_tpv_draft_json(d,actor)) else '{}'::jsonb end;
end $$;

create function private.totus_tpv_budget_dispatch_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
declare b private.totus_tpv_budgets;
begin
 if new.expected?'draftId' and (old.status='ready' and new.status='dispatched' or new.status='confirmed' and old.status<>'confirmed') then
  select * into b from private.totus_tpv_budgets where draft_id=(new.expected->>'draftId')::uuid for update;
  if found and (b.status<>'checkout' or old.status='ready' and b.valid_until<=clock_timestamp()) then raise exception 'TPV_BUDGET_EXPIRED';end if;
 end if;return new;
end $$;
create trigger tpv_budget_dispatch_guard before update on private.totus_tpv_operations for each row execute function private.totus_tpv_budget_dispatch_guard();

create function private.totus_tpv_budget_draft_status() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status='sold' and old.status<>'sold' then
  update private.totus_tpv_budgets set status='sold',order_id=new.order_id,version=version+1,updated_at=clock_timestamp() where draft_id=new.id and status='checkout';
 elsif new.status='archived' and old.status<>'archived' then
  update private.totus_tpv_budgets set status='saved',draft_id=null,version=version+1,updated_at=clock_timestamp() where draft_id=new.id and status='checkout';
 end if;return new;
end $$;
create trigger tpv_budget_draft_status after update on private.totus_tpv_drafts for each row execute function private.totus_tpv_budget_draft_status();
revoke all on function public.totus_tpv_budget_checkout(jsonb,uuid,bigint,text),private.totus_tpv_budget_dispatch_guard(),private.totus_tpv_budget_draft_status() from public,anon,authenticated;
grant execute on function public.totus_tpv_budget_checkout(jsonb,uuid,bigint,text),private.totus_tpv_budget_dispatch_guard(),private.totus_tpv_budget_draft_status() to service_role;
commit;
