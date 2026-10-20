alter table public.ops_onedrive_config add column retirement_lock_until timestamptz;
do $ddl$
declare definition text; needle text:=E'begin\n select * into job'; replacement text:=E'begin\n perform 1 from public.ops_onedrive_config where id=1 for update;\n if exists(select 1 from public.ops_onedrive_config where id=1 and retirement_lock_until>now()) then\n  raise exception ''Espera a que termine la limpieza de duplicados antes de recuperar una copia'';\n end if;\n select * into job';
begin
 select pg_get_functiondef('public.totus_commit_recovery(uuid,jsonb,jsonb)'::regprocedure) into definition;
 if position(needle in definition)=0 then raise exception 'La función de recuperación cambió; revisar antes de aplicar'; end if;
 execute replace(definition,needle,replacement);
end $ddl$;