# Totus Central

Aplicación interna de Hortimatic / NewOldSmok.

## Rama de trabajo
- Producción: `main`
- Desarrollo actual: `desarrollo-v6`
- No fusionar en `main` hasta cerrar QA funcional y validación del usuario.

## Estructura activa
- `index.html` · aplicación y módulo Pricing existente
- `app-shell-v6.css` · navegación y marco general
- `gestion-v6.css` · estilos únicos de Gestión y Facturación
- `gestion-v6.js` · núcleo de Gestión, Cajas, Gastos y servicios compartidos
- `gestion-v6-features.js` · Resumen, Facturación, Documentos, Fiscalidad, Informes y Configuración
- `migrations/2026-10-06_invoice_proforma_templates_v7.sql` · base documental/facturación
- `migrations/2026-10-06_totus_central_management_hardening_v6.sql` · estado canónico de seguridad, permisos y guardados atómicos
- `tests/ui-smoke.mjs` · recorrido automatizado
- `QA_FINAL_V6.md` · estado de pruebas

## Principios
- Pricing no se modifica salvo petición expresa.
- Cierres, gastos y documentos de venta se guardan de forma atómica.
- Encargado: operativa diaria de cajas/gastos y consulta de facturación.
- Admin/Gerente: facturación y administración.
- Gastos internos (por ejemplo horas extra o almacén interno) no se exportan a gestoría.
- Los informes de gestoría reproducen la estructura de los documentos de referencia facilitados.
- Las pruebas de base usan transacciones con `ROLLBACK` cuando generan datos temporales.

## QA
GitHub Actions no se ejecuta en cada commit. Se lanza manualmente cuando existe un bloque listo para validar.
