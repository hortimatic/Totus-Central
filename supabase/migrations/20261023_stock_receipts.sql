-- Stock receipts are independent of accounting and PrestaShop inventory.
create table public.ops_stock_receipts (
 id uuid primary key default gen_random_uuid(), store_id uuid not null references public.ops_stores(id),
 supplier text not null check(length(trim(supplier)) between 1 and 200),
 reference text not null default '' check(length(reference)<=200),
 received_on date not null check(received_on>='2000-01-01'),
 revision integer not null default 1 check(revision>0),
 status text not null default 'pending' check(status in ('pending','needs_review','differences','matched')),
 notes text not null default '' check(length(notes)<=5000),
 result jsonb not null default '{"rows":[],"coverage":[],"complete":false}' check(jsonb_typeof(result)='object'),
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.ops_stock_sources (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.ops_stock_receipts(id),
 document_id uuid not null references public.ops_documents(id), source_kind text not null check(source_kind in ('supplier','prestashop')),
 extracted_text text not null default '' check(length(extracted_text)<=250000),
 extraction jsonb not null default '{"state":"unread"}' check(jsonb_typeof(extraction)='object' and extraction->>'state' in ('ready','partial','unread')),
 created_at timestamptz not null default now(), unique(receipt_id,document_id)
);
create index ops_stock_sources_document on public.ops_stock_sources(document_id);
create index ops_stock_receipts_date on public.ops_stock_receipts(received_on desc,id);
create index ops_stock_receipts_store on public.ops_stock_receipts(store_id);
create table public.ops_stock_revisions (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.ops_stock_receipts(id),
 revision integer not null, action text not null, actor_email text not null, snapshot jsonb not null,
 created_at timestamptz not null default now(), unique(receipt_id,revision)
);
create table public.ops_stock_equivalences (
 id uuid primary key default gen_random_uuid(),store_id uuid not null references public.ops_stores(id),
 supplier text not null,supplier_name text not null,prestashop_name text not null,variant text not null default '',
 unit text not null check(length(trim(unit))>0),unit_factor numeric not null check(unit_factor>0 and unit_factor<=1000000),
 evidence text not null check(length(trim(evidence))>0),confirmed_by text not null,confirmed_at timestamptz not null default now(),
 check(length(supplier)<=200 and length(supplier_name)<=500 and length(prestashop_name)<=500 and length(variant)<=500 and length(evidence)<=5000)
);
create index ops_stock_equivalences_store on public.ops_stock_equivalences(store_id);
create unique index ops_stock_equivalences_identity on public.ops_stock_equivalences(store_id,lower(supplier),lower(supplier_name),lower(prestashop_name),lower(variant),lower(unit));
alter table public.ops_stock_receipts enable row level security;
alter table public.ops_stock_sources enable row level security;
alter table public.ops_stock_revisions enable row level security;
alter table public.ops_stock_equivalences enable row level security;
revoke all on public.ops_stock_receipts,public.ops_stock_sources,public.ops_stock_revisions,public.ops_stock_equivalences from anon,authenticated;
grant select on public.ops_stock_receipts,public.ops_stock_sources,public.ops_stock_revisions,public.ops_stock_equivalences to authenticated;
grant all on public.ops_stock_receipts,public.ops_stock_sources,public.ops_stock_revisions,public.ops_stock_equivalences to service_role;
create policy stock_receipts_read on public.ops_stock_receipts for select to authenticated using ((select private.totus_can('documentos','view')));
create policy stock_sources_read on public.ops_stock_sources for select to authenticated using ((select private.totus_can('documentos','view')));
create policy stock_revisions_read on public.ops_stock_revisions for select to authenticated using ((select private.totus_can('documentos','view')));
create policy stock_equivalences_read on public.ops_stock_equivalences for select to authenticated using ((select private.totus_can('documentos','view')));

-- Connector SQL runs as postgres. Browser calls must pass the existing document permissions.
create function private.totus_stock_actor(p_action text,p_email text default null) returns text
language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if auth.uid() is not null then
  if not private.totus_can('documentos',p_action) then raise exception 'No tienes permiso para esta operación'; end if;
  actor=lower(auth.jwt()->>'email');
 elsif session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null then
  actor=lower(trim(coalesce(p_email,'')));
  if not exists(select 1 from public.team_members where lower(email)=actor and active and role='admin') then
   raise exception 'El conector debe identificar una cuenta administradora activa';
  end if;
 else raise exception 'Sesión requerida'; end if;
 return actor;
end $$;
revoke all on function private.totus_stock_actor(text,text) from public,anon,authenticated;

create function private.totus_stock_revision(p_id uuid,p_action text,p_actor text) returns void
language plpgsql set search_path='' as $$
begin
 insert into public.ops_stock_revisions(receipt_id,revision,action,actor_email,snapshot)
 select id,revision,p_action,p_actor,jsonb_build_object('receipt',to_jsonb(r),'source_ids',
  coalesce((select jsonb_agg(id order by id) from public.ops_stock_sources where receipt_id=r.id),'[]'::jsonb))
 from public.ops_stock_receipts r where id=p_id;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(auth.uid(),p_actor,'documentos','stock_'||p_action,jsonb_build_object('receipt_id',p_id));
end $$;
revoke all on function private.totus_stock_revision(uuid,text,text) from public,anon,authenticated;

create function public.totus_stock_create(p_store uuid,p_supplier text,p_reference text,p_date date,p_notes text default '',p_actor_email text default null)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('create',p_actor_email); r public.ops_stock_receipts;
begin
 if p_date>current_date then raise exception 'La recepción no puede tener fecha futura'; end if;
 if not exists(select 1 from public.ops_stores where id=p_store and active) then raise exception 'Tienda no disponible'; end if;
 insert into public.ops_stock_receipts(store_id,supplier,reference,received_on,notes,created_by)
 values(p_store,trim(p_supplier),trim(coalesce(p_reference,'')),p_date,coalesce(p_notes,''),auth.uid()) returning * into r;
 perform private.totus_stock_revision(r.id,'created',actor);return r;
end $$;

create function public.totus_stock_add_source(p_id uuid,p_revision integer,p_document uuid,p_kind text,p_text text,p_extraction jsonb,p_actor_email text default null)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);r public.ops_stock_receipts;d public.ops_documents;
begin
 select * into strict r from public.ops_stock_receipts where id=p_id for update;
 if r.revision<>p_revision then raise exception 'La recepción ha cambiado. Actualiza antes de guardar'; end if;
 select * into strict d from public.ops_documents where id=p_document for key share;
 if d.store_id is not null and d.store_id<>r.store_id then raise exception 'El documento corresponde a otra tienda'; end if;
 if not private.is_manager() and auth.uid() is not null and d.uploaded_by is distinct from auth.uid() then raise exception 'Solo gerencia puede asociar un archivo subido por otra persona'; end if;
 if exists(select 1 from public.ops_stock_sources s join public.ops_documents old on old.id=s.document_id
   where s.receipt_id=p_id and (s.document_id=p_document or (old.sha256 is not null and old.sha256=d.sha256))) then
  raise exception 'Este archivo ya está asociado a la recepción';
 end if;
 if jsonb_typeof(p_extraction) is distinct from 'object' or octet_length(p_extraction::text)>100000 then raise exception 'Información de lectura no válida'; end if;
 if p_extraction->>'state'='ready' and length(trim(coalesce(p_text,'')))=0 then raise exception 'No se puede dar por leído un documento sin texto'; end if;
 insert into public.ops_stock_sources(receipt_id,document_id,source_kind,extracted_text,extraction)
 values(p_id,p_document,p_kind,coalesce(p_text,''),p_extraction);
 update public.ops_stock_receipts set revision=revision+1,status='pending',result='{"rows":[],"coverage":[],"complete":false}',updated_at=now()
 where id=p_id returning * into r;
 perform private.totus_stock_revision(p_id,'source_added',actor);return r;
end $$;

create function public.totus_stock_remove_source(p_id uuid,p_revision integer,p_source uuid,p_reason text,p_actor_email text default null)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);r public.ops_stock_receipts;s public.ops_stock_sources;
begin
 select * into strict r from public.ops_stock_receipts where id=p_id for update;
 if r.revision<>p_revision then raise exception 'La recepción ha cambiado. Actualiza antes de guardar'; end if;
 if length(trim(coalesce(p_reason,'')))<3 then raise exception 'Indica por qué retiras esta asociación'; end if;
 select * into strict s from public.ops_stock_sources where receipt_id=p_id and id=p_source;
 delete from public.ops_stock_sources where id=p_source;
 update public.ops_documents set linked_entity_type='',linked_entity_id=null where id=s.document_id and linked_entity_type='stock_receipt' and linked_entity_id=p_id and not exists(select 1 from public.ops_stock_sources where document_id=s.document_id);
 update public.ops_stock_receipts set revision=revision+1,status='pending',result='{"rows":[],"coverage":[],"complete":false}',updated_at=now() where id=p_id returning * into r;
 perform private.totus_stock_revision(p_id,'source_removed',actor);
 update public.ops_stock_revisions set snapshot=snapshot||jsonb_build_object('removed_source',to_jsonb(s),'reason',p_reason)
 where receipt_id=p_id and revision=r.revision;
 return r;
end $$;

-- Every numeric result is recomputed here; a caller cannot submit a green status.
create function private.totus_stock_result(p_id uuid,p_result jsonb) returns text
language plpgsql set search_path='' as $$
declare row jsonb;ref jsonb;c jsonb;s record;f numeric;p numeric;a numeric;factor numeric;difference numeric;
 pending boolean=false;diff boolean=false;seen text[]='{}';key text;sid uuid;refcount integer;coverage_count integer;
begin
 if jsonb_typeof(p_result) is distinct from 'object' or octet_length(p_result::text)>1500000
  or jsonb_typeof(p_result->'rows') is distinct from 'array' or jsonb_array_length(p_result->'rows')>1500
  or jsonb_typeof(p_result->'coverage') is distinct from 'array' then raise exception 'Resultado no válido o demasiado grande'; end if;
 pending=p_result->'complete' is distinct from 'true'::jsonb or jsonb_array_length(p_result->'rows')=0;
 if not exists(select 1 from public.ops_stock_sources where receipt_id=p_id and source_kind='supplier')
  or not exists(select 1 from public.ops_stock_sources where receipt_id=p_id and source_kind='prestashop') then pending=true; end if;
 for s in select * from public.ops_stock_sources where receipt_id=p_id loop
  select count(*) into coverage_count from jsonb_array_elements(p_result->'coverage') x where x->>'source_id'=s.id::text;
  if coverage_count<>1 then pending=true;continue; end if;
  select x into c from jsonb_array_elements(p_result->'coverage') x where x->>'source_id'=s.id::text;
  if c->'complete' is distinct from 'true'::jsonb or length(trim(coalesce(c->>'explanation','')))=0 then pending=true; end if;
  if s.extraction->>'state'<>'ready' and not (c->'manually_verified'='true'::jsonb and length(trim(coalesce(c->>'reading_note','')))>0) then pending=true; end if;
 end loop;
 for c in select value from jsonb_array_elements(p_result->'coverage') loop
  if not exists(select 1 from public.ops_stock_sources where receipt_id=p_id and id::text=c->>'source_id') then raise exception 'La cobertura contiene un documento ajeno'; end if;
 end loop;
 for row in select value from jsonb_array_elements(p_result->'rows') loop
  if jsonb_typeof(row) is distinct from 'object' or length(trim(coalesce(row->>'id','')))=0 or length(row->>'id')>100 then raise exception 'Línea sin identificador válido'; end if;
  key='row:'||(row->>'id');if key=any(seen) then raise exception 'Línea duplicada'; end if;seen=array_append(seen,key);
  if jsonb_typeof(row->'source_refs') is distinct from 'array' then raise exception 'Faltan los orígenes de una línea'; end if;
  refcount=0;
  for ref in select value from jsonb_array_elements(row->'source_refs') loop
   sid=(ref->>'source_id')::uuid;
   if not exists(select 1 from public.ops_stock_sources where receipt_id=p_id and id=sid)
    or length(trim(coalesce(ref->>'locator','')))=0 or length(trim(coalesce(ref->>'line_id','')))=0 then raise exception 'Origen de línea no válido'; end if;
   key=sid::text||':'||(ref->>'line_id');if key=any(seen) then raise exception 'Una línea de origen está contada dos veces'; end if;
   seen=array_append(seen,key);refcount=refcount+1;
  end loop;
  if refcount=0 then pending=true; end if;
  if row->'match_confirmed' is distinct from 'true'::jsonb or row->'unit_confirmed' is distinct from 'true'::jsonb or length(trim(coalesce(row->>'unit','')))=0 then pending=true; end if;
  foreach key in array array['supplier_qty','prestashop_qty','adjustment_qty','unit_factor'] loop
   if row->key is null or row->key='null'::jsonb then pending=true;
   elsif jsonb_typeof(row->key)<>'number' or abs((row->>key)::numeric)>1000000 then raise exception 'Cantidad no válida'; end if;
  end loop;
  f=(row->>'supplier_qty')::numeric;p=(row->>'prestashop_qty')::numeric;a=(row->>'adjustment_qty')::numeric;factor=(row->>'unit_factor')::numeric;
  if factor is null or factor<=0 then pending=true;end if;
  if factor<>1 and length(trim(coalesce(row->>'conversion_reason','')))=0 then pending=true;end if;
  if a<>0 and length(trim(coalesce(row->>'adjustment_reason','')))=0 then pending=true;end if;
  if coalesce(row->>'adjustment_included','') not in ('yes','no') then pending=true;
  else
   difference=round(p-case when row->>'adjustment_included'='yes' then a else 0 end-f*factor,6);
   if difference<>0 then diff=true;end if;
  end if;
 end loop;
 return case when pending then 'needs_review' when diff then 'differences' else 'matched' end;
end $$;
revoke all on function private.totus_stock_result(uuid,jsonb) from public,anon,authenticated;

create function public.totus_stock_save_result(p_id uuid,p_revision integer,p_result jsonb,p_actor_email text default null)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);r public.ops_stock_receipts;new_status text;
begin
 select * into strict r from public.ops_stock_receipts where id=p_id for update;
 if r.revision<>p_revision then raise exception 'La recepción ha cambiado. Vuelve a leerla antes de guardar el resultado'; end if;
 new_status=private.totus_stock_result(p_id,p_result);
 update public.ops_stock_receipts set result=p_result,status=new_status,revision=revision+1,updated_at=now() where id=p_id returning * into r;
 perform private.totus_stock_revision(p_id,'result_saved',actor);return r;
end $$;

create function public.totus_stock_context(p_id uuid,p_actor_email text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('view',p_actor_email);r public.ops_stock_receipts;
begin
 select * into strict r from public.ops_stock_receipts where id=p_id;
 return jsonb_build_object('receipt',to_jsonb(r),'sources',coalesce((
 select jsonb_agg(to_jsonb(s)||jsonb_build_object('document',to_jsonb(d),'graph_item_url',
 case when m.onedrive_item_id is not null and cfg.drive_id is not null
 then 'https://graph.microsoft.com/v1.0/drives/'||cfg.drive_id||'/items/'||m.onedrive_item_id else null end) order by s.created_at,s.id)
 from public.ops_stock_sources s join public.ops_documents d on d.id=s.document_id
 left join public.ops_onedrive_documents m on m.document_id=d.id
 left join public.ops_onedrive_config cfg on cfg.id=1 where s.receipt_id=p_id),'[]'::jsonb),
 'equivalences',coalesce((select jsonb_agg(to_jsonb(e)) from public.ops_stock_equivalences e
 where e.store_id=r.store_id and lower(e.supplier)=lower(r.supplier)),'[]'::jsonb));
end $$;

create function public.totus_stock_confirm_equivalence(p_store uuid,p_supplier text,p_supplier_name text,p_prestashop_name text,p_variant text,p_unit text,p_factor numeric,p_evidence text,p_actor_email text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);new_id uuid;
begin
 if auth.uid() is not null and not private.is_manager() then raise exception 'Solo gerencia puede confirmar equivalencias';end if;
 if length(trim(p_supplier))=0 or length(trim(p_supplier_name))=0 or length(trim(p_prestashop_name))=0 then raise exception 'Faltan los nombres de la equivalencia';end if;
 insert into public.ops_stock_equivalences(store_id,supplier,supplier_name,prestashop_name,variant,unit,unit_factor,evidence,confirmed_by)
 values(p_store,trim(p_supplier),trim(p_supplier_name),trim(p_prestashop_name),trim(coalesce(p_variant,'')),trim(p_unit),p_factor,trim(p_evidence),actor)
 returning id into new_id;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail) values(auth.uid(),actor,'documentos','stock_equivalence_confirmed',jsonb_build_object('equivalence_id',new_id));
 return new_id;
end $$;
revoke all on function public.totus_stock_create(uuid,text,text,date,text,text),public.totus_stock_add_source(uuid,integer,uuid,text,text,jsonb,text),
 public.totus_stock_remove_source(uuid,integer,uuid,text,text),public.totus_stock_save_result(uuid,integer,jsonb,text),
 public.totus_stock_context(uuid,text),public.totus_stock_confirm_equivalence(uuid,text,text,text,text,text,numeric,text,text) from public,anon;
grant execute on function public.totus_stock_create(uuid,text,text,date,text,text),public.totus_stock_add_source(uuid,integer,uuid,text,text,jsonb,text),
 public.totus_stock_remove_source(uuid,integer,uuid,text,text),public.totus_stock_save_result(uuid,integer,jsonb,text),
 public.totus_stock_context(uuid,text),public.totus_stock_confirm_equivalence(uuid,text,text,text,text,text,numeric,text,text) to authenticated,service_role;

create function private.totus_stock_protect_document() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.ops_stock_sources where document_id=old.id)
  and (new.store_id is distinct from old.store_id or new.storage_path is distinct from old.storage_path or new.sha256 is distinct from old.sha256 or new.size_bytes is distinct from old.size_bytes) then
  raise exception 'Este original forma parte de una recepción. Retira su asociación antes de sustituir el archivo';
 end if;
 return new;
end $$;
revoke all on function private.totus_stock_protect_document() from public,anon,authenticated;
create trigger stock_protect_document before update on public.ops_documents for each row execute function private.totus_stock_protect_document();

create function public.totus_stock_edit(p_id uuid,p_revision integer,p_store uuid,p_supplier text,p_reference text,p_date date,p_notes text,p_actor_email text default null)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);r public.ops_stock_receipts;
begin
 select * into strict r from public.ops_stock_receipts where id=p_id for update;
 if r.revision<>p_revision then raise exception 'La recepción ha cambiado. Actualiza antes de editar';end if;
 if p_date>current_date or not exists(select 1 from public.ops_stores where id=p_store and active) then raise exception 'Fecha o tienda no válida';end if;
 if exists(select 1 from public.ops_stock_sources s join public.ops_documents d on d.id=s.document_id where s.receipt_id=p_id and d.store_id is not null and d.store_id<>p_store) then
  raise exception 'Retira los documentos de la otra tienda antes de cambiarla';
 end if;
 update public.ops_stock_receipts set store_id=p_store,supplier=trim(p_supplier),reference=trim(coalesce(p_reference,'')),received_on=p_date,notes=coalesce(p_notes,''),
  revision=revision+1,status='pending',result='{"rows":[],"coverage":[],"complete":false}',updated_at=now() where id=p_id returning * into r;
 perform private.totus_stock_revision(p_id,'edited',actor);return r;
end $$;
revoke all on function public.totus_stock_edit(uuid,integer,uuid,text,text,date,text,text) from public,anon;
grant execute on function public.totus_stock_edit(uuid,integer,uuid,text,text,date,text,text) to authenticated,service_role;
