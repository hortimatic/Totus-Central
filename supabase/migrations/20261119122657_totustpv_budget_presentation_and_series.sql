begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_tpv_budget_settings(
 connection_id uuid not null references private.totus_api_connections(id),shop_id bigint not null check(shop_id>0),
 store_id uuid not null references public.ops_stores(id),enabled boolean not null default false,
 prefix text not null default 'P-' check(prefix ~ '^[A-Za-z0-9/_-]{0,12}$'),
 last_number bigint not null default 0 check(last_number between 0 and 999999999),
 hide_prices boolean not null default false,revision bigint not null default 0 check(revision>=0),
 updated_by uuid references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,store_id));
create table private.totus_tpv_budget_settings_audit(
 id bigint generated always as identity primary key,actor_id uuid not null references public.profiles(id),
 connection_id uuid not null,shop_id bigint not null,store_id uuid not null,
 previous jsonb not null,current jsonb not null,recorded_at timestamptz not null default clock_timestamp());
alter table private.totus_tpv_budget_settings enable row level security;
alter table private.totus_tpv_budget_settings_audit enable row level security;
revoke all on private.totus_tpv_budget_settings,private.totus_tpv_budget_settings_audit from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_budget_settings to service_role;
grant select,insert on private.totus_tpv_budget_settings_audit to service_role;
grant usage on sequence private.totus_tpv_budget_settings_audit_id_seq to service_role;
create policy tpv_budget_settings_server on private.totus_tpv_budget_settings to service_role using(true) with check(true);
create policy tpv_budget_settings_audit_server on private.totus_tpv_budget_settings_audit to service_role using(true) with check(true);

create function public.totus_tpv_budget_settings(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;station jsonb;store uuid;r private.totus_tpv_budget_settings;
 previous jsonb;requested_number bigint;expected bigint;different boolean;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 select w into station from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
  and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true';
 if ctx->>'actorId' is distinct from actor::text or station is null then raise exception 'TPV_BUDGET_SETTINGS_FORBIDDEN';end if;
 store:=(station->>'storeId')::uuid;
 if p_settings is not null then
  if not private.totus_can('configuracion','edit') then raise exception 'TPV_BUDGET_SETTINGS_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['enabled','prefix','lastNumber','hidePrices','expectedRevision']<>'{}'::jsonb
   or jsonb_typeof(p_settings->'enabled') is distinct from 'boolean' or jsonb_typeof(p_settings->'hidePrices') is distinct from 'boolean'
   or jsonb_typeof(p_settings->'prefix') is distinct from 'string' or coalesce(p_settings->>'prefix','!')!~'^[A-Za-z0-9/_-]{0,12}$'
   or jsonb_typeof(p_settings->'lastNumber') is distinct from 'number' or coalesce(p_settings->>'lastNumber','')!~'^(0|[1-9][0-9]{0,8})$'
   or jsonb_typeof(p_settings->'expectedRevision') is distinct from 'number' or coalesce(p_settings->>'expectedRevision','')!~'^(0|[1-9][0-9]{0,14})$'
   then raise exception 'TPV_BUDGET_SETTINGS_INVALID';end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('tpv-budget-settings:'||p_connection::text||':'||p_shop::text||':'||store::text,0));
 select * into r from private.totus_tpv_budget_settings where connection_id=p_connection and shop_id=p_shop and store_id=store for update;
 if not found then r.enabled:=false;r.prefix:='P-';r.last_number:=0;r.hide_prices:=false;r.revision:=0;end if;
 if p_settings is not null then
  requested_number:=(p_settings->>'lastNumber')::bigint;expected:=(p_settings->>'expectedRevision')::bigint;
  different:=r.enabled is distinct from (p_settings->>'enabled')::boolean or r.prefix is distinct from p_settings->>'prefix'
   or r.hide_prices is distinct from (p_settings->>'hidePrices')::boolean;
  -- An exact lost-reply retry may observe a subsequently advanced counter.
  if expected<>r.revision then
   if expected>r.revision or different or requested_number>r.last_number then raise exception 'TPV_BUDGET_SETTINGS_STALE';end if;
  else
   if requested_number<r.last_number then raise exception 'TPV_BUDGET_COUNTER_DECREASE_FORBIDDEN';end if;
   if different or requested_number<>r.last_number then
    previous:=jsonb_build_object('enabled',r.enabled,'prefix',r.prefix,'lastNumber',r.last_number,'hidePrices',r.hide_prices,'revision',r.revision);
    insert into private.totus_tpv_budget_settings(connection_id,shop_id,store_id,enabled,prefix,last_number,hide_prices,revision,updated_by)
     values(p_connection,p_shop,store,(p_settings->>'enabled')::boolean,p_settings->>'prefix',requested_number,(p_settings->>'hidePrices')::boolean,r.revision+1,actor)
    on conflict(connection_id,shop_id,store_id) do update set enabled=excluded.enabled,prefix=excluded.prefix,last_number=excluded.last_number,
     hide_prices=excluded.hide_prices,revision=excluded.revision,updated_by=actor,updated_at=clock_timestamp() returning * into r;
    insert into private.totus_tpv_budget_settings_audit(actor_id,connection_id,shop_id,store_id,previous,current)
     values(actor,p_connection,p_shop,store,previous,jsonb_build_object('enabled',r.enabled,'prefix',r.prefix,'lastNumber',r.last_number,'hidePrices',r.hide_prices,'revision',r.revision));
   end if;
  end if;
 end if;
 return jsonb_build_object('enabled',r.enabled,'prefix',r.prefix,'lastNumber',r.last_number,'hidePrices',r.hide_prices,'revision',r.revision);
end $$;
revoke all on function public.totus_tpv_budget_settings(uuid,bigint,uuid,jsonb) from public,anon,service_role;
grant execute on function public.totus_tpv_budget_settings(uuid,bigint,uuid,jsonb) to authenticated;

-- Keep the original identity/reference columns and every historical snapshot.
alter table private.totus_tpv_budgets add column document_reference text,
 add column presentation jsonb not null default '{"hidePrices":false}'::jsonb
 check(jsonb_typeof(presentation)='object' and presentation-array['hidePrices']='{}'::jsonb and jsonb_typeof(presentation->'hidePrices') is not distinct from 'boolean');
create unique index tpv_budget_document_reference_unique on private.totus_tpv_budgets(connection_id,shop_id,store_id,(coalesce(document_reference,reference)));
create function private.totus_tpv_assign_budget_document() returns trigger language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_budget_settings;next_number bigint;used_number bigint;candidate text;
begin
 perform pg_advisory_xact_lock(hashtextextended('tpv-budget-settings:'||new.connection_id::text||':'||new.shop_id::text||':'||new.store_id::text,0));
 select * into r from private.totus_tpv_budget_settings where connection_id=new.connection_id and shop_id=new.shop_id and store_id=new.store_id for update;
 new.presentation:=jsonb_build_object('hidePrices',coalesce(r.hide_prices,false));
 if r.enabled then
  select max(substring(label from length(r.prefix)+1)::bigint) into used_number from (
   select coalesce(b.document_reference,b.reference) label from private.totus_tpv_budgets b
   where b.connection_id=new.connection_id and b.shop_id=new.shop_id and b.store_id=new.store_id) existing
   where left(label,length(r.prefix))=r.prefix and substring(label from length(r.prefix)+1) ~ '^[0-9]{6,9}$';
  next_number:=greatest(r.last_number+1,coalesce(used_number+1,1));
  if next_number>999999999 then raise exception 'TPV_BUDGET_COUNTER_EXHAUSTED';end if;
  new.document_reference:=r.prefix||lpad(next_number::text,greatest(6,length(next_number::text)),'0');
  update private.totus_tpv_budget_settings set last_number=next_number where connection_id=new.connection_id and shop_id=new.shop_id and store_id=new.store_id;
 else
  new.document_reference:=null;
  candidate:='P-'||lpad(new.number::text,greatest(6,length(new.number::text)),'0');
  while exists(select 1 from private.totus_tpv_budgets b where b.connection_id=new.connection_id and b.shop_id=new.shop_id and b.store_id=new.store_id and coalesce(b.document_reference,b.reference)=candidate) loop
   new.number:=nextval('private.totus_tpv_budgets_number_seq'::regclass);
   candidate:='P-'||lpad(new.number::text,greatest(6,length(new.number::text)),'0');
  end loop;
 end if;
 return new;
end $$;
revoke all on function private.totus_tpv_assign_budget_document() from public,anon,authenticated;
grant execute on function private.totus_tpv_assign_budget_document() to service_role;
create trigger tpv_assign_budget_document before insert on private.totus_tpv_budgets for each row execute function private.totus_tpv_assign_budget_document();
create or replace function private.totus_tpv_budget_json(b private.totus_tpv_budgets,full_document boolean default true) returns jsonb
language sql volatile security invoker set search_path='' as $$
 select jsonb_build_object('id',b.id,'reference',coalesce(b.document_reference,b.reference),'title',b.title,'storeName',b.store_name,'drawerId',b.drawer_id,
  'version',b.version,'status',b.status,'createdAt',b.created_at,'validUntil',b.valid_until,'expired',b.valid_until<=clock_timestamp(),
  'currency',b.snapshot->>'currency','totalCents',b.snapshot->'totalCents','draftId',b.draft_id,'orderId',b.order_id)
  ||case when full_document then jsonb_build_object('publicNote',b.public_note,'payload',b.payload,'snapshot',b.snapshot-array['nativeCartId','nativeQuoteFingerprint'],'presentation',b.presentation) else '{}'::jsonb end
$$;
-- Preserve the full verified budget save/recovery contract; extend visible-reference search.
create or replace function public.totus_tpv_budgets(p_action text,p_scope jsonb,p_id uuid default null,p_data jsonb default '{}') returns jsonb
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
    and (cursor_time is null or (z.created_at,z.id)<(cursor_time,cursor_id)) and (search_text='' or position(lower(search_text) in lower(coalesce(z.document_reference,z.reference)||' '||z.reference||' '||z.title))>0)
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
commit;
