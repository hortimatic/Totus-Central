alter table public.ops_onedrive_config add column warning_days smallint not null default 90, add column urgent_days smallint not null default 30, add constraint totus_credential_alert_order check(urgent_days>=1 and warning_days<=365 and warning_days>urgent_days);
create or replace function private.totus_guard_role_change() returns trigger language plpgsql set search_path='' as $function$
begin
 if tg_op='DELETE' and old.is_system then raise exception 'System roles cannot be deleted'; end if;
 if tg_op='UPDATE' then
  if old.code is distinct from new.code or old.is_system is distinct from new.is_system then raise exception 'Role code and system identity are protected'; end if;
  if old.is_system and (old.code='admin' or (to_jsonb(new)-array['name','description','updated_at']) is distinct from (to_jsonb(old)-array['name','description','updated_at'])) then raise exception 'System role identity is protected'; end if;
 end if;
 if tg_op='INSERT' and new.is_system then raise exception 'Only migrations may create a system role'; end if;
 return case when tg_op='DELETE' then old else new end;
end $function$;