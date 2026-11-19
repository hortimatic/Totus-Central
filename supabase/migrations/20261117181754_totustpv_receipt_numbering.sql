begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
-- One counter per native shop/establishment, shared by its tills and operators.
-- These are counter receipt identifiers, never replacement invoice numbers.
create table private.totus_tpv_receipt_series (
 connection_id uuid not null references private.totus_api_connections(id),shop_id bigint not null check(shop_id>0),
 store_id uuid not null references public.ops_stores(id),enabled boolean not null default false,
 sale_prefix text not null default 'V' check(sale_prefix ~ '^[A-Za-z0-9/_-]{0,12}$'),
 return_prefix text not null default 'D' check(return_prefix ~ '^[A-Za-z0-9/_-]{0,12}$'),
 last_sale bigint not null default 0 check(last_sale between 0 and 999999999),
 last_return bigint not null default 0 check(last_return between 0 and 999999999),
 updated_by uuid references public.profiles(id),updated_at timestamptz not null default clock_timestamp(),
 primary key(connection_id,shop_id,store_id)
);
create table private.totus_tpv_receipt_numbers (
 operation_id uuid not null,kind text not null check(kind in ('sale','return')),
 connection_id uuid not null,shop_id bigint not null,store_id uuid not null,
 number bigint not null check(number between 1 and 999999999),prefix text not null,
 assigned_at timestamptz not null default clock_timestamp(),primary key(operation_id,kind),
 foreign key(connection_id,shop_id,store_id) references private.totus_tpv_receipt_series(connection_id,shop_id,store_id),
 unique(connection_id,shop_id,store_id,kind,number)
);
create table private.totus_tpv_receipt_series_audit (
 id bigint generated always as identity primary key,actor_id uuid not null,
 connection_id uuid not null,shop_id bigint not null,store_id uuid not null,
 previous jsonb not null,current jsonb not null,recorded_at timestamptz not null default clock_timestamp()
);
create unique index tpv_receipt_label_unique on private.totus_tpv_receipt_numbers(connection_id,shop_id,store_id,kind,(prefix||number::text));
alter table private.totus_tpv_receipt_series enable row level security;
alter table private.totus_tpv_receipt_numbers enable row level security;
alter table private.totus_tpv_receipt_series_audit enable row level security;
create policy tpv_series_server on private.totus_tpv_receipt_series to service_role using(true) with check(true);
create policy tpv_receipt_number_server on private.totus_tpv_receipt_numbers to service_role using(true) with check(true);
create policy tpv_series_audit_server on private.totus_tpv_receipt_series_audit to service_role using(true) with check(true);
revoke all on private.totus_tpv_receipt_series,private.totus_tpv_receipt_numbers,private.totus_tpv_receipt_series_audit from public,anon,authenticated;
grant select,insert,update on private.totus_tpv_receipt_series to service_role;
grant select,insert on private.totus_tpv_receipt_numbers,private.totus_tpv_receipt_series_audit to service_role;
grant usage on sequence private.totus_tpv_receipt_series_audit_id_seq to service_role;

create function public.totus_tpv_receipt_series(p_connection uuid,p_shop bigint,p_drawer uuid,p_settings jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();ctx jsonb;station jsonb;r private.totus_tpv_receipt_series;previous jsonb;store uuid;
begin
 if actor is null then raise exception 'TPV_AUTH_REQUIRED';end if;
 ctx:=public.totus_tpv_context();
 select w into station from jsonb_array_elements(ctx->'workstations') w where w->>'connectionId'=p_connection::text
  and w->>'shopId'=p_shop::text and w->>'drawerId'=p_drawer::text and w->>'canReconcile'='true';
 if ctx->>'actorId' is distinct from actor::text or station is null then raise exception 'TPV_RECEIPT_SERIES_FORBIDDEN';end if;
 store:=(station->>'storeId')::uuid;
 if p_settings is not null then
  if not private.totus_can('ventas','edit') then raise exception 'TPV_RECEIPT_SERIES_FORBIDDEN';end if;
  if jsonb_typeof(p_settings) is distinct from 'object' or p_settings-array['enabled','salePrefix','returnPrefix','lastSaleNumber','lastReturnNumber']<>'{}'::jsonb
   or exists(select 1 from jsonb_each(p_settings) e where
    e.key='enabled' and jsonb_typeof(e.value) is distinct from 'boolean'
    or e.key in ('salePrefix','returnPrefix') and (jsonb_typeof(e.value) is distinct from 'string' or e.value#>>'{}' !~ '^[A-Za-z0-9/_-]{0,12}$')
    or e.key in ('lastSaleNumber','lastReturnNumber') and (jsonb_typeof(e.value) is distinct from 'number' or e.value::text !~ '^(0|[1-9][0-9]{0,8})$'))
   then raise exception 'TPV_RECEIPT_SERIES_INVALID';end if;
  insert into private.totus_tpv_receipt_series(connection_id,shop_id,store_id) values(p_connection,p_shop,store) on conflict do nothing;
  select * into r from private.totus_tpv_receipt_series where connection_id=p_connection and shop_id=p_shop and store_id=store for update;
  previous:=to_jsonb(r);
  if coalesce((p_settings->>'lastSaleNumber')::bigint,r.last_sale)<r.last_sale or coalesce((p_settings->>'lastReturnNumber')::bigint,r.last_return)<r.last_return
   then raise exception 'TPV_RECEIPT_COUNTER_DECREASE_FORBIDDEN';end if;
  update private.totus_tpv_receipt_series set enabled=coalesce((p_settings->>'enabled')::boolean,r.enabled),
   sale_prefix=coalesce(p_settings->>'salePrefix',r.sale_prefix),return_prefix=coalesce(p_settings->>'returnPrefix',r.return_prefix),
   last_sale=coalesce((p_settings->>'lastSaleNumber')::bigint,r.last_sale),last_return=coalesce((p_settings->>'lastReturnNumber')::bigint,r.last_return),
   updated_by=actor,updated_at=clock_timestamp() where connection_id=p_connection and shop_id=p_shop and store_id=store returning * into r;
  insert into private.totus_tpv_receipt_series_audit(actor_id,connection_id,shop_id,store_id,previous,current) values(actor,p_connection,p_shop,store,previous,to_jsonb(r));
 else
  select * into r from private.totus_tpv_receipt_series where connection_id=p_connection and shop_id=p_shop and store_id=store;
 end if;
 return jsonb_build_object('enabled',coalesce(r.enabled,false),'salePrefix',coalesce(r.sale_prefix,'V'),'returnPrefix',coalesce(r.return_prefix,'D'),
  'lastSaleNumber',coalesce(r.last_sale,0),'lastReturnNumber',coalesce(r.last_return,0));
end $$;
revoke all on function public.totus_tpv_receipt_series(uuid,bigint,uuid,jsonb) from public,anon;
grant execute on function public.totus_tpv_receipt_series(uuid,bigint,uuid,jsonb) to authenticated;

create function private.totus_tpv_assign_receipt_number() returns trigger language plpgsql security invoker set search_path='' as $$
declare r private.totus_tpv_receipt_series;connection uuid;shop bigint;store uuid;v_kind text;next_number bigint;v_prefix text;attempts integer:=0;
begin
 if new.status<>'confirmed' or old.status='confirmed' then return new;end if;
 if tg_table_name='totus_tpv_operations' then connection:=new.connection_id;shop:=new.shop_id;store:=new.store_id;v_kind:='sale';
 else connection:=(new.scope->>'connectionId')::uuid;shop:=(new.scope->>'shopId')::bigint;store:=(new.scope->>'storeId')::uuid;v_kind:='return';end if;
 select * into r from private.totus_tpv_receipt_series where connection_id=connection and shop_id=shop and store_id=store for update;
 if not found or not r.enabled then return new;end if;
 if exists(select 1 from private.totus_tpv_receipt_numbers where operation_id=new.id and totus_tpv_receipt_numbers.kind=v_kind) then return new;end if;
 next_number:=case when v_kind='sale' then r.last_sale+1 else r.last_return+1 end;
 if next_number>999999999 then raise exception 'TPV_RECEIPT_COUNTER_EXHAUSTED';end if;
 v_prefix:=case when v_kind='sale' then r.sale_prefix else r.return_prefix end;
 -- Prefix changes must never reuse a human-visible historical ticket identity.
 while exists(select 1 from private.totus_tpv_receipt_numbers n where n.connection_id=connection and n.shop_id=shop and n.store_id=store and n.kind=v_kind and n.prefix||n.number::text=v_prefix||next_number::text) loop
  next_number:=next_number+1;attempts:=attempts+1;
  if next_number>999999999 or attempts>1000 then raise exception 'TPV_RECEIPT_COUNTER_EXHAUSTED';end if;
 end loop;
 insert into private.totus_tpv_receipt_numbers(operation_id,kind,connection_id,shop_id,store_id,number,prefix) values(new.id,v_kind,connection,shop,store,next_number,v_prefix);
 update private.totus_tpv_receipt_series set last_sale=case when v_kind='sale' then next_number else last_sale end,
  last_return=case when v_kind='return' then next_number else last_return end where connection_id=connection and shop_id=shop and store_id=store;
 return new;
end $$;
create trigger tpv_assign_receipt_number after update on private.totus_tpv_operations for each row execute function private.totus_tpv_assign_receipt_number();
create trigger tpv_assign_return_number after update on private.totus_tpv_refunds for each row execute function private.totus_tpv_assign_receipt_number();
revoke all on function private.totus_tpv_assign_receipt_number() from public,anon,authenticated;
grant execute on function private.totus_tpv_assign_receipt_number() to service_role;
create function public.totus_tpv_receipt_number(p_scope jsonb,p_operation uuid,p_kind text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare sale private.totus_tpv_operations;n private.totus_tpv_receipt_numbers;
begin
 perform private.totus_tpv_authorize(p_scope,'read');
 if p_kind not in ('sale','return') or p_kind is null or p_operation is null then raise exception 'TPV_RECEIPT_NUMBER_INVALID';end if;
 if p_kind='sale' then select * into sale from private.totus_tpv_operations where id=p_operation and status='confirmed';
 else select s.* into sale from private.totus_tpv_operations s join private.totus_tpv_refunds r on r.sale_id=s.id
  where r.id=p_operation and r.status='confirmed' and s.status='confirmed';end if;
 if not found or sale.connection_id is distinct from (p_scope->>'connectionId')::uuid or sale.shop_id is distinct from (p_scope->>'shopId')::bigint
  or sale.store_id is distinct from (p_scope->>'storeId')::uuid then raise exception 'TPV_RECEIPT_NUMBER_NOT_FOUND';end if;
 select * into n from private.totus_tpv_receipt_numbers where operation_id=p_operation and kind=p_kind;
 if not found then return null;end if;
 return jsonb_build_object('kind',n.kind,'number',n.number,'prefix',n.prefix,'label',n.prefix||n.number::text);
end $$;
revoke all on function public.totus_tpv_receipt_number(jsonb,uuid,text) from public,anon,authenticated;
grant execute on function public.totus_tpv_receipt_number(jsonb,uuid,text) to service_role;
commit;
