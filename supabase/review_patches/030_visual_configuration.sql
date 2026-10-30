-- Visual settings only; compatible with old backups (nullable, optional columns).
do $$begin perform set_config('totus.appearance_before_hash',private.totus_recovery_schema_hash(),false);end $$;
alter table public.ops_business_settings add column if not exists appearance_config jsonb default '{}'::jsonb;
alter table public.ops_business_settings add column if not exists login_appearance jsonb default '{}'::jsonb;
alter table public.ops_business_settings add column if not exists appearance_revision bigint default 0;
CREATE OR REPLACE FUNCTION private.totus_module_can(p_email text, p_module text, p_action text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT coalesce((
  SELECT CASE WHEN tm.role='admin' THEN true
  WHEN tm.role NOT IN ('gerente','encargado') AND p_module='administracion' THEN false
  ELSE
   coalesce(
    CASE p_action WHEN 'view' THEN usr.can_view WHEN 'create' THEN usr.can_create WHEN 'edit' THEN usr.can_edit WHEN 'delete' THEN usr.can_delete WHEN 'export' THEN usr.can_export ELSE false END,
    CASE p_action WHEN 'view' THEN rp.can_view WHEN 'create' THEN rp.can_create WHEN 'edit' THEN rp.can_edit WHEN 'delete' THEN rp.can_delete WHEN 'export' THEN rp.can_export ELSE false END,
    CASE WHEN p_module='configuracion' THEN (tm.role='gerente' AND p_action='view') WHEN p_module IN ('equipo','tareas') THEN true WHEN tm.role='gerente' THEN ((p_module<>'administracion' OR p_action='view') AND NOT (p_module='fiscalidad' AND p_action='delete'))
      WHEN tm.role='encargado' THEN (p_module<>'administracion' AND (p_action='view' OR (p_module='documentos' AND p_action IN ('create','edit'))))
      ELSE false END
   ) AND coalesce(usr.can_view,rp.can_view,
       CASE WHEN p_module='configuracion' THEN tm.role='gerente' WHEN p_module IN ('equipo','tareas') THEN true WHEN tm.role='gerente' THEN true WHEN tm.role='encargado' THEN p_module<>'administracion' ELSE false END)
  END
  FROM public.team_members tm
  JOIN public.ops_roles r ON r.code=tm.role
  LEFT JOIN public.ops_user_permissions usr ON lower(usr.email)=lower(tm.email) AND usr.module=p_module
  LEFT JOIN public.ops_role_permissions rp ON rp.role=tm.role AND rp.module=p_module
  WHERE lower(tm.email)=lower(coalesce(p_email,'')) AND tm.active=true
  LIMIT 1
 ),false)

 AND p_module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion')
 AND p_action IN ('view','create','edit','delete','export');
$function$;


REVOKE ALL ON FUNCTION private.totus_module_can(text,text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION private.totus_can(p_module text,p_action text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND private.totus_module_can((SELECT email FROM auth.users WHERE id=auth.uid()),p_module,p_action)
$$;

REVOKE ALL ON FUNCTION private.totus_can(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_can(text,text) TO authenticated;

ALTER TABLE public.ops_role_permissions DROP CONSTRAINT ops_role_permissions_module_check;
ALTER TABLE public.ops_role_permissions ADD CONSTRAINT ops_role_permissions_module_check CHECK(module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion'));

ALTER TABLE public.ops_user_permissions DROP CONSTRAINT ops_user_permissions_module_check;
ALTER TABLE public.ops_user_permissions ADD CONSTRAINT ops_user_permissions_module_check CHECK(module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion','equipo','tareas','configuracion'));


-- Never expose fiscal settings through the login-screen query.
alter table public.ops_business_settings enable row level security;
revoke all on public.ops_business_settings from anon;
grant select(login_appearance) on public.ops_business_settings to anon;
drop policy if exists ops_business_settings_public_login on public.ops_business_settings;
create policy ops_business_settings_public_login on public.ops_business_settings for select to anon using(id=1);

create or replace function private.totus_save_appearance(p_section text,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare schema jsonb='{"interfaz":{"brandName":{"type":"text","max":32},"brandSubtitle":{"type":"text","max":90},"logoMode":{"type":"select","options":["tf","hortimatic","newoldsmok","uploaded"]},"customLogoData":{"type":"image","max":350000},"logoHeight":{"type":"range","min":28,"max":64},"backgroundMode":{"type":"select","options":["color","image"]},"customBackgroundData":{"type":"image","max":350000},"backgroundDim":{"type":"range","min":0,"max":90},"theme":{"type":"select","options":["light","dark"]},"primary":{"type":"color"},"secondary":{"type":"color"},"accent":{"type":"color"},"bg":{"type":"color"},"surface":{"type":"color"},"card":{"type":"color"},"text":{"type":"color"},"muted":{"type":"color"},"density":{"type":"select","options":["compact","comfortable","wide"]},"shadow":{"type":"select","options":["none","soft","strong"]},"sidebarWidth":{"type":"range","min":240,"max":330},"topbarHeight":{"type":"range","min":56,"max":88},"fontSize":{"type":"range","min":13,"max":16},"pagePad":{"type":"range","min":12,"max":36},"gap":{"type":"range","min":8,"max":28},"radius":{"type":"range","min":8,"max":28},"buttonRadius":{"type":"range","min":6,"max":24},"cardPadding":{"type":"range","min":12,"max":24},"tableRowHeight":{"type":"range","min":34,"max":52},"borderStrength":{"type":"range","min":6,"max":24},"borderColor":{"type":"color"},"borderWidth":{"type":"range","min":0,"max":3},"glowColor":{"type":"color"},"cardGlow":{"type":"range","min":0,"max":24},"buttonGlow":{"type":"range","min":0,"max":24},"hoverEffect":{"type":"select","options":["none","lift","glow"]},"buttonFinish":{"type":"select","options":["flat","gradient","gloss"]},"buttonStyle":{"type":"select","options":["rounded","soft"]}},"login":{"loginBrandName":{"type":"text","max":36},"loginSubtitle":{"type":"text","max":86},"loginFont":{"type":"select","options":["system","rounded","serif","mono"]},"loginLogoMode":{"type":"select","options":["mark","text","uploaded"]},"loginLogoFrame":{"type":"select","options":["none","soft"]},"loginLogoWidth":{"type":"range","min":48,"max":100},"loginLogoHeight":{"type":"range","min":42,"max":110},"loginAlign":{"type":"select","options":["left","center"]},"customLogoData":{"type":"image","max":350000},"loginCardPreset":{"type":"select","options":["solid","transparent","glass","dark","light"]},"loginCardColor":{"type":"color"},"loginCardOpacity":{"type":"range","min":45,"max":100},"loginCardRadius":{"type":"range","min":10,"max":34},"loginCardShadow":{"type":"select","options":["none","soft","strong"]},"loginButtonMode":{"type":"select","options":["gradient","solid","outline"]},"loginButtonColor":{"type":"color"},"loginTextColor":{"type":"color"},"loginBorderColor":{"type":"color"},"loginCardWidth":{"type":"range","min":360,"max":520},"loginCardPadding":{"type":"range","min":18,"max":36},"loginBackground":{"type":"select","options":["dark-gradient","light-clean","totus-corporate","tech-soft","gold-night","uploaded"]},"loginBorderWidth":{"type":"range","min":0,"max":3},"loginGlowColor":{"type":"color"},"loginCardGlow":{"type":"range","min":0,"max":24},"loginButtonGlow":{"type":"range","min":0,"max":24},"loginBackgroundDim":{"type":"range","min":0,"max":80},"customBackgroundData":{"type":"image","max":350000},"loginHelpText":{"type":"text","max":180},"loginRecoveryText":{"type":"text","max":80}}}'::jsonb; pair record; rule jsonb; actual bigint; result jsonb;
begin
 if auth.uid() is null or not coalesce(private.totus_can('configuracion','edit'),false) then raise exception 'No tienes permiso para editar Configuración.';end if;
 if p_section is null or not schema?p_section then raise exception 'Sección no válida.';end if;
 if p_config is null or jsonb_typeof(p_config)<>'object' or octet_length(p_config::text)>760000 then raise exception 'Configuración no válida.';end if;
 for pair in select * from jsonb_each(p_config) loop
  rule=schema->p_section->pair.key;
  if rule is null then raise exception 'Campo de apariencia no válido: %',pair.key;end if;
  if rule->>'type'='range' then
   if jsonb_typeof(pair.value)<>'number' then raise exception 'Valor numérico no válido.';end if;
   if (pair.value#>>'{}')::numeric not between (rule->>'min')::numeric and (rule->>'max')::numeric then raise exception 'Valor fuera de rango.';end if;
  else
   if jsonb_typeof(pair.value)<>'string' then raise exception 'Texto no válido.';end if;
   if rule->>'type'='color' and (pair.value#>>'{}') !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color no válido.';end if;
   if rule->>'type'='select' and not (rule->'options')?(pair.value#>>'{}') then raise exception 'Opción no válida.';end if;
   if rule->>'type'='text' and length(pair.value#>>'{}')>(rule->>'max')::integer then raise exception 'Texto demasiado largo.';end if;
   if rule->>'type'='image' and (length(pair.value#>>'{}')>350000 or ((pair.value#>>'{}')<>'' and (pair.value#>>'{}') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$')) then raise exception 'Imagen no válida.';end if;
  end if;
 end loop;
 if p_section='interfaz' and ((p_config->>'logoMode'='uploaded' and coalesce(p_config->>'customLogoData','')='') or (p_config->>'backgroundMode'='image' and coalesce(p_config->>'customBackgroundData','')='')) then raise exception 'Selecciona la imagen de marca.';end if;
 if p_section='login' and ((p_config->>'loginLogoMode'='uploaded' and coalesce(p_config->>'customLogoData','')='') or (p_config->>'loginBackground'='uploaded' and coalesce(p_config->>'customBackgroundData','')='')) then raise exception 'Selecciona la imagen de marca.';end if;
 perform private.totus_chat_write_lock();
 select coalesce(appearance_revision,0) into strict actual from public.ops_business_settings where id=1 for update;
 if p_expected_revision is distinct from actual then raise exception 'La configuración cambió. Actualiza la página antes de guardar.';end if;
 update public.ops_business_settings set appearance_config=case when p_section='interfaz' then p_config else appearance_config end,login_appearance=case when p_section='login' then p_config else login_appearance end,appearance_revision=actual+1 where id=1;
 select jsonb_build_object('appearance_config',appearance_config,'login_appearance',login_appearance,'appearance_revision',appearance_revision) into result from public.ops_business_settings where id=1;
 return result;
end $$;
create or replace function public.totus_save_appearance(p_section text,p_config jsonb,p_expected_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_save_appearance(p_section,p_config,p_expected_revision)$$;
revoke all on function private.totus_save_appearance(text,jsonb,bigint),public.totus_save_appearance(text,jsonb,bigint) from public,anon;
grant execute on function private.totus_save_appearance(text,jsonb,bigint),public.totus_save_appearance(text,jsonb,bigint) to authenticated;
-- Optional branding must not invalidate existing accounting recovery sets.
-- Preserve all existing exclusions and constraint normalizations in the installed hash.
do $compat$
declare definition text;
begin
 select pg_get_functiondef('private.totus_recovery_schema_hash()'::regprocedure) into definition;
 if position('appearance_revision' in definition)=0 then
  if position('and a.attnum>0 and not a.attisdropped' in definition)=0 then raise exception 'No se reconoce el cálculo de compatibilidad de las copias.';end if;
  definition=replace(definition,'and a.attnum>0 and not a.attisdropped',
   'and a.attnum>0 and not a.attisdropped and not (c.relname=''ops_business_settings'' and a.attname in (''appearance_config'',''login_appearance'',''appearance_revision''))');
  execute definition;
 end if;
 if position('configuracion' in definition)=0 then
  select pg_get_functiondef('private.totus_recovery_schema_hash()'::regprocedure) into definition;
  definition=replace(definition,'pg_catalog.pg_get_constraintdef(k.oid)',$normalize$replace(pg_catalog.pg_get_constraintdef(k.oid), ', ''configuracion''::text', '')$normalize$);
  execute definition;
 end if;
 if private.totus_recovery_schema_hash() is distinct from current_setting('totus.appearance_before_hash',true) then raise exception 'La apariencia ha cambiado la compatibilidad de las copias.';end if;
end $compat$;
