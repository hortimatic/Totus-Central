begin;
-- PrestaShop is a service credential, not an autonomous chat participant.
alter table private.totus_api_connections alter column actor_email drop not null;
alter table private.totus_api_connections add constraint totus_api_actor_required_except_prestashop
 check (protocol='prestashop' or actor_email is not null);
do $$declare definition text;needle text;begin
 select pg_get_functiondef('private.totus_api_manager(text,jsonb,text)'::regprocedure) into definition;
 needle='c.actor_email=lower(btrim(p_data->>''actor_email''));';
 if position(needle in definition)=0 then raise exception 'Unexpected manager actor assignment';end if;
 definition=replace(definition,needle,'c.actor_email=case when c.protocol=''prestashop'' then null else lower(btrim(p_data->>''actor_email'')) end;');
 needle='if not exists(select 1 from public.team_members where email=c.actor_email and active) then';
 if (length(definition)-length(replace(definition,needle,'')))/length(needle)<>2 then raise exception 'Unexpected manager actor checks';end if;
 definition=replace(definition,needle,'if c.protocol<>''prestashop'' and not exists(select 1 from public.team_members where email=c.actor_email and active) then');
 execute definition;
 select pg_get_functiondef('public.totus_api_server(uuid,bigint)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'Unexpected server actor check';end if;
 execute replace(definition,needle,'if c.protocol<>''prestashop'' and not exists(select 1 from public.team_members where email=c.actor_email and active) then');
end$$;
-- No credential, endpoint, quota, verification revision or caller permission changes.
update private.totus_api_connections set actor_email=null where protocol='prestashop';
commit;
