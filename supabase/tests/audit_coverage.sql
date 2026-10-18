begin;
do $$
declare supplier uuid; events integer;
begin
 insert into public.ops_suppliers(name) values('AUDIT LOG TRANSACTION TEST') returning id into supplier;
 select count(*) into events from public.ops_audit_log where entity_id=supplier;
 if events<>1 then raise exception 'Supplier creation not audited'; end if;
 update public.ops_suppliers set phone='600000000' where id=supplier;
 if not exists(select 1 from public.ops_audit_log where entity_id=supplier and action='actualizar' and detail->'campos' ? 'phone') then raise exception 'Changed field not audited'; end if;
 update public.ops_suppliers set name=name where id=supplier;
 if (select count(*) from public.ops_audit_log where entity_id=supplier)<>2 then raise exception 'No-op update created spurious activity'; end if;
 delete from public.ops_suppliers where id=supplier;
 if not exists(select 1 from public.ops_audit_log where entity_id=supplier and action='eliminar') then raise exception 'Deletion not audited'; end if;
 if exists(select 1 from public.ops_audit_log where entity_id=supplier and detail::text like '%600000000%') then raise exception 'Audit leaked raw field contents'; end if;
end;
$$;
select 'PASS: create, changed fields, no-op suppression and delete recorded; raw values excluded; rollback' as verification;
rollback;
