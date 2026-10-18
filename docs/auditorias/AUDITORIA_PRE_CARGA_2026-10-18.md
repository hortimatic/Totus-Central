# Totus Central — pre-carga 18/10/2026

## Alcance real
Se audita `staging` contra el proyecto aislado `awmojepsasikxocoeqtu`. Ningún registro comercial se ha importado. `main` y Supabase de producción permanecen sin modificación.

## Almacenamiento
Anteriormente la barra medía sólo la cuota interna de documentos y logos, ambos con 0 archivos. La base de datos PostgreSQL ya consume aprox. 18,8 MB, pero no figuraba visualmente en la barra. Ahora hay dos medidores distintos: distribución observada (base de datos, documentos, logos y copias) y progreso del límite operativo de documentos/logos (500 MiB). No se inventa la cuota contratada de Supabase.

## Categorías de gastos
Staging no tenía categorías ni subcategorías. El esquema histórico era plano. Migración `staging_expense_category_subcategory_hierarchy_20261018` aplicada sólo a staging: nuevo `parent_id` referenciado, protección contra autovínculos y categorías de tres niveles, y rechazo de eliminación de padres con hijos. No se han creado categorías reales.
La interfaz distingue raíces/hijos; permite alta, edición, ordenación y eliminación segura no vinculada; selección de subcategorías en gastos y proveedores; conserva la selección histórica inactiva. Los códigos de grupo fiscal (incluido `INTERNAL_`) se heredan para evitar deducciones incorrectas y mantener los colores del Excel mensual.

## Categorías en Pricing
La relación vigente `Marcas → Familias → Productos` funciona con una etiqueta `families.category` de texto libre, **sin subcategorías normalizadas**. Es un área separada de las categorías fiscales; no debe confundirse con el nuevo árbol de Gastos.

## Pruebas y límites
GitHub Actions ejecuta vistas escritorio y móvil, botones, operaciones de negocio y descargas XLSX/PDF/ZIP con datos simulados; no certifica el ciclo autenticado con los roles gerente y encargado sobre Supabase. Quedan por validar esas identidades, cotejar íntegramente los Excel semestrales frente a sus originales y ensayar la restauración. No poner en producción ni importar datos reales basándose sólo en QA simulada.
