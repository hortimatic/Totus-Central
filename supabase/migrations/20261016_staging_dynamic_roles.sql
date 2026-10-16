-- STAGING ONLY. Dynamic roles for Totus Central; never apply to main without a separate review.
BEGIN;
CREATE TABLE IF NOT EXISTS public.ops_roles(
 code text PRIMARY KEY CHECK(code ~ '^[a-z][a-z0-9_]{2,31}$'),
 name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 3 AND 80),
 description text NOT NULL DEFAULT '',
 is_system boolean NOT NULL DEFAULT false,
 sort_order integer NOT NULL DEFAULT 100,
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ops_roles(code,name,description,is_system,sort_order) VALUES
('admin','Administrador','Control completo y protegido',true,0),
('gerente','Gerencia','Gestión general, con límites de administración',true,10),
('encargado','Encargado','Operativa diaria con permisos limitados',true,20)
ON CONFLICT(code) DO NOTHING;
-- Existing role assignments must be declared before removing the old three-value check.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.team_members t LEFT JOIN public.ops_roles r ON t.role=r.code WHERE r.code IS NULL)
 THEN RAISE EXCEPTION 'Team member assigned an unknown role'; END IF;
END $$;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.ops_role_permissions DROP CONSTRAINT IF EXISTS ops_role_permissions_role_check;
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_fk;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_role_fk FOREIGN KEY (role) REFERENCES public.ops_roles(code) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE public.ops_role_permissions DROP CONSTRAINT IF EXISTS ops_role_permissions_role_fk;
ALTER TABLE public.ops_role_permissions ADD CONSTRAINT ops_role_permissions_role_fk FOREIGN KEY (role) REFERENCES public.ops_roles(code) ON DELETE CASCADE ON UPDATE RESTRICT;
-- Locks system-defined roles even for privileged application operations.
CREATE OR REPLACE FUNCTION private.totus_guard_role_change()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $fn$
BEGIN
 IF TG_OP='DELETE' AND OLD.is_system THEN RAISE EXCEPTION 'System roles cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (OLD.is_system OR NEW.is_system OR OLD.code IS DISTINCT FROM NEW.code) THEN
  RAISE EXCEPTION 'System role or role code is protected';
 END IF;
 IF TG_OP='INSERT' AND NEW.is_system THEN RAISE EXCEPTION 'Only migrations may create a system role'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
DROP TRIGGER IF EXISTS totus_guard_role_change ON public.ops_roles;
CREATE TRIGGER totus_guard_role_change BEFORE INSERT OR UPDATE OR DELETE ON public.ops_roles
FOR EACH ROW EXECUTE FUNCTION private.totus_guard_role_change();
ALTER TABLE public.ops_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_roles FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.ops_roles TO authenticated;
CREATE POLICY totus_role_catalog_read ON public.ops_roles FOR SELECT TO authenticated
 USING (private.is_team_member());
CREATE POLICY totus_role_catalog_insert ON public.ops_roles FOR INSERT TO authenticated
 WITH CHECK (private.is_admin() AND NOT is_system AND code NOT IN ('admin','gerente','encargado'));
CREATE POLICY totus_role_catalog_update ON public.ops_roles FOR UPDATE TO authenticated
 USING (private.is_admin() AND NOT is_system)
 WITH CHECK (private.is_admin() AND NOT is_system AND code NOT IN ('admin','gerente','encargado'));
CREATE POLICY totus_role_catalog_delete ON public.ops_roles FOR DELETE TO authenticated
 USING (private.is_admin() AND NOT is_system);
CREATE OR REPLACE FUNCTION private.totus_can(p_module text,p_action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $fn$
 SELECT coalesce((
  SELECT CASE WHEN tm.role='admin' THEN true
  WHEN tm.role NOT IN ('gerente','encargado') AND p_module='administracion' THEN false
  ELSE
   coalesce(
    CASE p_action WHEN 'view' THEN usr.can_view WHEN 'create' THEN usr.can_create WHEN 'edit' THEN usr.can_edit WHEN 'delete' THEN usr.can_delete WHEN 'export' THEN usr.can_export ELSE false END,
    CASE p_action WHEN 'view' THEN rp.can_view WHEN 'create' THEN rp.can_create WHEN 'edit' THEN rp.can_edit WHEN 'delete' THEN rp.can_delete WHEN 'export' THEN rp.can_export ELSE false END,
    CASE WHEN tm.role='gerente' THEN ((p_module<>'administracion' OR p_action='view') AND NOT (p_module='fiscalidad' AND p_action='delete'))
      WHEN tm.role='encargado' THEN (p_module<>'administracion' AND (p_action='view' OR (p_module='documentos' AND p_action IN ('create','edit'))))
      ELSE false END
   ) AND coalesce(usr.can_view,rp.can_view,
       CASE WHEN tm.role='gerente' THEN true WHEN tm.role='encargado' THEN p_module<>'administracion' ELSE false END)
  END
  FROM public.team_members tm
  JOIN public.ops_roles r ON r.code=tm.role
  LEFT JOIN public.ops_user_permissions usr ON lower(usr.email)=lower(tm.email) AND usr.module=p_module
  LEFT JOIN public.ops_role_permissions rp ON rp.role=tm.role AND rp.module=p_module
  WHERE lower(tm.email)=lower(coalesce(auth.jwt()->>'email','')) AND tm.active=true
  LIMIT 1
 ),false)
 AND auth.uid() IS NOT NULL
 AND p_module IN ('inicio','pricing','cajas','gastos','facturacion','documentos','fiscalidad','informes','administracion')
 AND p_action IN ('view','create','edit','delete','export');
$fn$;
REVOKE ALL ON FUNCTION private.totus_can(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.totus_can(text,text) TO authenticated;
COMMIT;
