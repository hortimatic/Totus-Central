-- Additive read-only team library. Existing private styles and their write RPC stay intact.
begin;
create or replace function private.totus_shared_interface_styles()
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not coalesce(private.totus_can('configuracion','view'),false) then raise exception 'No tienes acceso a tu configuración.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',item.id,'name',item.name,'author',item.author,'config',item.config,'mine',false) order by item.name,item.id),'[]'::jsonb) into result
 from (
  select md5(p.id::text||':'||(s.value->>'id')) as id,left(s.value->>'name',60) as name,left(coalesce(nullif(to_jsonb(p)->>'full_name',''),'Equipo'),80) as author,
   (select coalesce(jsonb_object_agg(c.key,c.value),'{}'::jsonb) from jsonb_each(case when jsonb_typeof(s.value->'config')='object' then s.value->'config' else '{}'::jsonb end) c where c.key=any(array['backgroundDim','theme','primary','secondary','accent','bg','surface','card','text','muted','headingText','labelText','clockFontSize','clockLayout','clockSeconds','clockDate','clockFormat','clockAction','calendarDensity','topbarBackground','topbarText','inputBackground','inputText','tableHeadBackground','tableHeadText','tableRowBackground','secondaryButtonBackground','secondaryButtonText','noteBackground','noteText','filterBackground','modalBackground','density','shadow','navigationBackground','navigationText','navigationSectionText','navigationActive','navigationMode','sidebarWidth','topbarHeight','fontSize','pagePad','gap','radius','buttonRadius','cardPadding','tableRowHeight','borderStrength','borderColor','borderWidth','glowColor','cardGlow','buttonGlow','hoverEffect','buttonFinish','buttonStyle']::text[])) as config
  from public.profiles p cross join lateral jsonb_array_elements(case when jsonb_typeof(p.ui_preferences->'interface_styles'->'items')='array' then p.ui_preferences->'interface_styles'->'items' else '[]'::jsonb end) s(value)
  where p.id<>auth.uid() and to_jsonb(p)->>'active' is distinct from 'false' and length(s.value->>'name') between 1 and 60 and s.value->>'id' is not null
  order by p.id,s.value->>'id' limit 200
 ) item where item.config<>'{}'::jsonb;
 return jsonb_build_object('items',result);
end $$;
create or replace function public.totus_shared_interface_styles()
returns jsonb language sql security invoker set search_path='' as $$select private.totus_shared_interface_styles()$$;
revoke all on function private.totus_shared_interface_styles(),public.totus_shared_interface_styles() from public,anon,authenticated;
grant execute on function private.totus_shared_interface_styles(),public.totus_shared_interface_styles() to authenticated;
commit;
