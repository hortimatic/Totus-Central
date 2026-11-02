begin;
alter table private.totus_api_connections add column if not exists max_output_tokens integer;
update private.totus_api_connections set max_output_tokens=case when protocol='openai_compatible' and endpoint like 'https://api.groq.com/%' then 1024 else 8192 end where max_output_tokens is null;
alter table private.totus_api_connections alter column max_output_tokens set default 2048;
alter table private.totus_api_connections alter column max_output_tokens set not null;
alter table private.totus_api_connections drop constraint if exists totus_api_connections_output_tokens_check;
alter table private.totus_api_connections add constraint totus_api_connections_output_tokens_check check(max_output_tokens between 64 and 32768);
-- This is a user budget, not a provider entitlement. Keep a positive integer,
-- without imposing the old arbitrary 200-call ceiling in either configuration.
alter table private.totus_api_connections drop constraint if exists totus_api_connections_daily_limit_check;
alter table private.totus_api_connections add constraint totus_api_connections_daily_limit_check check(daily_limit>=1);
alter table private.totus_ai_config drop constraint if exists totus_ai_config_daily_limit_check;
alter table private.totus_ai_config add constraint totus_ai_config_daily_limit_check check(daily_limit>=1);
do $patch$
declare definition text;
begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 if position('c.daily_limit not between 1 and 200' in definition)=0 and position('c.daily_limit < 1' in definition)=0 then raise exception 'No se reconoce la validación del límite de APIs; revisión necesaria.';end if;
 definition=replace(definition,'c.daily_limit not between 1 and 200','c.daily_limit < 1');
 if position('c.max_output_tokens=' in definition)=0 then
  if position('c.daily_limit=(p_data->>''daily_limit'')::integer;' in definition)=0 then raise exception 'No se reconoce el contrato de configuración de APIs.';end if;
  definition=replace(definition,'''daily_limit'',''free_confirmed''','''daily_limit'',''max_output_tokens'',''free_confirmed''');
  definition=replace(definition,'c.daily_limit=(p_data->>''daily_limit'')::integer;','c.daily_limit=(p_data->>''daily_limit'')::integer;c.max_output_tokens=coalesce((p_data->>''max_output_tokens'')::integer,c.max_output_tokens,2048);if c.max_output_tokens not between 64 and 32768 then raise exception ''El máximo de tokens debe estar entre 64 y 32768.'';end if;');
  definition=replace(definition,'daily_limit=excluded.daily_limit,','daily_limit=excluded.daily_limit,max_output_tokens=excluded.max_output_tokens,');
  definition=replace(definition,'actor_email,daily_limit,free_confirmed,real_data_authorized)','actor_email,daily_limit,max_output_tokens,free_confirmed,real_data_authorized)');
  definition=replace(definition,'c.actor_email,c.daily_limit,false,false','c.actor_email,c.daily_limit,c.max_output_tokens,false,false');
 end if;
 execute definition;
 select pg_get_functiondef('public.totus_ai_settings(jsonb,text,boolean)'::regprocedure) into definition;
 if position('c.daily_limit not between 1 and 200' in definition)=0 and position('c.daily_limit < 1' in definition)=0 then raise exception 'No se reconoce la validación del límite de la IA; revisión necesaria.';end if;
 definition=replace(definition,'c.daily_limit not between 1 and 200','c.daily_limit is null or c.daily_limit < 1');
 definition=replace(definition,'Límite diario entre 1 y 200.','El límite diario debe ser un entero positivo.');
 execute definition;
end $patch$;
commit;
