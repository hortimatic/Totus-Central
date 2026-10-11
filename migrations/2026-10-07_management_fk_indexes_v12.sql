-- Totus Central · índices de apoyo a claves foráneas
-- Aplicada en Supabase como management_fk_indexes_v12.
-- Mantener versionada para que el estado del repositorio reproduzca la base real.

create index if not exists ops_expenses_supplier_id_idx
  on public.ops_expenses(supplier_id);

create index if not exists ops_personnel_default_category_id_idx
  on public.ops_personnel(default_category_id);

create index if not exists ops_suppliers_default_category_id_idx
  on public.ops_suppliers(default_category_id);
