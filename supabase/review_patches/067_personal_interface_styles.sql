-- Personal named styles. Additive endpoint; active interface and Login are unchanged.
begin;
create or replace function private.totus_interface_styles(p_action text,p_id uuid,p_name text,p_config jsonb,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare prefs jsonb; book jsonb; items jsonb; entry jsonb; result jsonb; actual bigint; label text;
begin
 if auth.uid() is null or not coalesce(private.totus_can('configuracion','view'),false) then raise exception 'No tienes acceso a tu configuración.';end if;
 if p_action is null or p_action not in ('create','replace','rename','remove') then raise exception 'Acción de estilo no válida.';end if;
 if p_id is null then raise exception 'Identificador de estilo no válido.';end if;
 if p_action<>'remove' then
  label=btrim(p_name);if label is null or length(label) not between 1 and 60 then raise exception 'Escribe un nombre para el estilo, de 1 a 60 caracteres.';end if;
 end if;
 if p_action in ('create','replace') then perform private.totus_validate_appearance('interfaz',p_config);end if;
 perform private.totus_chat_write_lock();
 select coalesce(ui_preferences,'{}'::jsonb) into prefs from public.profiles where id=auth.uid() for update;
 if not found then raise exception 'No se encontró tu perfil de usuario.';end if;
 book=coalesce(prefs->'interface_styles','{"revision":0,"items":[]}'::jsonb);
 actual=coalesce((book->>'revision')::bigint,0);items=coalesce(book->'items','[]'::jsonb);
 if p_expected_revision is distinct from actual then raise exception 'Tus estilos cambiaron en otra ventana. Actualiza antes de guardar.';end if;
 select value into entry from jsonb_array_elements(items) where value->>'id'=p_id::text;
 if p_action='create' and entry is not null then raise exception 'Este estilo ya está guardado. Actualiza antes de repetir.';end if;
 if p_action<>'create' and entry is null then raise exception 'No se encontró el estilo guardado. Actualiza la página.';end if;
 if p_action<>'remove' and exists(select 1 from jsonb_array_elements(items) s where lower(s->>'name')=lower(label) and s->>'id'<>p_id::text) then raise exception 'Ya tienes un estilo con ese nombre. Elige otro nombre o actualiza el existente.';end if;
 if p_action='create' then
  items=items||jsonb_build_array(jsonb_build_object('id',p_id,'name',label,'config',p_config,'updated_at',now()));
 elsif p_action='remove' then
  select coalesce(jsonb_agg(value order by ord),'[]'::jsonb) into items from jsonb_array_elements(items) with ordinality a(value,ord) where value->>'id'<>p_id::text;
 else
  select jsonb_agg(case when value->>'id'=p_id::text then value||jsonb_build_object('name',label,'config',case when p_action='replace' then p_config else value->'config' end,'updated_at',now()) else value end order by ord) into items from jsonb_array_elements(items) with ordinality a(value,ord);
 end if;
 if octet_length(items::text)>6000000 then raise exception 'La biblioteca ocupa demasiado. Reduce las imágenes o retira un estilo que ya no uses.';end if;
 result=jsonb_build_object('revision',actual+1,'items',items);
 update public.profiles set ui_preferences=jsonb_set(prefs,'{interface_styles}',result,true) where id=auth.uid();
 return result||jsonb_build_object('changed_id',case when p_action='remove' then null else p_id end);
end $$;
create or replace function public.totus_interface_styles(p_action text,p_id uuid,p_name text,p_config jsonb,p_expected_revision bigint)
returns jsonb language sql security invoker set search_path='' as $$select private.totus_interface_styles(p_action,p_id,p_name,p_config,p_expected_revision)$$;
revoke all on function private.totus_interface_styles(text,uuid,text,jsonb,bigint),public.totus_interface_styles(text,uuid,text,jsonb,bigint) from public,anon,authenticated;
grant execute on function private.totus_interface_styles(text,uuid,text,jsonb,bigint),public.totus_interface_styles(text,uuid,text,jsonb,bigint) to authenticated;
commit;
