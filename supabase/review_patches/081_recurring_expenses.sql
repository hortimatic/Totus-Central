-- Forecast commitments only: never inserts or updates accounting expenses.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create table public.ops_recurring_expenses(
 id uuid primary key default gen_random_uuid(),revision bigint not null default 1 check(revision>0),
 title text not null check(length(trim(title)) between 2 and 120),
 supplier_id uuid references public.ops_suppliers(id),store_id uuid references public.ops_stores(id),
 amount_cents bigint not null check(amount_cents between 0 and 1000000000000),
 first_on date not null,last_on date,frequency text not null check(frequency in ('once','weekly','monthly','quarterly','yearly')),
 notice_days integer not null default 7 check(notice_days between 0 and 60),active boolean not null default true,
 notes text not null default '' check(length(notes)<=2000),history jsonb not null default '[]' check(jsonb_typeof(history)='array'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),updated_by uuid references auth.users(id),
 check(last_on is null or last_on>=first_on)
);
alter table public.ops_recurring_expenses enable row level security;
create policy recurring_expenses_read on public.ops_recurring_expenses for select to authenticated using((select private.totus_can('gastos','view')));
revoke all on public.ops_recurring_expenses from anon,authenticated;
grant select on public.ops_recurring_expenses to authenticated;
grant all on public.ops_recurring_expenses to service_role;
create or replace function private.totus_recurring_dates(p_first date,p_last date,p_frequency text,p_from date,p_to date) returns setof date
language plpgsql immutable set search_path='' as $$
declare i integer;d date;step_months integer;
begin
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_first is null or p_frequency not in ('once','weekly','monthly','quarterly','yearly') then raise exception 'Periodo de previsión no válido.';end if;
 step_months=case p_frequency when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 else 0 end;
 for i in 0..11999 loop
 d=case when p_frequency='once' then p_first when p_frequency='weekly' then p_first+i*7 else (p_first+make_interval(months=>i*step_months))::date end;
 if d>p_to or (p_last is not null and d>p_last) then return;end if;
 if d>=p_from then return next d;end if;
 if p_frequency='once' then return;end if;
 end loop;
 raise exception 'Calendario demasiado antiguo para completar la consulta.';
end $$;
revoke all on function private.totus_recurring_dates(date,date,text,date,date) from public,anon,authenticated;
create or replace function public.totus_recurring_expenses(p_action text default 'list',p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid;current_row public.ops_recurring_expenses;operation text;actor text;due date;resolution text;result jsonb;clean jsonb;
begin
 if auth.uid() is null or not coalesce(private.totus_can('gastos','view'),false) then raise exception 'No tienes acceso a Gastos.';end if;
 if p_action not in ('list','save','resolve','archive') or jsonb_typeof(p_data) is distinct from 'object' then raise exception 'Acción de previsión no válida.';end if;
 if p_action<>'list' then
 perform private.totus_chat_write_lock();target=(p_data->>'id')::uuid;
 if target is null then raise exception 'Identificador de previsión necesario.';end if;
 select * into current_row from public.ops_recurring_expenses where id=target for update;
 operation=case when current_row.id is null then 'create' when p_action='archive' then 'delete' else 'edit' end;
 if not private.totus_can('gastos',operation) then raise exception 'No tienes permiso para esta operación de Gastos.';end if;
 if current_row.id is null and p_action<>'save' then raise exception 'Previsión no disponible.';end if;
 if coalesce(current_row.revision,0) is distinct from (p_data->>'revision')::bigint then raise exception 'La previsión ha cambiado. Actualiza antes de guardar.';end if;
 if p_action='save' then
 if exists(select 1 from jsonb_object_keys(p_data)k where k not in ('id','revision','title','supplier_id','store_id','amount_cents','first_on','last_on','frequency','notice_days','active','notes')) then raise exception 'Campos de previsión no permitidos.';end if;
 if current_row.id is null then
 insert into public.ops_recurring_expenses(id,title,supplier_id,store_id,amount_cents,first_on,last_on,frequency,notice_days,active,notes,updated_by)
 values(target,trim(p_data->>'title'),nullif(p_data->>'supplier_id','')::uuid,nullif(p_data->>'store_id','')::uuid,(p_data->>'amount_cents')::bigint,(p_data->>'first_on')::date,nullif(p_data->>'last_on','')::date,p_data->>'frequency',(p_data->>'notice_days')::integer,coalesce((p_data->>'active')::boolean,true),coalesce(p_data->>'notes',''),auth.uid());
 else
 update public.ops_recurring_expenses set title=trim(p_data->>'title'),supplier_id=nullif(p_data->>'supplier_id','')::uuid,store_id=nullif(p_data->>'store_id','')::uuid,amount_cents=(p_data->>'amount_cents')::bigint,first_on=(p_data->>'first_on')::date,last_on=nullif(p_data->>'last_on','')::date,frequency=p_data->>'frequency',notice_days=(p_data->>'notice_days')::integer,active=coalesce((p_data->>'active')::boolean,true),notes=coalesce(p_data->>'notes',''),revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=target;
 end if;
 elsif p_action='archive' then update public.ops_recurring_expenses set active=false,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=target;
 else
 due=(p_data->>'due_on')::date;resolution=p_data->>'status';
 if resolution not in ('paid','skipped','pending') or not exists(select 1 from private.totus_recurring_dates(current_row.first_on,current_row.last_on,current_row.frequency,due,due)d where d=due) then raise exception 'Vencimiento no válido.';end if;
 select coalesce(jsonb_agg(e),'[]') into clean from jsonb_array_elements(current_row.history)e where e->>'due_on' is distinct from due::text;
 if resolution<>'pending' then clean=clean||jsonb_build_array(jsonb_build_object('due_on',due,'status',resolution,'amount_cents',current_row.amount_cents,'resolved_at',now(),'resolved_by',auth.uid()));end if;
 update public.ops_recurring_expenses set history=clean,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=target;
 end if;
 select email into actor from auth.users where id=auth.uid();insert into public.ops_audit_log(user_id,user_email,area,action,detail) values(auth.uid(),actor,'gastos','prevision_'||p_action,jsonb_build_object('id',target));
 end if;
 if (select count(*) from public.ops_recurring_expenses)>10000 then raise exception 'El inventario de previsiones requiere filtros adicionales.';end if;
 select coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('supplier_name',s.name,'store_name',t.name) order by r.first_on,r.title),'[]') into result from public.ops_recurring_expenses r left join public.ops_suppliers s on s.id=r.supplier_id left join public.ops_stores t on t.id=r.store_id;
 return jsonb_build_object('rows',result,'changed_id',target);
end $$;
revoke all on function public.totus_recurring_expenses(text,jsonb) from public,anon;
grant execute on function public.totus_recurring_expenses(text,jsonb) to authenticated;
create or replace function public.totus_recurring_expense_layout(p_layout jsonb default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare prefs jsonb;k text;v jsonb;valid text[]:=array['title','supplier_name','store_name','due_on','amount_cents','status','frequency','notice_days','first_on','last_on','notes','updated_at'];
begin
 if auth.uid() is null or not coalesce(private.totus_can('gastos','view'),false) then raise exception 'No tienes acceso a Gastos.';end if;
 if p_layout is null then return (select ui_preferences->'recurring_expense_table' from public.profiles where id=auth.uid());end if;
 if jsonb_typeof(p_layout)<>'object' or exists(select 1 from jsonb_object_keys(p_layout)x where x not in ('columns','widths','pageSize')) or jsonb_typeof(p_layout->'columns') is distinct from 'array' or jsonb_array_length(p_layout->'columns') not between 1 and 12 or (select count(distinct value) from jsonb_array_elements_text(p_layout->'columns'))<>jsonb_array_length(p_layout->'columns') or exists(select 1 from jsonb_array_elements_text(p_layout->'columns')x where not x=any(valid)) or coalesce(p_layout->>'pageSize','') not in ('0','10','20','50','100') or jsonb_typeof(p_layout->'widths') is distinct from 'object' then raise exception 'Distribución no válida.';end if;
 for k,v in select * from jsonb_each(p_layout->'widths') loop if not k=any(valid) or jsonb_typeof(v)<>'number' or v::text!~'^[0-9]+$' or (v::text)::int not between 80 and 640 then raise exception 'Anchura de columna no válida.';end if;end loop;
 perform private.totus_chat_write_lock();select coalesce(ui_preferences,'{}') into prefs from public.profiles where id=auth.uid() for update;if not found then raise exception 'Perfil no disponible.';end if;
 update public.profiles set ui_preferences=jsonb_set(prefs,'{recurring_expense_table}',p_layout,true) where id=auth.uid();return p_layout;
end $$;
revoke all on function public.totus_recurring_expense_layout(jsonb) from public,anon;
grant execute on function public.totus_recurring_expense_layout(jsonb) to authenticated;
commit;
