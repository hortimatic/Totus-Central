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

## Auditoría preimportación de los nueve módulos (18/10/2026)

### Revisión por pestañas y apartados internos
| Módulo | Partes revisadas | Evidencia | Límite |
|---|---|---|---|
| Inicio | KPIs, cierres rápidos, ingresos y gasto mensual/trimestral, accesos y espacio | `filters-qa`, `browser-qa`, `layout-audit` | Estimaciones hasta cargar y cotejar movimientos |
| Precios | Productos, familias, marcas, proveedores, variantes, precios competidores, consultas e históricos | `full-flow-qa`, `route-smoke`, `action-inventory` | Sin catálogo real de referencia cargado |
| Cajas | Cierres por tienda/cajón, borradores, reabrir, eliminar, fechas y Excel | `full-flow-qa`, `deletion-flows-qa`; además RPC real autenticada `totus_save_closing`→`totus_delete_closing` con `ROLLBACK` | Falta cotejo histórico día a día con los dos libros originales |
| Gastos | Registros, líneas de impuesto, proveedores, justificantes, filtro de facturas, revisión fiscal, eliminación | `full-flow-qa`, `expense-archive-qa`, `fiscal-submenus-qa`, `deletion-flows-qa` | No certificado ciclo de gasto completo contra Supabase con fichero real |
| Facturación | Documentos, clientes, plantillas/logo, series, borradores, proformas, rectificativas, facturas externas, pagos | `billing-submenus-qa`, `full-flow-qa`, `deletion-flows-qa` | Facturas emitidas nunca se borran directamente; falta verificación de operación real bajo sesión de gerente |
| Documentos | Alta, sustitución, vista previa PDF/Excel, descarga, ZIP, archivo/Storage, eliminar | `document-archive-qa`, `full-flow-qa`, `storage-live-qa` | Descarga/subida reales requieren prueba final autenticada con archivos de muestra |
| Fiscalidad | Modelo 130 acumulado, modelos 111 y 115, ajustes, pagos, filtros por tienda, revisión de gastos | `fiscal-submenus-qa`, `filters-qa`, `quarter-fixture-qa` | Cálculo orientativo; conciliar con liquidaciones del gestor |
| Informes | Libros por tienda, libro 20 columnas, paquetes ZIP, resumen, vista previa, filtros | `excel-qa`, `excel-invariants`, `full-flow-qa` | Aún falta comparación celda por celda de importes con el semestre real |
| Administración | Usuarios, roles/permisos, negocio/cajas, fiscal, almacenamiento, copias, log | `admin-submenus-qa`, `roles-and-help-qa`, `storage-live-qa`, `backup-qa`, `store-drawers-qa` | Sin sesiones reales de gerente/encargado; restauración integral bloqueada |

La revisión visual automatizada incluye 26 pantallas/estados × 3 tamaños (78 combinaciones escritorio/tableta/móvil). No equivale a una certificación universal de todos los casos de uso.

### Errores reales encontrados y reparados en esta pasada
1. **API-001: borrado silencioso.** Antes `remove()` consideraba éxito una petición HTTP sin error aunque eliminara cero filas; ahora exige exactamente una fila devuelta por Supabase. Test con denegación RLS, registro inexistente y borrado real simulado.
2. **API-002: truncamiento/paginación.** La carga tenía límite implícito de 20.000 registros y orden no determinista en tablas grandes. Ahora pagina con clave única (incluye tablas con PK compuesta), admite 100.000 filas y avisa si alcanza el máximo en lugar de dar informes incompletos. Test con 2.305 filas y límites.
3. **EXP-001: error de ceros en paquete gestor.** El resumen CSV utilizaba `a||b` en gastos fiscales e internos; sustituido por `a??b` para preservar el cero explícito.
4. **DOC-001: alta imposible en Supabase.** `ops_documents.linked_entity_type` es `NOT NULL`; el cliente enviaba `null` al subir un archivo no vinculado. Ahora envía cadena vacía como exige la estructura real.
5. **DOC-002: pérdida automática de originales.** Sustituir, desvincular o borrar un gasto destruía en ciertos casos el justificante original sin borrado documental separado. Ahora se conserva en Documentos y se limpia el vínculo al gasto; el usuario puede eliminarlo expresamente desde Documentos. Regresión de sustitución y borrado añadida.
6. **FIS-001: revisión fiscal imposible.** `saveExpense` escribía `fiscal_reviewed:false` siempre; no había ninguna casilla para marcar el gasto como cotejado. Añadido control explícito de revisión que excluye inicialmente el gasto y permite incorporarlo a Fiscalidad e Informes tras cotejar. Test de edición, persistencia y KPI.

### Evidencia de servidor real sin datos persistentes
- Postgres real: 40/40 tablas públicas con RLS activado; la comprobación de todos los avisos `SECURITY DEFINER` sigue pendiente de cierre.
- JWT completo de usuario administrador en transacción: permisos de crear Cajas/borrar Gastos/Facturación correctos. JWT de no miembro: acceso denegado.
- RPC real Cajas: crear borrador, comprobar que se creó, eliminarlo y comprobar ausencia dentro de `BEGIN … ROLLBACK`. Confirmado correcto.
- RPC real Almacenamiento: devuelve `status=ok`, `database_bytes>0`, `observed_total_bytes>0` y cuota interna prevista, todo bajo JWT autenticado con `ROLLBACK`.
- Intento de otra prueba transaccional de Gastos denegado por controles de seguridad de la conexión: no afirmar que se verificó ni reintentar el mismo tipo de escritura.
- Cierres, gastos, facturas, documentos y archivos de negocio siguen en cero.
- Producción `main` sin modificación: `f94ccd048919de0be0df93f9d3777f0a6bb69766`.
- Commit evaluado `1b7cc54e09a188ac7297558f561fcdd256adaadc`: QA `39117164063` **success**, despliegue `39117164013` **success**.

### Estado de los Excel originales
Se importaron y examinaron mediante `artifact_tool`: libros por mes de Hortimatic/NewOldSmok (12 hojas por tienda) y gestoría (Auditoría, Conciliación 1T/2T, Libro gestor 1T/2T). La exportación QA respeta encabezados y estructura principal, incluidos 20 campos de Libro gestor. No se ha volcado la contabilidad real y **no** se han certificado aún cifras reales, fórmulas o estilos celda a celda.

### Limitaciones explícitas / criterio de entrada
**No declarar el sistema 100 % certificado.** Aún faltan:
- Prueba con identidades autenticadas de gerente y encargado (staging sólo tiene un administrador activo).
- Restauración integral de una copia a partir del propio archivo: permanece bloqueada por seguridad y sin certificación de recuperación.
- Conciliación de operaciones reales de ambas tiendas, importación y exportación de una semana completa, verificando totales, impuestos, fechas y documentación.
- Revisión de incidencias del asesor de seguridad: 12 advertencias por funciones `SECURITY DEFINER` destinadas a autenticados; advertencia no equivale automáticamente a exposición, pero debe revisarse individualmente.

**Decisión:** se puede preparar una carga piloto controlada *sólo en staging*, tras guardar una copia verificada y con capacidad de deshacer/corregir sus propios registros. No volcar semestre completo ni publicar en producción hasta certificar importación, fiscalidad y recuperación. Nunca cambiar `main` sin aprobación expresa.
