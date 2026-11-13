create role anon;
create role authenticated;
create schema private;
create schema auth;
create schema vault;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function private.totus_can(text,text) returns boolean language sql stable as $$select coalesce(current_setting('qa.allow',true),'')='yes'$$;
create function private.totus_api_admin() returns void language plpgsql as $$begin if coalesce(current_setting('qa.admin',true),'')<>'yes' then raise exception 'Administración necesaria';end if;end$$;
create table public.ops_stores(id uuid primary key,code text,name text,active boolean,sort_order integer);
insert into public.ops_stores values ('00000000-0000-4000-8000-000000000001','HORTIMATIC','Hortimatic',true,1),('00000000-0000-4000-8000-000000000002','NEWOLDSMOK','NewOldSmok',true,2);
create table private.totus_api_connections(id uuid primary key,name text,protocol text,endpoint text,enabled boolean,revision bigint,verified_revision bigint,verified_at timestamptz,real_data_authorized boolean);
insert into private.totus_api_connections(id,name,protocol,endpoint,enabled,revision,verified_revision,real_data_authorized) values
 ('10000000-0000-4000-8000-000000000001','PrestaShop · Hortimatic','prestashop','https://hortimatic.com/api/',true,1,1,true),
 ('10000000-0000-4000-8000-000000000002','PrestaShop · NewOldSmok','prestashop','https://newoldsmok.com/api/',true,1,1,true),
 ('10000000-0000-4000-8000-000000000003','Hortimatic 1.8','prestashop','https://preproduccion.hortimatic.com/api/',false,4,null,true);
create table vault.decrypted_secrets(name text,decrypted_secret text);
insert into vault.decrypted_secrets values ('totus_api_10000000-0000-4000-8000-000000000003','fictitious-only');
create function public.totus_prestashop_context() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.totus_can('prestashop','view') then raise exception 'Sin permiso';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id)) from private.totus_api_connections c where c.name in ('PrestaShop · Hortimatic','PrestaShop · NewOldSmok')),'[]'::jsonb));
end$$;
create function public.totus_products_context(p_action text default 'view') returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.totus_can('productos',p_action) then raise exception 'Sin permiso';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id)) from private.totus_api_connections c),'[]'::jsonb));
end$$;
create function public.totus_sales_context() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.totus_can('ventas','view') then raise exception 'Sin permiso';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id)) from private.totus_api_connections c),'[]'::jsonb));
end$$;
create function public.totus_directory_context(p_kind text,p_action text default 'view') returns jsonb language plpgsql security definer set search_path='' as $$begin
 if auth.uid() is null or not private.totus_can('gastos',p_action) then raise exception 'Sin permiso';end if;
 return jsonb_build_object('connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id)) from private.totus_api_connections c),'[]'::jsonb));
end$$;
