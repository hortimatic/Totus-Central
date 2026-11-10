-- Totus Central — Inicio modular: a strictly user-scoped presentation preference.
-- No accounting tables, fiscal data, store credentials or recovery data changed.
-- Review this migration independently before applying in production.
create or replace function private.totus_home_dashboard(
 p_action text, p_layout jsonb default null, p_expected_revision integer default null)
returns jsonb
language plpgsql security definer set search_path = '' as $function$
declare
 uid uuid := auth.uid(); current_data jsonb; current_rev integer; new_rev integer;
 found_count integer; distinct_count integer;
begin
 if uid is null or not exists(
  select 1 from public.profiles p
  join public.team_members t on lower(t.email)=lower(p.email)
  where p.id=uid and p.active=true and t.active=true and lower(p.email)=lower(auth.jwt()->>'email')
 ) then raise exception 'Acceso denegado' using errcode='42501';end if;
 if p_action is null or p_action not in ('read','save') then raise exception 'Operación de Inicio no admitida'; end if;
 -- Lock only the caller's own profile for atomic compare-and-swap.
 select coalesce(ui_preferences->'home_dashboard','{}'::jsonb)
 into current_data from public.profiles where id=uid for update;
 if not found then raise exception 'Perfil no encontrado' using errcode='42501';end if;
 current_rev:=coalesce((current_data->>'revision')::integer,0);
 if p_action='read' then
  return jsonb_build_object('revision',current_rev,'layout',current_data->'layout');
 end if;
 if p_expected_revision is null or p_expected_revision<>current_rev then
  raise exception 'El diseño de Inicio ha cambiado en otra sesión. Recarga y vuelve a revisar.' using errcode='40001';
 end if;
 if p_layout is null or jsonb_typeof(p_layout)<>'object' or coalesce(jsonb_typeof(p_layout->'schemaVersion')<>'number',true) or coalesce((p_layout->>'schemaVersion')<>'1',true)
  or coalesce(jsonb_typeof(p_layout->'widgets')<>'array',true) or pg_catalog.octet_length(p_layout::text)>120000
 then raise exception 'Diseño de Inicio incompatible o excesivo';end if;

 -- Persist only presentation schema keys. A caller may bypass the browser
 -- sanitizer, so unknown fields must never be stored in personal preferences.
 if (p_layout - ARRAY['schemaVersion','settings','widgets']::text[]) <> '{}'::jsonb
 then raise exception 'Campos de diseño no admitidos';end if;

 -- The optional visual configuration is presentation only and never contains CSS,
 -- arbitrary colors, SQL or provider credentials; only this allowlist is accepted.
 if p_layout ? 'settings' and (
  jsonb_typeof(p_layout->'settings')<>'object'
  or ((p_layout->'settings') - ARRAY['gap','width','density','background']::text[]) <> '{}'::jsonb
  or coalesce((p_layout->'settings'->>'gap') not in ('inherit','8','12','16','20','24'),true)
  or coalesce((p_layout->'settings'->>'width') not in ('fluid','1440','1600','1920'),true)
  or coalesce((p_layout->'settings'->>'density') not in ('inherit','compact','comfortable'),true)
  or coalesce((p_layout->'settings'->>'background') not in ('inherit','soft'),true)
 ) then raise exception 'Configuración general de Inicio no admitida';end if;
 found_count:=jsonb_array_length(p_layout->'widgets');
 if found_count>120 then raise exception 'Demasiados widgets';end if;
 if exists(
  select 1 from jsonb_array_elements(p_layout->'widgets') item
  where jsonb_typeof(item)<>'object'
   or coalesce((item - ARRAY['id','type','title','scope','filters','hidden','layout']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'scope' - ARRAY['store']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'filters' - ARRAY['from','to','status','query','payment','origin','sort','period','inheritPeriod','page','pageSize','columns','chartMode','chartMetric','tableDensity','productView','topLimit','showMetrics','showTop']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'layout' - ARRAY['desktop','tablet','mobile']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'layout'->'desktop' - ARRAY['x','y','w','h']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'layout'->'tablet' - ARRAY['order','w','h']::text[]) <> '{}'::jsonb,true)
   or coalesce((item->'layout'->'mobile' - ARRAY['order','h']::text[]) <> '{}'::jsonb,true)
   or coalesce(jsonb_typeof(item->'title')<>'string',true)
   or coalesce(pg_catalog.char_length(item->>'title')>120,true)
   or item->>'id' is null or (item->>'id') !~ '^[a-zA-Z0-9_-]{1,80}$'
   or coalesce(item->>'type' not in (
    'cash.openings','home.income','home.expenses','home.result','home.internal','home.gain','home.activity',
    'home.alerts','home.shortcuts','cash.store','cash.history','cash.withdrawals',
    'prestashop.summary','prestashop.orders','prestashop.top','prestashop.quality',
    'expenses.quarter','expenses.pending','billing.pending','pricing.quick','documents.latest',
    'fiscal.forecast','reports.shortcut','tasks.today','system.status','receptions.pending',
    'products.pending','chat.alerts'
   ),true)
   or coalesce(jsonb_typeof(item->'scope')<>'object',true)
   or coalesce(item->'scope'->>'store' not in ('all','hortimatic','newoldsmok'),true)
   or coalesce(jsonb_typeof(item->'hidden')<>'boolean',true)
   or coalesce(jsonb_typeof(item->'filters')<>'object',true)
   or coalesce(jsonb_typeof(item->'layout')<>'object',true)
   or coalesce(jsonb_typeof(item->'layout'->'desktop')<>'object',true)
   or coalesce(jsonb_typeof(item->'layout'->'tablet')<>'object',true)
   or coalesce(jsonb_typeof(item->'layout'->'mobile')<>'object',true)
   or exists(
    select 1 from jsonb_each(
     case when jsonb_typeof(item->'filters')='object' then item->'filters' else '{}'::jsonb end
    ) as f(key,value)
    where jsonb_typeof(f.value) not in ('string','number','boolean','array')
     or (jsonb_typeof(f.value)='string' and pg_catalog.char_length(f.value#>>'{}')>120)
     or (jsonb_typeof(f.value)='array' and f.key<>'columns')
     or (f.key='columns' and (jsonb_typeof(f.value)<>'array' or
        (case when jsonb_typeof(f.value)='array' then jsonb_array_length(f.value)>10 else true end)))
   )
   or coalesce(jsonb_typeof(item->'layout'->'desktop'->'x')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'desktop'->'y')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'desktop'->'w')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'desktop'->'h')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'tablet'->'order')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'tablet'->'w')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'tablet'->'h')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'mobile'->'order')<>'number',true)
   or coalesce(jsonb_typeof(item->'layout'->'mobile'->'h')<>'number',true)
   or exists(
    select 1 from jsonb_array_elements(
     case when jsonb_typeof(item->'filters'->'columns')='array' then item->'filters'->'columns' else '[]'::jsonb end
    ) as col(value)
    where jsonb_typeof(col.value)<>'string'
      or (col.value#>>'{}') not in ('order','reference','products','customer','total','payment','status','date','employee','margin')
   )
   or coalesce((item->'layout'->'desktop'->>'x') ~ '^(0|[1-9]|1[01])$',false)=false
   or coalesce((item->'layout'->'desktop'->>'y') ~ '^(0|[1-9][0-9]{0,3})$',false)=false
   or coalesce((item->'layout'->'desktop'->>'w') ~ '^([1-9]|1[0-2])$',false)=false
   or coalesce((item->'layout'->'desktop'->>'h') ~ '^([2-9]|1[0-2])$',false)=false
   or coalesce((item->'layout'->'tablet'->>'order') ~ '^(0|[1-9][0-9]{0,3})$',false)=false
   or coalesce((item->'layout'->'tablet'->>'w') ~ '^[1-6]$',false)=false
   or coalesce((item->'layout'->'tablet'->>'h') ~ '^([2-9]|1[0-6])$',false)=false
   or coalesce((item->'layout'->'mobile'->>'order') ~ '^(0|[1-9][0-9]{0,3})$',false)=false
   or coalesce((item->'layout'->'mobile'->>'h') ~ '^([2-9]|1[0-8])$',false)=false
 ) then raise exception 'Datos de widget no admitidos';end if;
 select count(distinct item->>'id') into distinct_count from jsonb_array_elements(p_layout->'widgets') item;
 if distinct_count<>found_count then raise exception 'Widget duplicado';end if;
 new_rev:=current_rev+1;
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{home_dashboard}',jsonb_build_object('revision',new_rev,'layout',p_layout),true)
 where id=uid;
 return jsonb_build_object('revision',new_rev,'layout',p_layout);
end
$function$;
revoke all on function private.totus_home_dashboard(text,jsonb,integer) from public, anon;
revoke all on function private.totus_home_dashboard(text,jsonb,integer) from authenticated;
-- The public wrapper is the sole authenticated entry point. Never grant USAGE
-- on the private schema just to make this personal preference work.
create or replace function public.totus_home_dashboard(
 p_action text, p_layout jsonb default null, p_expected_revision integer default null)
returns jsonb
language sql security definer set search_path='' as $function$
 select private.totus_home_dashboard(p_action,p_layout,p_expected_revision)
$function$;
revoke all on function public.totus_home_dashboard(text,jsonb,integer) from public, anon;
grant execute on function public.totus_home_dashboard(text,jsonb,integer) to authenticated;
,false)=false
   or coalesce((item->'layout'->'desktop'->>'h') ~ '^([1-9]|1[0-2])$',false)=false
 ) then raise exception 'Datos de widget no admitidos';end if;
 select count(distinct item->>'id') into distinct_count from jsonb_array_elements(p_layout->'widgets') item;
 if distinct_count<>found_count then raise exception 'Widget duplicado';end if;
 new_rev:=current_rev+1;
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{home_dashboard}',jsonb_build_object('revision',new_rev,'layout',p_layout),true)
 where id=uid;
 return jsonb_build_object('revision',new_rev,'layout',p_layout);
end
$function$;
revoke all on function private.totus_home_dashboard(text,jsonb,integer) from public, anon;
revoke all on function private.totus_home_dashboard(text,jsonb,integer) from authenticated;
-- The public wrapper is the sole authenticated entry point. Never grant USAGE
-- on the private schema just to make this personal preference work.
create or replace function public.totus_home_dashboard(
 p_action text, p_layout jsonb default null, p_expected_revision integer default null)
returns jsonb
language sql security definer set search_path='' as $function$
 select private.totus_home_dashboard(p_action,p_layout,p_expected_revision)
$function$;
revoke all on function public.totus_home_dashboard(text,jsonb,integer) from public, anon;
grant execute on function public.totus_home_dashboard(text,jsonb,integer) to authenticated;
