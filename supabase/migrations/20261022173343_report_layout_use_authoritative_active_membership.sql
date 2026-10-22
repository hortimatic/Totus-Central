-- Use team_members.active, the same canonical account state checked at application sign-in.
create or replace function private.totus_save_report_layout(p_order text[]) returns jsonb
language plpgsql security definer set search_path='' as $function$
declare uid uuid=auth.uid(); result jsonb;
begin
 if uid is null or not exists(select 1 from public.profiles p join public.team_members t on lower(t.email)=lower(p.email) where p.id=uid and t.active and lower(p.email)=lower(auth.jwt()->>'email')) then
  raise exception 'Acceso denegado' using errcode='42501';
 end if;
 if coalesce(array_length(p_order,1),0)<>5 or (select count(distinct v) from unnest(p_order) v)<>5
 or exists(select 1 from unnest(p_order) v where v is null or not (v=any(array['income','internal','monthly','gestor','exports']))) then
  raise exception 'Orden de bloques no válido';
 end if;
 update public.profiles set ui_preferences=jsonb_set(coalesce(ui_preferences,'{}'::jsonb),'{report_blocks}',to_jsonb(p_order),true) where id=uid returning ui_preferences->'report_blocks' into result;
 return result;
end $function$;
