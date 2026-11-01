-- Reserve an independent Auth identity without activating an external provider.
begin;
create or replace function public.totus_store_gemini_identity(p_user uuid,p_password text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if length(coalesce(p_password,''))<96 or length(p_password)>200 then raise exception 'Credencial técnica no válida';end if;
 if not exists(select 1 from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
 where u.id=p_user and u.email='gemini@totuscentral.invalid' and u.raw_app_meta_data->>'totus_gemini'='true' and t.role='admin' and not t.active)
 then raise exception 'Identidad pendiente de Gemini requerida';end if;
 perform pg_advisory_xact_lock(hashtextextended('totus_gemini_identity',0));
 if exists(select 1 from vault.secrets where name='totus_gemini_credentials') then raise exception 'La identidad ya tiene credencial; no se sobrescribirá';end if;
 perform vault.create_secret(jsonb_build_object('email','gemini@totuscentral.invalid','password',p_password)::text,'totus_gemini_credentials','Gemini own Auth identity; inactive until provider setup; never disclose');
end $$;
revoke all on function public.totus_store_gemini_identity(uuid,text) from public,anon,authenticated;
grant execute on function public.totus_store_gemini_identity(uuid,text) to service_role;
do $$declare definition text;begin
 select pg_get_functiondef('private.totus_codex_submit(text,jsonb)'::regprocedure) into definition;
 if position('''setup_gemini''' in definition)=0 then
  if position('''grant_chatgpt_admin'')' in definition)=0 then raise exception 'Definición de conector inesperada';end if;
  execute replace(definition,'''grant_chatgpt_admin'')','''grant_chatgpt_admin'',''setup_gemini'')');
 end if;
end $$;
commit;
