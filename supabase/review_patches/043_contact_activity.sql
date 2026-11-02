-- Extend operational route names only; preserve identity, retries and permission checks.
begin;
do $patch$
declare definition text;updated text;
begin
 select pg_get_functiondef('public.totus_record_activity(text,text,text,text,uuid)'::regprocedure) into definition;
 if position('''clientes''' in definition)>0 then return;end if;
 updated=replace(definition,'''tareas'',''recepciones'') OR','''tareas'',''recepciones'',''clientes'',''proveedores'',''marcas'') OR');
 updated=replace(updated,'CASE WHEN p_area=''recepciones'' THEN ''documentos'' ELSE p_area END','CASE p_area WHEN ''recepciones'' THEN ''documentos'' WHEN ''clientes'' THEN ''facturacion'' WHEN ''proveedores'' THEN ''gastos'' WHEN ''marcas'' THEN ''pricing'' ELSE p_area END');
 if position('''clientes''' in updated)=0 or position('WHEN ''marcas'' THEN ''pricing''' in updated)=0 then raise exception 'Unexpected activity definition; no change applied';end if;
 execute updated;
end;$patch$;
commit;
