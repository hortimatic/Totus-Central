-- Visual settings only; compatible with old backups (nullable, optional columns).
do $$begin perform set_config('totus.appearance_before_hash',private.totus_recovery_schema_hash(),false);end $$;
alter table public.ops_business_settings add column if not exists appearance_config jsonb default '{}'::jsonb;
alter table public.ops_business_settings add column if not exists login_appearance jsonb default '{}'::jsonb;
alter table public.ops_business_settings add column if not exists appearance_revision bigint default 0;
-- Never expose fiscal settings through the login-screen query.
alter table public.ops_business_settings enable row level security;
revoke all on public.ops_business_settings from anon;
grant select(login_appearance) on public.ops_business_settings to anon;
drop policy if exists ops_business_settings_public_login on public.ops_business_settings;
create policy ops_business_settings_public_login on public.ops_business_settings for select to anon using(id=1);

create or replace function private.totus_save_appearance(p_section text,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare schema jsonb='{"interfaz":{"brandName":{"type":"text","max":32},"brandSubtitle":{"type":"text","max":90},"logoMode":{"type":"select","options":["tf","hortimatic","newoldsmok"]},"theme":{"type":"select","options":["light","dark"]},"primary":{"type":"color"},"secondary":{"type":"color"},"accent":{"type":"color"},"bg":{"type":"color"},"surface":{"type":"color"},"card":{"type":"color"},"text":{"type":"color"},"muted":{"type":"color"},"density":{"type":"select","options":["compact","comfortable","wide"]},"shadow":{"type":"select","options":["none","soft","strong"]},"sidebarWidth":{"type":"range","min":240,"max":330},"topbarHeight":{"type":"range","min":56,"max":88},"fontSize":{"type":"range","min":13,"max":16},"pagePad":{"type":"range","min":12,"max":36},"gap":{"type":"range","min":8,"max":28},"radius":{"type":"range","min":8,"max":28},"buttonRadius":{"type":"range","min":6,"max":24},"cardPadding":{"type":"range","min":12,"max":24},"tableRowHeight":{"type":"range","min":34,"max":52},"borderStrength":{"type":"range","min":6,"max":24},"buttonStyle":{"type":"select","options":["rounded","soft"]}},"login":{"loginBrandName":{"type":"text","max":36},"loginSubtitle":{"type":"text","max":86},"loginFont":{"type":"select","options":["system","rounded","serif","mono"]},"loginLogoMode":{"type":"select","options":["mark","text","uploaded"]},"loginLogoFrame":{"type":"select","options":["none","soft"]},"loginLogoWidth":{"type":"range","min":48,"max":100},"loginLogoHeight":{"type":"range","min":42,"max":110},"loginAlign":{"type":"select","options":["left","center"]},"customLogoData":{"type":"image","max":350000},"loginCardPreset":{"type":"select","options":["solid","transparent","glass","dark","light"]},"loginCardColor":{"type":"color"},"loginCardOpacity":{"type":"range","min":45,"max":100},"loginCardRadius":{"type":"range","min":10,"max":34},"loginCardShadow":{"type":"select","options":["none","soft","strong"]},"loginButtonMode":{"type":"select","options":["gradient","solid","outline"]},"loginButtonColor":{"type":"color"},"loginTextColor":{"type":"color"},"loginBorderColor":{"type":"color"},"loginCardWidth":{"type":"range","min":360,"max":520},"loginCardPadding":{"type":"range","min":18,"max":36},"loginBackground":{"type":"select","options":["dark-gradient","light-clean","totus-corporate","tech-soft","gold-night","uploaded"]},"customBackgroundData":{"type":"image","max":350000},"loginHelpText":{"type":"text","max":180},"loginRecoveryText":{"type":"text","max":80}}}'::jsonb; pair record; rule jsonb; actual bigint; result jsonb;
begin
 if auth.uid() is null or not coalesce(private.is_admin(),false) then raise exception 'Solo administración puede guardar la apariencia.';end if;
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
 if private.totus_recovery_schema_hash() is distinct from current_setting('totus.appearance_before_hash',true) then raise exception 'La apariencia ha cambiado la compatibilidad de las copias.';end if;
end $compat$;
