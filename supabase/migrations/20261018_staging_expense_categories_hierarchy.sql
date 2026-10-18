-- STAGING ONLY: applied to isolated Supabase 2026-10-18.
-- Two-level expense hierarchy, without creating business rows.
ALTER TABLE public.ops_expense_categories ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.ops_expense_categories(id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS ops_expense_categories_parent_idx ON public.ops_expense_categories(parent_id);
ALTER TABLE public.ops_expense_categories DROP CONSTRAINT IF EXISTS ops_expense_categories_not_self_parent;
ALTER TABLE public.ops_expense_categories ADD CONSTRAINT ops_expense_categories_not_self_parent CHECK(parent_id IS NULL OR parent_id <> id);
CREATE OR REPLACE FUNCTION private.totus_validate_expense_category_hierarchy()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE p_parent uuid;
BEGIN
 IF NEW.parent_id IS NOT NULL THEN
  SELECT parent_id INTO p_parent FROM public.ops_expense_categories WHERE id=NEW.parent_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La categoría principal no existe.'; END IF;
  IF p_parent IS NOT NULL THEN RAISE EXCEPTION 'Solo se permite un nivel de subcategorías.'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_expense_categories WHERE parent_id=NEW.id) THEN
   RAISE EXCEPTION 'No se puede convertir en subcategoría una categoría con subcategorías.';
  END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION private.totus_validate_expense_category_hierarchy() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_validate_expense_category_hierarchy ON public.ops_expense_categories;
CREATE TRIGGER trg_validate_expense_category_hierarchy BEFORE INSERT OR UPDATE OF parent_id ON public.ops_expense_categories
 FOR EACH ROW EXECUTE FUNCTION private.totus_validate_expense_category_hierarchy();
