-- Both legacy entry points represent the same contacts, with stable UUIDs.
-- Compatibility tables are retained for existing prices and recovery archives.
begin;
alter table public.providers add column if not exists tax_id text default '';
alter table public.providers add column if not exists email text default '';
alter table public.providers add column if not exists phone text default '';
alter table public.providers add column if not exists address text default '';
alter table public.providers add column if not exists city text default '';
alter table public.providers add column if not exists postal_code text default '';
alter table public.providers add column if not exists province text default '';
alter table public.providers add column if not exists country text default 'España';
alter table public.providers add column if not exists notes text default '';
alter table public.brands add column if not exists website text default '';
alter table public.brands add column if not exists email text default '';
alter table public.brands add column if not exists phone text default '';
alter table public.brands add column if not exists notes text default '';
lock table public.providers,public.ops_suppliers in share row exclusive mode;
do $$begin
 if exists(select 1 from public.providers p join public.ops_suppliers s using(id) where p.name is distinct from s.name) then raise exception 'Revisar colisión de identificadores antes de unificar contactos';end if;
end$$;
insert into public.ops_suppliers(id,name,active,tax_id,email,phone,address,city,postal_code,province,country,notes,source)
 select p.id,p.name,p.active,coalesce(p.tax_id,''),coalesce(p.email,''),coalesce(p.phone,''),coalesce(p.address,''),coalesce(p.city,''),coalesce(p.postal_code,''),coalesce(p.province,''),coalesce(p.country,'España'),coalesce(p.notes,''),'pricing' from public.providers p where not exists(select 1 from public.ops_suppliers s where s.id=p.id);
insert into public.providers(id,name,active,tax_id,email,phone,address,city,postal_code,province,country,notes,created_at)
 select id,name,active,coalesce(tax_id,''),coalesce(email,''),coalesce(phone,''),coalesce(address,''),coalesce(city,''),coalesce(postal_code,''),coalesce(province,''),coalesce(country,'España'),coalesce(notes,''),created_at from public.ops_suppliers
 on conflict(id) do update set name=excluded.name,active=excluded.active,tax_id=excluded.tax_id,email=excluded.email,phone=excluded.phone,address=excluded.address,city=excluded.city,postal_code=excluded.postal_code,province=excluded.province,country=excluded.country,notes=excluded.notes;
create or replace function private.totus_sync_supplier_directory() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if pg_trigger_depth()>1 then return coalesce(new,old);end if;
 if tg_op='DELETE' then
  if tg_table_name='providers' then delete from public.ops_suppliers where id=old.id;
  else delete from public.providers where id=old.id;end if;
  return old;
 end if;
 if tg_table_name='ops_suppliers' then
  insert into public.providers(id,name,active,tax_id,email,phone,address,city,postal_code,province,country,notes)
  values(new.id,new.name,new.active,coalesce(new.tax_id,''),coalesce(new.email,''),coalesce(new.phone,''),coalesce(new.address,''),coalesce(new.city,''),coalesce(new.postal_code,''),coalesce(new.province,''),coalesce(new.country,'España'),coalesce(new.notes,''))
  on conflict(id) do update set name=excluded.name,active=excluded.active,tax_id=excluded.tax_id,email=excluded.email,phone=excluded.phone,address=excluded.address,city=excluded.city,postal_code=excluded.postal_code,province=excluded.province,country=excluded.country,notes=excluded.notes;
 else
  -- Pricing edits shared contact data, never the fiscal defaults of existing expenses.
  insert into public.ops_suppliers(id,name,active,tax_id,email,phone,address,city,postal_code,province,country,notes,source,created_by)
  values(new.id,new.name,new.active,coalesce(new.tax_id,''),coalesce(new.email,''),coalesce(new.phone,''),coalesce(new.address,''),coalesce(new.city,''),coalesce(new.postal_code,''),coalesce(new.province,''),coalesce(new.country,'España'),coalesce(new.notes,''),'pricing',auth.uid())
  on conflict(id) do update set name=excluded.name,active=excluded.active,tax_id=excluded.tax_id,email=excluded.email,phone=excluded.phone,address=excluded.address,city=excluded.city,postal_code=excluded.postal_code,province=excluded.province,country=excluded.country,notes=excluded.notes,updated_at=clock_timestamp();
 end if;
 return new;
end;$$;
revoke all on function private.totus_sync_supplier_directory() from public,anon,authenticated;
create or replace function private.totus_supplier_directory_lock() returns trigger language plpgsql security definer set search_path='' as $begin perform pg_advisory_xact_lock(hashtextextended('totus_supplier_directory',0));return null;end;$;
revoke all on function private.totus_supplier_directory_lock() from public,anon,authenticated;
drop trigger if exists totus_supplier_directory_lock on public.ops_suppliers;
create trigger totus_supplier_directory_lock before insert or update or delete on public.ops_suppliers for each statement execute function private.totus_supplier_directory_lock();
drop trigger if exists totus_supplier_directory_lock on public.providers;
create trigger totus_supplier_directory_lock before insert or update or delete on public.providers for each statement execute function private.totus_supplier_directory_lock();
drop trigger if exists totus_supplier_directory on public.ops_suppliers;
create trigger totus_supplier_directory after insert or update or delete on public.ops_suppliers for each row execute function private.totus_sync_supplier_directory();
drop trigger if exists totus_supplier_directory on public.providers;
create trigger totus_supplier_directory after insert or update or delete on public.providers for each row execute function private.totus_sync_supplier_directory();
commit;
