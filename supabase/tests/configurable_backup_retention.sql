begin;
do $test$
declare saved jsonb; actor record; bad text; rejected boolean;
begin
 select to_jsonb(c) into saved from public.ops_backup_config c where id=1;
 select p.id,t.email into actor from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) where t.role='admin' and t.active=true limit 1;
 if actor.id is null then raise exception 'No active administrator'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.id,'email',actor.email,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',actor.id::text,true);
 perform public.totus_backup_save_settings(saved||jsonb_build_object('retention_days',10));
 if (select retention_days from public.ops_backup_config where id=1)<>10 then raise exception 'Ten not saved'; end if;
 foreach bad in array array['0','11','5.5','wrong'] loop
  rejected:=false;
  begin perform public.totus_backup_save_settings(saved||jsonb_build_object('retention_days',bad)); exception when others then rejected:=true; end;
  if not rejected then raise exception 'Invalid retention accepted'; end if;
  if (select retention_days from public.ops_backup_config where id=1)<>10 then raise exception 'Failed write changed configuration'; end if;
 end loop;
 perform set_config('request.jwt.claims',jsonb_build_object('sub','11111111-1111-4111-8111-111111111111','email','not-a-member@qa.invalid','role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
 rejected:=false;
 begin perform public.totus_backup_save_settings(saved||jsonb_build_object('retention_days',1)); exception when others then rejected:=true; end;
 if not rejected then raise exception 'Non-administrator accepted'; end if;
end $test$;
rollback;
select retention_days as unchanged_after_test from public.ops_backup_config where id=1;