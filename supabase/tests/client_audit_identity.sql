begin;
select set_config('request.jwt.claims',(
 select jsonb_build_object('sub',u.id,'email',lower(u.email),'role','authenticated')::text
 from auth.users u join public.team_members t on lower(t.email)=lower(u.email)
 where t.active and t.role='admin' limit 1
),true);
set local role authenticated;
do $$
begin
 insert into public.ops_audit_log(user_id,user_email,area,action,detail)
 values (auth.uid(),lower(auth.jwt()->>'email'),'administracion','unused_logos_removed','{"count":0,"test":true}');
 begin
  insert into public.ops_audit_log(user_id,user_email,area,action)
  values (auth.uid(),'another-person@qa.invalid','administracion','unused_logos_removed');
  raise exception 'Se aceptó atribuir el evento a otra persona';
 exception when insufficient_privilege then null;
 end;
 begin
  insert into public.ops_audit_log(user_id,user_email,area,action)
  values (auth.uid(),lower(auth.jwt()->>'email'),'facturacion','invoice_issued');
  raise exception 'Se aceptó fabricar un evento de emisión desde el cliente';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
select 'OK: identidad y origen de auditoría protegidos; prueba revertida' as resultado;
rollback;
