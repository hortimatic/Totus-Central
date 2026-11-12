-- Personal and explicitly shared presentation, inside backed-up profile JSON.
begin;
create or replace function private.totus_validate_directory_layout(p_kind text,p_layout jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare valid text[];pair record;
begin
 valid=case p_kind
 when 'clientes' then array['id','firstname','lastname','email','company','phone','phone_mobile','address1','address2','postcode','city','country','province','dni','vat_number','birthday','website','active','is_guest','newsletter','optin','id_default_group','id_lang','siret','ape','outstanding_allow_amount','show_public_prices','id_risk','max_payment_days','orders','spent','margin','date_add','date_upd']
 when 'proveedores' then array['id','name','active','description','meta_title','meta_description','meta_keywords','phone','phone_mobile','address1','address2','postcode','city','country','province','dni','vat_number','products','date_add','date_upd']
 when 'marcas' then array['id','name','active','description','short_description','meta_title','meta_description','meta_keywords','phone','phone_mobile','address1','address2','postcode','city','country','province','products','date_add','date_upd']
 when 'atributos' then array['id','name','public_name','group_type','color','position','values','products','parent','custom'] end;
 if valid is null or jsonb_typeof(p_layout) is distinct from 'object' or octet_length(p_layout::text)>16000 or exists(select 1 from jsonb_object_keys(p_layout)k where k not in ('columns','widths','pageSize','sort','direction','density','source')) then raise exception 'Distribución de directorio no válida.';end if;
 if jsonb_typeof(p_layout->'columns') is distinct from 'array' or jsonb_array_length(p_layout->'columns') not between 1 and cardinality(valid) or not(p_layout->'columns' ? 'id') or exists(select 1 from jsonb_array_elements(p_layout->'columns')c where jsonb_typeof(c)<>'string' or not(c#>>'{}')=any(valid)) or (select count(distinct c) from jsonb_array_elements(p_layout->'columns')c)<>jsonb_array_length(p_layout->'columns') then raise exception 'Columnas de directorio no válidas.';end if;
 if jsonb_typeof(p_layout->'widths') is distinct from 'object' then raise exception 'Anchos no válidos.';end if;
 for pair in select * from jsonb_each(p_layout->'widths') loop
  if not(pair.key=any(valid) or pair.key='actions') or jsonb_typeof(pair.value)<>'number' or (pair.value::text)::numeric not between 80 and 640 or trunc((pair.value::text)::numeric)<>(pair.value::text)::numeric then raise exception 'Ancho no válido.';end if;
 end loop;
 if p_layout ? 'pageSize' and (jsonb_typeof(p_layout->'pageSize')<>'number' or not(p_layout->>'pageSize')=any(array['0','10','20','50','100'])) then raise exception 'Tamaño de página no válido.';end if;
 if p_layout ? 'sort' and (jsonb_typeof(p_layout->'sort')<>'string' or not(p_layout->>'sort')=any(valid)) then raise exception 'Orden no válido.';end if;
 if p_layout ? 'direction' and (jsonb_typeof(p_layout->'direction')<>'string' or p_layout->>'direction' not in ('asc','desc')) then raise exception 'Dirección no válida.';end if;
 if p_layout ? 'density' and (jsonb_typeof(p_layout->'density')<>'string' or p_layout->>'density' not in ('compact','normal')) then raise exception 'Densidad no válida.';end if;
 if p_layout ? 'source' and (jsonb_typeof(p_layout->'source')<>'string' or p_layout->>'source' not in ('local','hortimatic','newoldsmok')) then raise exception 'Origen de tabla no válido.';end if;
 return p_layout;
end $$;
create or replace function public.totus_directory_table(p_kind text,p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;clean jsonb;
begin
 perform public.totus_directory_context(p_kind,'view');
 select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'Perfil no disponible.';end if;
 if p_layout is null then return prefs#>array['directory_tables',p_kind];end if;
 clean=private.totus_validate_directory_layout(p_kind,p_layout);
 update public.profiles set ui_preferences=prefs||jsonb_build_object('directory_tables',coalesce(prefs->'directory_tables','{}')||jsonb_build_object(p_kind,clean)) where id=auth.uid();
 return clean;
end $$;
create or replace function public.totus_directory_views(p_kind text,p_action text default 'list',p_id uuid default null,p_name text default null,p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;book jsonb;clean jsonb;profile_id uuid;
begin
 perform public.totus_directory_context(p_kind,'view');
 if p_action in ('share','remove') then
  select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Perfil no disponible.';end if;
  book=case when jsonb_typeof(prefs#>array['directory_views',p_kind])='array' then prefs#>array['directory_views',p_kind] else '[]'::jsonb end;
  if p_action='share' then
   clean=private.totus_validate_directory_layout(p_kind,jsonb_build_object('columns',p_layout->'columns','widths',p_layout->'widths'));
   if p_name is null or length(trim(p_name)) not between 1 and 60 then raise exception 'Escribe un nombre de hasta 60 caracteres.';end if;
   select (x.value->>'id')::uuid into profile_id from jsonb_array_elements(book)x where x.value->>'name'=trim(p_name) limit 1;
   if profile_id is null and jsonb_array_length(book)>=30 then raise exception 'Puedes compartir hasta 30 perfiles por directorio.';end if;
   select coalesce(jsonb_agg(x.value),'[]') into book from jsonb_array_elements(book)x where x.value->>'name' is distinct from trim(p_name);
   book=book||jsonb_build_array(jsonb_build_object('id',coalesce(profile_id,gen_random_uuid()),'name',trim(p_name),'layout',clean,'updated_at',clock_timestamp()));
  else
   if not exists(select 1 from jsonb_array_elements(book)x where x.value->>'id'=p_id::text) then raise exception 'Solo puedes retirar tus propios perfiles compartidos.';end if;
   select coalesce(jsonb_agg(x.value),'[]') into book from jsonb_array_elements(book)x where x.value->>'id' is distinct from p_id::text;
  end if;
  update public.profiles set ui_preferences=prefs||jsonb_build_object('directory_views',coalesce(prefs->'directory_views','{}')||jsonb_build_object(p_kind,book)) where id=auth.uid();
 elsif p_action is distinct from 'list' then raise exception 'Acción de perfiles no válida.';
 end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',x.value->>'id','name',x.value->>'name','layout',x.value->'layout','mine',p.id=auth.uid(),'updated_at',x.value->>'updated_at') order by x.value->>'name',x.value->>'id') from public.profiles p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.ui_preferences#>array['directory_views',p_kind])='array' then p.ui_preferences#>array['directory_views',p_kind] else '[]'::jsonb end)x),'[]');
end $$;
revoke all on function private.totus_validate_directory_layout(text,jsonb),public.totus_directory_table(text,jsonb),public.totus_directory_views(text,text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.totus_directory_table(text,jsonb),public.totus_directory_views(text,text,uuid,text,jsonb) to authenticated;
commit;
