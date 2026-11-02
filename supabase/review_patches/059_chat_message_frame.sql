begin;
do $patch$
declare definition text;
begin
 select pg_get_functiondef('private.totus_chat_save_layout(jsonb)'::regprocedure) into definition;
 if position('chat_message_frame' in definition)=0 then
  definition=replace(definition,'if key not in (','if key not in (''chat_message_frame'',');
  definition=replace(definition,'for key in select jsonb_object_keys(p_layout) loop','if p_layout?''chat_message_frame'' and jsonb_typeof(p_layout->''chat_message_frame'')<>''boolean'' then raise exception ''Fondo de mensaje no válido.'';end if; for key in select jsonb_object_keys(p_layout) loop');
  if position('Fondo de mensaje no válido' in definition)=0 then raise exception 'No se reconoció el contrato de preferencias de Chat';end if;
  execute definition;
 end if;
end
$patch$;
commit;
