begin;
create or replace function public.totus_ai_validate(p_kind text,p_record jsonb,p_rows jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved uuid; outcome jsonb; detail_text text;
begin
 if auth.uid() is null or (coalesce(auth.jwt()#>>'{app_metadata,totus_ai}','')<>'true' and coalesce(auth.jwt()#>>'{app_metadata,totus_integration}','')<>'true') or not private.is_manager() then raise exception 'Sesión propia de Totus IA requerida.';end if;
 if octet_length(coalesce(p_record,'{}')::text)+octet_length(coalesce(p_rows,'[]')::text)>150000 then raise exception 'Solicitud demasiado grande.';end if;
 begin
  if p_kind='expense' then
   saved=public.totus_save_expense(p_record,p_rows);
   select jsonb_build_object('record',to_jsonb(e),'rows',(select jsonb_agg(to_jsonb(l)) from public.ops_expense_lines l where l.expense_id=saved)) into outcome from public.ops_expenses e where id=saved;
  elsif p_kind='closing' then
   saved=public.totus_save_closing(p_record,p_rows);
   select jsonb_build_object('record',to_jsonb(c),'rows',(select jsonb_agg(to_jsonb(d)) from public.ops_daily_closing_drawers d where d.closing_id=saved)) into outcome from public.ops_daily_closings c where id=saved;
  else raise exception 'Tipo de validación no permitido.';end if;
  raise exception using errcode='PT002',message='Simulación revertida',detail=outcome::text;
 exception when sqlstate 'PT002' then get stacked diagnostics detail_text=pg_exception_detail;return detail_text::jsonb;
 end;
end $$;
revoke all on function public.totus_ai_validate(text,jsonb,jsonb) from public,anon;
grant execute on function public.totus_ai_validate(text,jsonb,jsonb) to authenticated;

commit;
