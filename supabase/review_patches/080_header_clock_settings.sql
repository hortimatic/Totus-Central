-- Clock and calendar personal presentation. No table, RLS, grant or authorization changes.
-- Staged with the frontend: deploy server-side validator first, only after isolated QA and technical review.
-- Adapt only the existing trusted JSON schema, preserving all current checks, permissions and function attributes.
begin;
do $totus_clock$
declare
 existing_definition text;
 patched_definition text;
 additional_fields text := '"clockFontSize":{"type":"range","min":11,"max":20},"clockLayout":{"type":"select","options":["stacked","inline"]},"clockSeconds":{"type":"select","options":["show","hide"]},"clockDate":{"type":"select","options":["show","hide"]},"clockFormat":{"type":"select","options":["24","12"]},"clockAction":{"type":"select","options":["calendar","tasks"]},"calendarDensity":{"type":"select","options":["compact","comfortable"]}';
 marker text := 'schema jsonb=''{"interfaz":{';
begin
 select pg_get_functiondef('private.totus_validate_appearance(text,jsonb)'::regprocedure) into existing_definition;
 if existing_definition is null then raise exception 'Validator not available; no changes applied'; end if;
 if position('"clockFontSize":{"type":"range","min":11,"max":20}' in existing_definition)>0 then
  raise notice 'Clock settings already installed';
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
$totus_clock$;
commit;
