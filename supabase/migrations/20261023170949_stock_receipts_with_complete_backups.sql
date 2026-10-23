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
 elsif auth.role()='service_role' or (session_user='postgres' and nullif(current_setting('request.jwt.claims',true),'') is null) then
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

-- Verified cloud imports: the server checks the original bytes before this transaction.
create function public.totus_stock_register_cloud_document(p_id uuid,p_revision integer,p_kind text,p_path text,p_item text,p_name text,p_size bigint,p_sha text,p_text text,p_extraction jsonb,p_actor_email text)
returns public.ops_stock_receipts language plpgsql security definer set search_path='' as $$
declare r public.ops_stock_receipts;actor text;doc uuid;source_path text;u uuid;
begin
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'Importación reservada al servidor verificador';end if;
 actor=private.totus_stock_actor('edit',p_actor_email);
 select * into strict r from public.ops_stock_receipts where id=p_id for update;
 if exists(select 1 from public.ops_stock_sources s join public.ops_onedrive_documents m on m.document_id=s.document_id where s.receipt_id=p_id and s.source_kind=p_kind and m.onedrive_item_id=p_item) then return r;end if;
 if r.revision<>p_revision then raise exception 'La recepción ha cambiado. Actualiza antes de asociar el archivo';end if;
 if p_path not like '01 Documentos/Recepciones/%' or p_path~'(^|/)\.\.?(/|$)|[\\]' or length(p_item)>300 or p_item='' or p_size<=0 or p_size>20971520 or p_sha!~'^[0-9a-f]{64}$' or length(p_name)>250 then raise exception 'Original verificado no válido';end if;
 select id into u from auth.users where lower(email)=actor;
 source_path='stock/'||p_id::text||'/'||p_sha||'.'||lower(substring(p_name from '\.([a-zA-Z0-9]+)$'));
 if source_path is null then raise exception 'El original necesita una extensión de archivo';end if;
 insert into public.ops_documents(store_id,doc_type,document_date,supplier_or_customer,invoice_number,category_code,status,storage_path,original_name,mime_type,size_bytes,sha256,linked_entity_type,linked_entity_id,notes,uploaded_by)
 values(r.store_id,'otro',r.received_on,r.supplier,r.reference,'recepcion_mercancia','pendiente',source_path,p_name,
  case when lower(p_name) like '%.pdf' then 'application/pdf' else 'application/octet-stream' end,p_size,p_sha,'stock_receipt',p_id,'Original importado y verificado desde OneDrive; no crea un gasto.',u) returning id into doc;
 insert into public.ops_onedrive_documents(document_id,source_path,onedrive_path,onedrive_item_id,size_bytes,sha256,verified_at,retired_from_supabase_at)
 values(doc,source_path,p_path,p_item,p_size,p_sha,now(),now());
 select * into r from public.totus_stock_add_source(p_id,p_revision,doc,p_kind,p_text,p_extraction,actor);
 return r;
end $$;
revoke all on function public.totus_stock_register_cloud_document(uuid,integer,text,text,text,text,bigint,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.totus_stock_register_cloud_document(uuid,integer,text,text,text,text,bigint,text,text,jsonb,text) to service_role;

create function public.totus_stock_import_request(p_id uuid,p_revision integer,p_kind text,p_path text,p_item text,p_name text,p_quickxor text,p_text text,p_extraction jsonb,p_actor_email text default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare actor text=private.totus_stock_actor('edit',p_actor_email);job_key text;request_id bigint;
begin
 if not exists(select 1 from public.team_members where lower(email)=actor and active and role='admin') then raise exception 'Solo administración puede importar desde OneDrive';end if;
 if p_path not like '01 Documentos/Recepciones/%' or length(p_path)>1024 or length(p_item)>300 or length(p_name)>250 or length(p_text)>250000 or jsonb_typeof(p_extraction) is distinct from 'object' or length(p_extraction::text)>100000 then raise exception 'Solicitud de importación no válida';end if;
 if not exists(select 1 from public.ops_stock_receipts where id=p_id and revision=p_revision) then raise exception 'Actualiza la recepción antes de importar';end if;
 select decrypted_secret into strict job_key from vault.decrypted_secrets where name='totus_staging_backup_cron_secret';
 select net.http_post(
  url:='https://awmojepsasikxocoeqtu.supabase.co/functions/v1/totus-onedrive',
  headers:=jsonb_build_object('Content-Type','application/json','x-totus-backup-job',job_key),
  body:=jsonb_build_object('action','import-stock-document','receipt_id',p_id,'revision',p_revision,'kind',p_kind,'path',p_path,'item_id',p_item,'name',p_name,'quickxor',p_quickxor,'text',p_text,'extraction',p_extraction,'actor_email',actor),
  timeout_milliseconds:=60000) into request_id;
 return request_id;
end $$;
revoke all on function public.totus_stock_import_request(uuid,integer,text,text,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.totus_stock_import_request(uuid,integer,text,text,text,text,text,text,jsonb,text) to authenticated;


CREATE OR REPLACE FUNCTION private.totus_recovery_tables()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select array[
 'ops_business_settings','ops_stores','ops_expense_categories','ops_cash_drawers','ops_invoice_series',
 'ops_suppliers','ops_customers','ops_document_templates','ops_documents','ops_daily_closings','ops_daily_closing_drawers',
 'ops_expenses','ops_expense_lines','ops_sales_invoices','ops_sales_invoice_lines','ops_tax_payments','ops_fiscal_adjustments','ops_income_adjustments','ops_reta_brackets','ops_audit_log',
 'brands','families','providers','products','product_variants','product_provider_prices','product_competitor_prices','price_history','consultations','consultation_history',
 'ops_roles','ops_role_permissions','ops_user_permissions','ops_backup_config',
 'profiles','team_members','team_email_log','team_user_audit_log',
 'ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences']::text[];
$function$;


-- Old backups predate the stock module. Restore its four absent tables as empty,
-- but only for the exact original 38-table set. No accounting table is optional.
create function private.totus_stock_recovery_payload(p_payload jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare extras text[]=array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences']; tab text; n integer;
begin
 select count(*) into n from unnest(extras) t where p_payload?t;
 if n=0 then
  if jsonb_typeof(p_payload)<>'object' or (select count(*) from jsonb_object_keys(p_payload))<>38 then raise exception 'Inventario de copia incompleto'; end if;
  foreach tab in array private.totus_recovery_tables() loop
   if not tab=any(extras) and jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla %',tab;end if;
  end loop;
  foreach tab in array extras loop p_payload=p_payload||jsonb_build_object(tab,'[]'::jsonb);end loop;
 elsif n<>4 then raise exception 'Las tablas de cotejos de la copia están incompletas';end if;
 return p_payload;
end $$;
revoke all on function private.totus_stock_recovery_payload(jsonb) from public,anon,authenticated;

CREATE OR REPLACE FUNCTION public.totus_verify_recovery_rows(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tabs text[]=private.totus_recovery_tables(); tab text; cols text; tmp text; expected jsonb; actual jsonb; counts jsonb='{}'; fk record; child_cols text; parent_cols text; parent_name text; fk_count integer=0; join_test text; not_null_test text; null_test text; invalid boolean;
begin
 if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'Comprobación reservada al servidor'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or pg_column_size(p_payload)>20971520 then raise exception 'Datos de comprobación no válidos o demasiado grandes'; end if;
 p_payload=private.totus_stock_recovery_payload(p_payload);
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
  tmp='qa_restore_'||tab;
  execute format('create temporary table %I (like public.%I including defaults including constraints including generated including identity including indexes) on commit drop',tmp,tab);
  select string_agg(format('%I',a.attname),',' order by a.attnum) into cols from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass and a.attnum>0 and not a.attisdropped and a.attgenerated='';
  execute format('insert into pg_temp.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tmp,cols,cols,tab) using p_payload->tab;
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from pg_temp.%I r',tmp) into actual;
  select coalesce(jsonb_agg(case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end order by (case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end)::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
  if actual is distinct from expected then raise exception 'Los datos restaurados de % no coinciden con la copia',tab; end if;
  counts=counts||jsonb_build_object(tab,jsonb_array_length(p_payload->tab));
 end loop;
 for fk in select c.*,child.relname child_table,parent.relname parent_table,pn.nspname parent_schema from pg_catalog.pg_constraint c join pg_catalog.pg_class child on child.oid=c.conrelid join pg_catalog.pg_namespace cn on cn.oid=child.relnamespace join pg_catalog.pg_class parent on parent.oid=c.confrelid join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace where c.contype='f' and cn.nspname='public' and child.relname=any(tabs) loop
  select string_agg(format('%I',a.attname),',' order by k.n) into child_cols from unnest(fk.conkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=fk.conrelid and a.attnum=k.attnum;
  select string_agg(format('%I',a.attname),',' order by k.n) into parent_cols from unnest(fk.confkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=fk.confrelid and a.attnum=k.attnum;
  if fk.parent_schema='public' and fk.parent_table=any(tabs) then
   parent_name=format('pg_temp.%I','qa_restore_'||fk.parent_table);
   execute format('alter table pg_temp.%I add constraint %I foreign key (%s) references %s (%s) match %s','qa_restore_'||fk.child_table,'qa_fk_'||fk.oid,child_cols,parent_name,parent_cols,case fk.confmatchtype when 'f' then 'full' else 'simple' end);
  else
   parent_name=format('%I.%I',fk.parent_schema,fk.parent_table);
   select string_agg(format('r.%I=p.%I',ca.attname,pa.attname),' and ' order by k.n),string_agg(format('r.%I is not null',ca.attname),' and ' order by k.n),string_agg(format('r.%I is null',ca.attname),' and ' order by k.n)
   into join_test,not_null_test,null_test from unnest(fk.conkey,fk.confkey) with ordinality k(child_num,parent_num,n)
   join pg_catalog.pg_attribute ca on ca.attrelid=fk.conrelid and ca.attnum=k.child_num
   join pg_catalog.pg_attribute pa on pa.attrelid=fk.confrelid and pa.attnum=k.parent_num;
   execute format('select exists(select 1 from pg_temp.%I r where ((%s) and not exists(select 1 from %s p where %s)) or (%L and not (%s) and not (%s)))','qa_restore_'||fk.child_table,not_null_test,parent_name,join_test,fk.confmatchtype='f',not_null_test,null_test) into invalid;
   if invalid then raise exception 'Referencia externa no válida en %',fk.child_table; end if;
  end if;
  fk_count=fk_count+1;
 end loop;
 return jsonb_build_object('verified',true,'mode','temporary-tables-no-live-writes','table_count',cardinality(tabs),'foreign_keys',fk_count,'counts',counts);
end $function$;

CREATE OR REPLACE FUNCTION public.totus_commit_recovery(p_job uuid, p_payload jsonb, p_metadata jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET lock_timeout TO '5s'
AS $function$
declare job public.ops_recovery_jobs; tab text; tabs text[]=private.totus_recovery_tables();
 pending text[]; remaining text[]; ready boolean; progressed boolean; before_data jsonb; after_data jsonb;
 columns_sql text; truncate_sql text; trigger_state jsonb; seq record; next_id bigint;
 onedrive_before jsonb; expected jsonb; counts jsonb='{}'; item jsonb;
begin
 perform 1 from public.ops_onedrive_config where id=1 for update;
 if exists(select 1 from public.ops_onedrive_config where id=1 and retirement_lock_until>now()) then
  raise exception 'Espera a que termine la limpieza de duplicados antes de recuperar una copia';
 end if;
 select * into job from public.ops_recovery_jobs where id=p_job for update;
 if not found then raise exception 'Solicitud de recuperación inexistente'; end if;
 if job.status='committed' then return job.result; end if;
 if job.status<>'prepared' or job.checkpoint_path is null or job.before_revision is null then
  raise exception 'La preparación y el punto de recuperación no están completos';
 end if;
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
  where u.id=job.requested_by and lower(u.email)=job.requested_email and t.active and t.role='admin') then
  raise exception 'La cuenta solicitante ya no es un administrador activo';
 end if;
 if p_metadata->>'database_instance' is distinct from (select instance_id::text from private.totus_recovery_identity where singleton)
  or not coalesce((p_metadata->>'schema_hash'=private.totus_recovery_schema_hash()
   or (p_metadata->>'schema_hash'='52e2e40d2b27ca87540ab4f94e52c850235674b555ecd60fe3bb08eb181f8f45'
    and not (p_payload ?| array['ops_stock_receipts','ops_stock_sources','ops_stock_revisions','ops_stock_equivalences'])
    and (select count(*) from jsonb_object_keys(p_payload))=38)),false) then
  raise exception 'La copia pertenece a otro proyecto o a una estructura de datos incompatible';
 end if;
 if jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Datos de copia no válidos'; end if;
 p_payload=private.totus_stock_recovery_payload(p_payload);
 foreach tab in array tabs loop
  if jsonb_typeof(p_payload->tab) is distinct from 'array' then raise exception 'Falta la tabla % en la copia',tab; end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p_payload->'team_members') t
   where lower(t->>'email')=job.requested_email and t->>'role'='admin' and (t->>'active')::boolean)
  or not exists(select 1 from jsonb_array_elements(p_payload->'profiles') p
   where p->>'id'=job.requested_by::text and lower(p->>'email')=job.requested_email) then
  raise exception 'La copia no conserva la cuenta administradora que realiza la recuperación';
 end if;
 for item in select value from jsonb_array_elements(p_payload->'profiles') loop
  if not exists(select 1 from auth.users u join jsonb_array_elements(p_metadata->'identities') i
   on i->>'id'=u.id::text and lower(i->>'email')=lower(u.email)
   where u.id::text=item->>'id' and lower(u.email)=lower(item->>'email')) then
   raise exception 'La copia hace referencia a una cuenta que falta o ha cambiado. No se han sustituido datos';
  end if;
 end loop;
 if not private.totus_recovery_files_ready(p_payload,p_job) then
  raise exception 'Hay archivos de la copia que no han sido preparados';
 end if;
 for tab in select unnest(tabs) order by 1 loop
  execute format('lock table public.%I in access exclusive mode',tab);
 end loop;
 before_data=private.totus_recovery_dataset();
 if encode(extensions.digest(before_data::text,'sha256'),'hex')<>job.before_revision then
  raise exception 'Los datos han cambiado durante la preparación. Se cancela para conservar los cambios recientes';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'state',t.tgenabled)),'[]'::jsonb)
 into trigger_state from pg_catalog.pg_trigger t join pg_catalog.pg_class c on c.oid=t.tgrelid
 join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=any(tabs) and not t.tgisinternal;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I disable trigger %I',item->>'table',item->>'name');
 end loop;
 select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) into onedrive_before from public.ops_onedrive_documents m;
 select string_agg(format('public.%I',t),',') into truncate_sql from unnest(tabs) t;
 if pg_catalog.to_regclass('public.ops_onedrive_documents') is not null then truncate_sql=truncate_sql||',public.ops_onedrive_documents'; end if;
 execute 'truncate table '||truncate_sql||' restart identity';
 pending=tabs;
 while cardinality(pending)>0 loop
  progressed=false;remaining='{}'::text[];
  foreach tab in array pending loop
   select not exists(select 1 from pg_catalog.pg_constraint c
    where c.contype='f' and c.conrelid=format('public.%I',tab)::regclass
    and c.confrelid<>c.conrelid and c.confrelid in
      (select format('public.%I',x)::regclass from unnest(pending) x)) into ready;
   if ready then
    select string_agg(format('%I',a.attname),',' order by a.attnum) into columns_sql
     from pg_catalog.pg_attribute a where a.attrelid=format('public.%I',tab)::regclass
     and a.attnum>0 and not a.attisdropped and a.attgenerated='';
    execute format('insert into public.%I (%s) overriding system value select %s from jsonb_populate_recordset(null::public.%I,$1)',tab,columns_sql,columns_sql,tab)
     using p_payload->tab;
    counts=counts||jsonb_build_object(tab,jsonb_array_length(p_payload->tab));
    progressed=true;
   else remaining=array_append(remaining,tab);
   end if;
  end loop;
  if not progressed then raise exception 'Dependencias cíclicas no compatibles con la recuperación'; end if;
  pending=remaining;
 end loop;

 insert into public.ops_onedrive_documents(document_id,source_path,onedrive_path,onedrive_item_id,size_bytes,sha256,verified_at,retired_from_supabase_at)
 select d.id,m.source_path,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256,m.verified_at,m.retired_from_supabase_at
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 join public.ops_documents d on d.storage_path=m.source_path and d.sha256=m.sha256 and d.size_bytes=m.size_bytes
 where m.verified_at is not null
 on conflict(document_id) do nothing;
 insert into public.ops_onedrive_cleanup(document_id,onedrive_path,onedrive_item_id,size_bytes,sha256)
 select m.document_id,m.onedrive_path,m.onedrive_item_id,m.size_bytes,m.sha256
 from jsonb_populate_recordset(null::public.ops_onedrive_documents,onedrive_before) m
 where not exists(select 1 from public.ops_onedrive_documents live where live.onedrive_item_id=m.onedrive_item_id)
 on conflict(onedrive_item_id) do nothing;
 after_data=private.totus_recovery_dataset();

 foreach tab in array tabs loop
  select coalesce(jsonb_agg(case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end order by (case when tab='profiles' then jsonb_build_object('ui_preferences',null)||value else value end)::text),'[]'::jsonb) into expected from jsonb_array_elements(p_payload->tab);
  if after_data->tab is distinct from expected then raise exception 'La verificación de la tabla % no coincide con la copia',tab; end if;
 end loop;
 for seq in select c.table_name,c.column_name,pg_catalog.pg_get_serial_sequence(format('public.%I',c.table_name),c.column_name) as name
  from information_schema.columns c where c.table_schema='public' and c.table_name=any(tabs) loop
  if seq.name is not null then
   execute format('select greatest(coalesce(max(%I),0)+1,1) from public.%I',seq.column_name,seq.table_name) into next_id;
   execute format('alter sequence %s restart with %s',seq.name,next_id);
  end if;
 end loop;
 for item in select value from jsonb_array_elements(trigger_state) loop
  execute format('alter table public.%I %s trigger %I',item->>'table',
   case item->>'state' when 'D' then 'disable' when 'R' then 'enable replica' when 'A' then 'enable always' else 'enable' end,item->>'name');
 end loop;
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values(job.requested_by,job.requested_email,'administracion','recovery_committed',
  jsonb_build_object('job',p_job,'checkpoint',job.checkpoint_path,'before_revision',job.before_revision,'counts',counts));
 update public.ops_recovery_jobs set status='committed',result=counts,finished_at=now(),error=null where id=p_job;
 return counts;
end;
$function$;
