begin;
do $$declare definition text;begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 if position('La cuenta asignada no está preparada para trabajar automáticamente' in definition)=0 then
 definition=replace(definition,'  if p_action=''use_reader'' then',$guard$
  if c.protocol in ('cloudflare','openai_compatible','anthropic') and p_action in ('activate','use_ai') and not exists(select 1 from auth.users u join vault.secrets s on s.name=case when u.email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||u.id end where lower(u.email)=c.actor_email and (u.raw_app_meta_data->>'totus_ai'='true' or u.raw_app_meta_data->>'totus_integration'='true')) then raise exception 'La cuenta asignada no está preparada para trabajar automáticamente. Elige Totus IA o pulsa Crear usuario de conexión.';end if;
  if p_action='use_reader' then$guard$);
 definition=replace(definition,'jsonb_build_object(''email'',email,''name'',full_name,''role'',role)',$actors$jsonb_build_object('email',email,'name',full_name,'role',role,'technical_ready',exists(select 1 from auth.users u join vault.secrets s on s.name=case when u.email='totus-ai@totuscentral.invalid' then 'totus_ai_credentials' else 'totus_api_actor_'||u.id end where lower(u.email)=team_members.email and (u.raw_app_meta_data->>'totus_ai'='true' or u.raw_app_meta_data->>'totus_integration'='true')))$actors$);
 execute definition;
 end if;
end $$;
commit;
