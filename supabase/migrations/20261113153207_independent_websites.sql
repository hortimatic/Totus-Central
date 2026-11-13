-- Independent websites, not additional physical businesses or cash drawers.
-- Review/test before deployment. No shop, order, stock or accounting writes.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table private.totus_websites(
 key text primary key check(key ~ '^[a-z][a-z0-9_-]{1,63}$'),
 connection_id uuid not null unique references private.totus_api_connections(id),
 name text not null check(length(btrim(name)) between 1 and 100),
 origin text not null check(origin ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'),
 status text not null default 'active' check(status in ('active','disabled','retired')),
 include_in_totals boolean not null default false,
 business_id uuid references public.ops_stores(id),
 revision bigint not null default 1,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table private.totus_websites enable row level security;
revoke all on private.totus_websites from public,anon,authenticated;
insert into private.totus_websites(key,connection_id,name,origin,include_in_totals,business_id)
select v.key,c.id,v.name,v.origin,v.totals,s.id
from (values
 ('hortimatic','Hortimatic','https://hortimatic.com',true,'HORTIMATIC'),
 ('newoldsmok','NewOldSmok','https://newoldsmok.com',true,'NEWOLDSMOK'),
 ('hortimatic-2','Hortimatic 2.0','https://preproduccion.hortimatic.com',false,null)
) v(key,name,origin,totals,business)
join private.totus_api_connections c on c.protocol='prestashop' and rtrim(c.endpoint,'/')=v.origin||'/api'
left join public.ops_stores s on s.code=v.business;

-- Any future native PrestaShop connection acquires its own identity immediately.
-- It remains unusable until the connection's existing verification/activation
-- checks pass. No credential or operational permission is created by this trigger.
create function private.totus_register_website_connection() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.protocol='prestashop' and new.endpoint ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?/api/?$' then
  insert into private.totus_websites(key,connection_id,name,origin)
  values('web-'||new.id::text,new.id,new.name,regexp_replace(new.endpoint,'/api/?$',''))
  on conflict(connection_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.totus_register_website_connection() from public,anon,authenticated;
create trigger totus_register_website_connection after insert or update of protocol,endpoint on private.totus_api_connections
for each row execute function private.totus_register_website_connection();

create function private.totus_website_context() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'websites',coalesce((select jsonb_agg(to_jsonb(w) order by w.created_at,w.key) from private.totus_websites w where w.status<>'retired'),'[]'::jsonb),
 'businesses',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by sort_order,name) from public.ops_stores where active),'[]'::jsonb),
 'connections',coalesce((select jsonb_agg(jsonb_build_object(
 'id',c.id,'name',c.name,'protocol',c.protocol,'enabled',c.enabled and w.status='active','revision',c.revision,
 'verified_revision',c.verified_revision,'verified_at',c.verified_at,'real_data_authorized',c.real_data_authorized,
 'store_key',w.key,'website_name',w.name,'website_origin',w.origin,
 'configured',exists(select 1 from vault.decrypted_secrets v where v.name='totus_api_'||c.id and length(v.decrypted_secret)>0)
 ) order by w.created_at,w.key) from private.totus_websites w join private.totus_api_connections c on c.id=w.connection_id
 where c.protocol='prestashop' and w.status<>'retired'),'[]'::jsonb))
$$;
revoke all on function private.totus_website_context() from public,anon,authenticated;

create function public.totus_websites(p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare w private.totus_websites; c private.totus_api_connections; b uuid;
begin
 if auth.uid() is null then raise exception 'Inicia sesión.';end if;
 if p_action='list' then
  if not (private.totus_can('inicio','view') or private.totus_can('automatizaciones','view') or private.totus_can('productos','view') or private.totus_can('prestashop','view') or private.totus_can('ventas','view') or private.totus_can('facturacion','view') or private.totus_can('gastos','view') or private.totus_can('pricing','view') or private.totus_can('administracion','view')) then raise exception 'Sin permiso para consultar tiendas.';end if;
  return private.totus_website_context();
 end if;
 perform private.totus_api_admin();
 if p_action='manage' then return private.totus_website_context()||jsonb_build_object('websites',coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at,s.key) from private.totus_websites s),'[]'::jsonb));end if;
 if p_action<>'save' or jsonb_typeof(p_data) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('key','connection_id','name','status','include_in_totals','business_id','expected_revision')) then raise exception 'Configuración de tienda no válida.';end if;
 if coalesce(p_data->>'key','') !~ '^[a-z][a-z0-9_-]{1,63}$' or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 100 or coalesce(p_data->>'status','') not in ('active','disabled','retired') or jsonb_typeof(p_data->'include_in_totals') is distinct from 'boolean' then raise exception 'Completa la identidad, el estado y el uso en totales.';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_websites',0));
 select * into c from private.totus_api_connections where id=(p_data->>'connection_id')::uuid for update;
 if not found or c.protocol<>'prestashop' or c.endpoint !~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?/api/?$' then raise exception 'Selecciona una conexión PrestaShop con URL /api válida.';end if;
 select * into w from private.totus_websites where key=p_data->>'key' for update;
 if found then
  if w.connection_id<>c.id then raise exception 'La identidad de una web no puede trasladarse a otra conexión. Crea otra web.';end if;
  if w.revision is distinct from (p_data->>'expected_revision')::bigint then raise exception 'La tienda ha cambiado. Actualiza antes de guardar.';end if;
 elsif p_data->>'expected_revision' is not null then raise exception 'La tienda ya no existe.';
 end if;
 b=nullif(p_data->>'business_id','')::uuid;
 if b is not null and not exists(select 1 from public.ops_stores where id=b and active) then raise exception 'Selecciona un negocio activo.';end if;
 insert into private.totus_websites(key,connection_id,name,origin,status,include_in_totals,business_id)
 values(p_data->>'key',c.id,btrim(p_data->>'name'),regexp_replace(c.endpoint,'/api/?$',''),p_data->>'status',(p_data->>'include_in_totals')::boolean,b)
 on conflict(key) do update set name=excluded.name,origin=excluded.origin,status=excluded.status,include_in_totals=excluded.include_in_totals,business_id=excluded.business_id,revision=private.totus_websites.revision+1,updated_at=now();
 return private.totus_website_context();
end $$;
revoke all on function public.totus_websites(text,jsonb) from public,anon;
grant execute on function public.totus_websites(text,jsonb) to authenticated;

-- Keep every permission check in the existing RPCs; replace only their common
-- return expression. Abort rather than silently patch an unexpected definition.
do $$declare f regprocedure; definition text; marker text='return jsonb_build_object(''connections'',coalesce('; start_at integer; end_at integer;
begin
 foreach f in array array['public.totus_prestashop_context()'::regprocedure,'public.totus_products_context(text)'::regprocedure,'public.totus_sales_context()'::regprocedure,'public.totus_directory_context(text,text)'::regprocedure] loop
  definition=pg_get_functiondef(f);start_at=strpos(lower(definition),marker);
  if start_at=0 then raise exception 'Unexpected context definition: %',f;end if;
  end_at=strpos(substr(definition,start_at),';');
  if end_at=0 then raise exception 'Missing context return terminator: %',f;end if;
  execute substr(definition,1,start_at-1)||'return private.totus_website_context();'||substr(definition,start_at+end_at);
 end loop;
end $$;
commit;
