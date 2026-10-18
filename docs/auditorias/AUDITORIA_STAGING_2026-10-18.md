# Totus Central — Auditoría incremental 18/10/2026

## Alcance
Lectura de la rama `staging` y Supabase STAGING `awmojepsasikxocoeqtu`. Producción `main` no se modifica. Los datos empresariales permanecen fuera de los ensayos de navegador, que usan `tests/app-mock.html`.

## Incidencias verificadas en código
1. **GAS-EXP-001 (corregido)** — En Gastos > Facturas y justificantes, elegir «Con archivo» o «Sin archivo» filtraba la tabla, pero `exportCurrentModule('gastos')` no aplicaba `gastosAttachment`. Se ha incluido la restricción solamente cuando la subpestaña activa es Facturas y justificantes, para no alterar la exportación normal de gastos. Verificación añadida: descargar y leer los dos XLSX reales generados en Playwright; comprobar referencias incluidas/excluidas.
2. **GAS-EXP-002 (corregido)** — El archivo de facturas permitía buscar por el nombre PDF y NIF/CIF, pero exportar a XLSX buscaba solo nombre de proveedor, número de factura, descripción o método de pago. Se unificó el criterio de búsqueda para exportación del archivo. Prueba añadida: buscar `justificante-test.pdf`, exportar y comprobar que contiene su factura.
3. **NAV-001 (corregido)** — Los accesos rápidos `data-route` dentro del contenido no se eliminaban al denegar permisos de vista, aunque el menú lateral sí; un clic a ruta denegada lanzaba una excepción fuera del bloque de manejo de errores. Se ocultan rutas no permitidas y la denegación informa con un aviso. Prueba Playwright con rol gerente y permiso de Pricing denegado, sin errores JavaScript.

## Evidencia de QA
- Último commit previo aprobado: `8f500b8081a3ade54c7da6fa9f443368e7751e53`, QA y publicación `success`.
- `a8a7bf6a97982a29bbcda74a01c2ff2f44aa7fb4` completó QA y publicación `success`.
- Los commits posteriores requieren la conclusión `success` de ambos GitHub Actions para darse por validados. Las pruebas funcionales y de navegador son mock; **no equivalen** a un recorrido autenticado por Supabase con cuentas reales.

## Comprobaciones no destructivas
- Supabase staging: 0 gastos, 0 facturas emitidas, 0 cierres, 0 documentos y 0 objetos en los buckets de negocio al inicio de la revisión.
- `main` verificada en `f94ccd048919de0be0df93f9d3777f0a6bb69766`.
- Sin altas de usuarios, sin registros comerciales y sin migraciones o borrados de datos durante esta intervención.

## Pendientes
- Pruebas autenticadas con gerente y encargado, y validación RLS real (no hay cuentas de prueba operativas de esos roles).
- Revisión visual y contable de los libros semestrales completos, importes, estilos, fórmulas y filtros.
- Pruebas transaccionales contra staging con rollback de registros de negocio.
- Auditoría del resto de módulos y de la restauración segura, que continúa bloqueada.

## Segunda pasada: CONT-001 — ingresos manuales omitidos
- Detección: `inicio()`, `fiscalidad()` e `informes()` no incorporaban `ops_income_adjustments`, aunque `exportSummaryWorkbook` y los libros de gestoría sí lo hacen. Los KPIs y la previsión IRPF divergían de las exportaciones.
- Corregido en `src/pages/main.js`: sumar ingresos manuales usando `income_date` y filtros de periodo/tienda; mostrar su importe acumulado en Fiscalidad.
- Detectado también que la fiscalidad sumaba algunos ajustes de otras tiendas aunque estuviera filtrada una tienda, y que los porcentajes configurados a cero se sustituían por valores predeterminados debido a `||`. Corregidos con filtro por tienda y `??`.
- Regresión ampliada en `tests/filters-qa.mjs` con ingresos 150 + ajuste 25 = 175 €, tipo IRPF 0 % y ajuste ajeno a la tienda seleccionada.
- Pendiente validar el último commit mediante QA y publicación; ningún dato contable del servidor se ha cambiado.
