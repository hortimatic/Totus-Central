-- Internal server RPCs invoke this identity predicate as service_role.
-- No browser/user role receives EXECUTE or direct table access.
begin;
do $$ begin
 if to_regprocedure('private.totus_website_matches(text,uuid)') is not null then
  grant execute on function private.totus_website_matches(text,uuid) to service_role;
 end if;
end $$;
commit;
