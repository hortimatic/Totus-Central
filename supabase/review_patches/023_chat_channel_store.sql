-- Fill the omitted store assignment without replacing newer message safeguards.
DO $patch$
DECLARE definition text; changed text;
BEGIN
 SELECT pg_get_functiondef('private.totus_chat_command(text,jsonb)'::regprocedure) INTO definition;
 changed=replace(definition,'description=coalesce(p_data->>''description'',''''),is_private=',
 'description=coalesce(p_data->>''description'',''''),store_id=case when coalesce((p_data->>''update_store'')::boolean,false) then nullif(p_data->>''store_id'','''')::uuid else store_id end,is_private=');
 IF changed=definition AND strpos(definition,'store_id=case when coalesce((p_data->>''update_store'')::boolean,false)')=0 THEN RAISE EXCEPTION 'Unexpected channel update definition';END IF;
 IF changed<>definition THEN EXECUTE changed;END IF;
END $patch$;
