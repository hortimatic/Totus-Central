-- Independent colours for personal interface (15 keys). No table, RLS, grant or authorization changes.
-- Staged with the frontend: deploy server-side validator first, only after isolated QA and technical review.
-- Adapt only the existing trusted JSON schema, preserving all current checks, permissions and function attributes.
begin;
do $totus_palette$
declare
 existing_definition text;
 patched_definition text;
 additional_fields text := '"headingText":{"type":"color"},"labelText":{"type":"color"},"topbarBackground":{"type":"color"},"topbarText":{"type":"color"},"inputBackground":{"type":"color"},"inputText":{"type":"color"},"tableHeadBackground":{"type":"color"},"tableHeadText":{"type":"color"},"tableRowBackground":{"type":"color"},"secondaryButtonBackground":{"type":"color"},"secondaryButtonText":{"type":"color"},"noteBackground":{"type":"color"},"noteText":{"type":"color"},"filterBackground":{"type":"color"},"modalBackground":{"type":"color"}';
 marker text := 'schema jsonb=''{"interfaz":{';
begin
 select pg_get_functiondef('private.totus_validate_appearance(text,jsonb)'::regprocedure) into existing_definition;
 if existing_definition is null then raise exception 'Validator not available; no changes applied'; end if;
 if position('"headingText":{"type":"color"}' in existing_definition)>0 then
  raise notice 'Independent interface colours already installed';
  return;
 end if;
 if position(marker in existing_definition)=0
   or position('"navigationActive":{"type":"color"}' in existing_definition)=0
   or position('"login":{' in existing_definition)=0
 then raise exception 'Unexpected appearance validator version; review before deploying'; end if;
 patched_definition=replace(existing_definition,marker,marker||additional_fields||',');
 if patched_definition=existing_definition then raise exception 'Validator schema not updated'; end if;
 execute patched_definition;
end
$totus_palette$;
commit;
