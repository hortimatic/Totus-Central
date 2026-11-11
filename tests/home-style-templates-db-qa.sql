-- QA: executable after fixture, personal-dashboard migration and styles migration.
select public.qa_assert(
 not has_function_privilege('anon','public.totus_home_styles(text,uuid,text)','execute'),
 'Anónimo no puede ejecutar plantillas'
);
select public.qa_assert(
 has_function_privilege('authenticated','public.totus_home_styles(text,uuid,text)','execute'),
 'Autenticado puede llamar al RPC validado'
);
select public.qa_assert(
 not has_table_privilege('authenticated','private.totus_home_style_templates','select'),
 'La biblioteca privada no admite acceso directo'
);

create or replace function public.qa_style_rejected(p_action text,p_id uuid,p_name text)
returns boolean language plpgsql as $$
begin
 perform public.totus_home_styles(p_action,p_id,p_name);
 return false;
exception when others then return true;
end$$;

set role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"qa-one@example.invalid"}',false);
do $test$
declare
 layout jsonb;
 result jsonb;
 template_id uuid;
 returned jsonb;
begin
 layout='{"schemaVersion":1,"settings":{"gap":"12","density":"compact","width":"fluid","background":"inherit"},"widgets":[{"id":"income","type":"home.income","title":"Cliente PRIVADO ABC / datos sensibles","scope":{"store":"all"},"hidden":false,"filters":{"from":"2026-10-01","to":"2026-10-31","query":"CLIENTE PRIVADO","chartMetric":"orders"},"layout":{"desktop":{"x":0,"y":0,"w":3,"h":2},"tablet":{"order":0,"w":3,"h":2},"mobile":{"order":0,"h":3}}}]}';
 perform public.totus_home_dashboard('save',layout,0);
 result:=public.totus_home_styles('publish',null,'Mi tablero de trabajo');
 template_id=(result->>'id')::uuid;
 perform public.qa_assert((result->>'published')='true','Publicación verificada');
 returned:=public.totus_home_styles('read',template_id,null);
 perform public.qa_assert(returned->'layout'->'settings'->>'density'='compact','Estilo visual compartido');
 perform public.qa_assert(returned->'layout'->'widgets'->0->'filters'->>'chartMetric'='orders','Preferencia gráfica permitida');
 perform public.qa_assert(returned->'layout'->'widgets'->0->'filters'->>'query' is null,'Búsqueda privada NO compartida');
 perform public.qa_assert(returned->'layout'->'widgets'->0->>'title'='Ingresos del periodo','Título personalizado sensible NO compartido');
 perform public.qa_assert(returned->'layout'->'widgets'->0->'filters'->>'from' is null,'Fecha personal NO compartida');
 perform public.qa_assert(public.qa_style_rejected('publish',null,'Mi tablero de trabajo'),'Nombre repetido bloqueado');
 perform public.qa_assert(public.qa_style_rejected('publish',null,'a'),'Nombre demasiado corto bloqueado');
 perform public.qa_assert(public.qa_style_rejected('publish',null,'Nombre'||chr(10)||'malicioso'),'Control de texto bloqueado');
 perform public.qa_assert(public.qa_style_rejected('remove',gen_random_uuid(),null),'No eliminar plantilla inexistente');
 perform public.qa_assert(public.qa_style_rejected('update',template_id,'Otra'),'No admitir acciones arbitrarias');
end$test$;

select public.qa_assert(jsonb_array_length(public.totus_home_styles('list',null,null)->'items')=1,'Biblioteca incluye diseño publicado');
select set_config('totus.qa_no_edit','yes',false);
select public.qa_assert(public.qa_style_rejected('publish',null,'Publicación bloqueada'),'Permiso de edición necesario');
select set_config('totus.qa_no_edit','no',false);

select set_config('request.jwt.claims','{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","email":"qa-two@example.invalid"}',false);
do $test$
declare
 id uuid;
 saved jsonb;
begin
 id:=(public.totus_home_styles('list',null,null)->'items'->0->>'id')::uuid;
 saved:=public.totus_home_styles('read',id,null);
 perform public.qa_assert(saved->>'name'='Mi tablero de trabajo','Otro usuario puede leer plantilla compartida');
 perform public.qa_assert((saved->>'mine')='false','La plantilla compartida mantiene autor');
 perform public.qa_assert(public.qa_style_rejected('remove',id,null),'Un usuario no puede retirar la plantilla ajena');
 perform public.qa_assert((public.totus_home_dashboard('read',null,null)->'layout') is null,'Leer plantilla no cambia el diseño ajeno');
end$test$;

select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","email":"qa-off@example.invalid"}',false);
select public.qa_assert(public.qa_style_rejected('list',null,null),'Perfil inactivo no lee plantillas');
select public.qa_assert(public.qa_style_rejected('publish',null,'Denegado'),'Perfil inactivo no publica plantillas');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"falso@example.invalid"}',false);
select public.qa_assert(public.qa_style_rejected('list',null,null),'JWT correo distinto no accede');

select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","email":"qa-one@example.invalid"}',false);
do $test$
declare id uuid;
begin
 id:=(public.totus_home_styles('list',null,null)->'items'->0->>'id')::uuid;
 perform public.totus_home_styles('remove',id,null);
 perform public.qa_assert(jsonb_array_length(public.totus_home_styles('list',null,null)->'items')=0,'El dueño retira la plantilla');
 perform public.qa_assert(public.qa_style_rejected('read',id,null),'Plantilla retirada no se expone');
 perform public.qa_assert((public.totus_home_dashboard('read',null,null)->'revision')::int=1,'Retirar plantilla no modifica Inicio propio');
end$test$;
reset role;
