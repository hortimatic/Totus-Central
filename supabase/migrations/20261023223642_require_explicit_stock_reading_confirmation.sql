-- Missing extraction metadata or manual confirmation must never count as verified reading.
CREATE OR REPLACE FUNCTION private.totus_stock_result(p_id uuid, p_result jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
  if s.extraction->>'state' is distinct from 'ready' and not (c->'manually_verified' is not distinct from 'true'::jsonb and length(trim(coalesce(c->>'reading_note','')))>0) then pending=true; end if;
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
end $function$

