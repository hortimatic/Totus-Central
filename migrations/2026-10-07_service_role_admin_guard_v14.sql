-- Totus Central · permitir que las funciones internas de servicio actúen como administración.
-- Un cliente normal sigue necesitando estar activo en team_members con role='admin'.
-- service_role no es accesible desde el frontend; solo se usa en funciones internas seguras.

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(auth.role(),'')='service_role'
      or exists(
        select 1
        from public.team_members tm
        where lower(tm.email)=lower(coalesce(auth.jwt()->>'email',''))
          and tm.active
          and tm.role='admin'
      );
$$;
