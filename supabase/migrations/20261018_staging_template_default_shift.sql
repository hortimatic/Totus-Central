-- Totus Central / staging / 2026-10-18
-- El índice único parcial de plantilla predeterminada impide guardar una nueva
-- mientras la anterior sigue marcada. Resolver el relevo ANTES de comprobar
-- la unicidad, dentro de la misma transacción; si falla el guardado, PostgreSQL
-- revierte también cualquier cambio de la predeterminada anterior.
-- SECURITY INVOKER (por defecto): no omitir RLS ni permisos de edición.
CREATE OR REPLACE FUNCTION public.totus_shift_template_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, private
AS $template$
BEGIN
  IF NEW.active IS TRUE AND NEW.default_invoice IS TRUE
     AND (TG_OP='INSERT' OR OLD.default_invoice IS DISTINCT FROM NEW.default_invoice
          OR OLD.store_id IS DISTINCT FROM NEW.store_id OR OLD.active IS DISTINCT FROM NEW.active)
  THEN
    UPDATE public.ops_document_templates
       SET default_invoice = FALSE
     WHERE id <> NEW.id AND store_id IS NOT DISTINCT FROM NEW.store_id
       AND active IS TRUE AND default_invoice IS TRUE;
  END IF;
  IF NEW.active IS TRUE AND NEW.default_proforma IS TRUE
     AND (TG_OP='INSERT' OR OLD.default_proforma IS DISTINCT FROM NEW.default_proforma
          OR OLD.store_id IS DISTINCT FROM NEW.store_id OR OLD.active IS DISTINCT FROM NEW.active)
  THEN
    UPDATE public.ops_document_templates
       SET default_proforma = FALSE
     WHERE id <> NEW.id AND store_id IS NOT DISTINCT FROM NEW.store_id
       AND active IS TRUE AND default_proforma IS TRUE;
  END IF;
  RETURN NEW;
END;
$template$;

DROP TRIGGER IF EXISTS totus_template_default_shift ON public.ops_document_templates;
CREATE TRIGGER totus_template_default_shift
BEFORE INSERT OR UPDATE OF default_invoice, default_proforma, store_id, active
ON public.ops_document_templates
FOR EACH ROW EXECUTE FUNCTION public.totus_shift_template_defaults();
