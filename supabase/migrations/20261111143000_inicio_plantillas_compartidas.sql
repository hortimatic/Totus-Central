-- Totus Central · shared, named Inicio layouts, pending independent security review.
-- No accounting, invoice, store, stock or authentication tables are modified.
-- Private table is deliberately not exposed through the Data API.
create table private.totus_home_style_templates (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 owner_id uuid not null,
 name text not null check (pg_catalog.char_length(name) between 3 and 60),
 layout jsonb not null,
 created_at timestamptz not null default pg_catalog.now(),
 deleted_at timestamptz
);
alter table private.totus_home_style_templates enable row level security;
revoke all on table private.totus_home_style_templates from public, anon, authenticated;
create unique index totus_home_style_owner_name_live
 on private.totus_home_style_templates(owner_id,pg_catalog.lower(name)) where deleted_at is null;

create or replace function private.totus_home_styles(
 p_action text,
 p_template_id uuid default null,
 p_name text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $func$
declare
 uid uuid := auth.uid();
 saved jsonb;
 clean jsonb;
 normalized_name text;
 saved_id uuid;
 found_record record;
begin
 -- Match the existing personal Inicio RPC's session checks; never infer identity
 -- from request arguments. Team membership alone cannot activate a disabled profile.
 if uid is null or not exists(
  select 1 from public.profiles p
  join public.team_members t on pg_catalog.lower(t.email)=pg_catalog.lower(p.email)
  where p.id=uid and p.active=true and t.active=true
    and pg_catalog.lower(p.email)=pg_catalog.lower(auth.jwt()->>'email')
 ) then raise exception 'Acceso denegado: perfil de Inicio no habilitado' using errcode='42501';end if;

 if p_action not in ('list','read','publish','remove') or p_action is null then
  raise exception 'Acción de plantilla no admitida';
 end if;
 if not private.totus_can('inicio','view') then
  raise exception 'Sin permiso de lectura del Inicio' using errcode='42501';
 end if;

 if p_action='list' then
  if p_template_id is not null or p_name is not null then
   raise exception 'Parámetros no admitidos en la lista';
  end if;
  return pg_catalog.jsonb_build_object('items',coalesce((
   select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',s.id,'name',s.name,'mine',s.owner_id=uid,
    'author',coalesce(nullif(pg_catalog.btrim(p.full_name),''),'Equipo'),
    'created_at',s.created_at
   ) order by s.created_at desc)
   from (
    select * from private.totus_home_style_templates where deleted_at is null
    order by created_at desc limit 100
   ) s join public.profiles p on p.id=s.owner_id and p.active=true
   join public.team_members t on pg_catalog.lower(t.email)=pg_catalog.lower(p.email) and t.active=true
  ),'[]'::jsonb));
 end if;

 if p_action='read' then
  if p_template_id is null or p_name is not null then
   raise exception 'Identificador de plantilla necesario';
  end if;
  select s.id,s.name,s.layout,s.owner_id into found_record
  from private.totus_home_style_templates s
  join public.profiles p on p.id=s.owner_id and p.active=true
  join public.team_members t on pg_catalog.lower(t.email)=pg_catalog.lower(p.email) and t.active=true
  where s.id=p_template_id and s.deleted_at is null;
  if not found then raise exception 'Plantilla no disponible';end if;
  return pg_catalog.jsonb_build_object('id',found_record.id,'name',found_record.name,'layout',found_record.layout,'mine',found_record.owner_id=uid);
 end if;

 if not private.totus_can('inicio','edit') then
  raise exception 'Sin permiso para publicar o retirar plantillas' using errcode='42501';
 end if;
 if p_action='remove' then
  if p_template_id is null or p_name is not null then raise exception 'Plantilla no indicada';end if;
  update private.totus_home_style_templates set deleted_at=pg_catalog.now()
  where id=p_template_id and owner_id=uid and deleted_at is null;
  if not found then raise exception 'Solo puedes retirar una plantilla propia';end if;
  return pg_catalog.jsonb_build_object('removed',true,'id',p_template_id);
 end if;

 -- Publish only an ALREADY VALIDATED personal saved layout: callers cannot
 -- supply JSON payloads, foreign user IDs, CSS, secrets or arbitrary objects.
 if p_template_id is not null or p_name is null then raise exception 'Nombre de plantilla necesario';end if;
 normalized_name:=pg_catalog.btrim(p_name);
 if pg_catalog.char_length(normalized_name)<3 or pg_catalog.char_length(normalized_name)>60
  or normalized_name ~ '[[:cntrl:]]'
 then raise exception 'El nombre debe tener entre 3 y 60 caracteres';end if;
 if (select pg_catalog.count(*) from private.totus_home_style_templates where owner_id=uid and deleted_at is null)>=20
 then raise exception 'Límite de 20 plantillas por usuario';end if;
 select p.ui_preferences->'home_dashboard'->'layout' into saved
 from public.profiles p where p.id=uid;
 if saved is null or saved->>'schemaVersion'<>'1' or pg_catalog.jsonb_typeof(saved->'widgets')<>'array'
 then raise exception 'Guarda primero tu propio Inicio antes de publicar una plantilla';end if;

 -- Strip personal search, dates, order, payment and free-form widget titles. Share appearance,
 -- widget choices, positions, titles and selected presentation options only.
 select pg_catalog.jsonb_build_object(
  'schemaVersion',1,
  'settings',coalesce(saved->'settings','{}'::jsonb),
  'widgets',coalesce((
   select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',w.item->'id','type',w.item->'type','title',pg_catalog.to_jsonb(case w.item->>'type'
     when 'cash.openings' then 'Dinero para abrir mañana'
     when 'home.income' then 'Ingresos del periodo'
     when 'home.expenses' then 'Gastos contables'
     when 'home.result' then 'Ingresos menos gastos'
     when 'home.internal' then 'Gastos internos'
     when 'home.gain' then 'Ganancia comercial'
     when 'home.activity' then 'Ventas y gastos del periodo'
     when 'home.alerts' then 'Pendientes y avisos'
     when 'home.shortcuts' then 'Acciones rápidas'
     when 'cash.store' then 'Estado de tienda y cierres'
     when 'cash.history' then 'Cierres recientes'
     when 'cash.withdrawals' then 'Retiradas y efectivo'
     when 'prestashop.summary' then 'Resumen PrestaShop'
     when 'prestashop.orders' then 'Pedidos PrestaShop'
     when 'prestashop.top' then 'Más vendidos'
     when 'prestashop.quality' then 'Calidad de catálogo'
     when 'expenses.quarter' then 'Gastos del trimestre'
     when 'expenses.pending' then 'Pendientes de revisión'
     when 'billing.pending' then 'Facturas y cobros'
     when 'pricing.quick' then 'Consulta rápida de precio'
     when 'documents.latest' then 'Documentos recientes'
     when 'fiscal.forecast' then 'Previsión fiscal'
     when 'reports.shortcut' then 'Informes y gestoría'
     when 'tasks.today' then 'Tareas de hoy'
     when 'system.status' then 'Estado del sistema'
     when 'receptions.pending' then 'Recepciones por cotejar'
     when 'products.pending' then 'Revisiones de productos'
     when 'chat.alerts' then 'Avisos del equipo'
     else 'Widget del Inicio' end),
    'scope',w.item->'scope','hidden',w.item->'hidden','layout',w.item->'layout',
    'filters',coalesce((
     select pg_catalog.jsonb_object_agg(f.key,f.value)
     from pg_catalog.jsonb_each(w.item->'filters') as f(key,value)
     where f.key in ('chartMode','chartMetric','tableDensity','productView',
                     'topLimit','showMetrics','showTop','columns')
    ),'{}'::jsonb)
   ) order by w.ord)
   from pg_catalog.jsonb_array_elements(saved->'widgets') with ordinality as w(item,ord)
  ),'[]'::jsonb)
 ) into clean;

 insert into private.totus_home_style_templates(owner_id,name,layout)
 values(uid,normalized_name,clean) returning id into saved_id;
 return pg_catalog.jsonb_build_object('id',saved_id,'name',normalized_name,'published',true);
exception when unique_violation then
 raise exception 'Ya tienes una plantilla publicada con ese nombre';
end
$func$;
revoke all on function private.totus_home_styles(text,uuid,text) from public,anon,authenticated;

-- Public authenticated entry mirrors the established Totus private-RPC bridge.
-- All authorization, identity, ownership and payload restrictions are server-side.
create or replace function public.totus_home_styles(
 p_action text,
 p_template_id uuid default null,
 p_name text default null
) returns jsonb
language sql security definer set search_path = '' as $func$
 select private.totus_home_styles(p_action,p_template_id,p_name)
$func$;
revoke all on function public.totus_home_styles(text,uuid,text) from public,anon;
grant execute on function public.totus_home_styles(text,uuid,text) to authenticated;
