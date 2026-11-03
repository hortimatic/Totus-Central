# Informe Playwright funcional — 03/11/2026

Base: `6aa2b6ad`. Resultado final: **21/21 suites aprobadas**.

Interacciones de navegador sobre la aplicación real con adaptadores y datos ficticios. Sin escrituras en producción y sin nuevas llamadas a modelos. No es una certificación de disponibilidad de servicios externos.

## deep-editing-browser-qa

Resultado: aprobado.

- DEEP EDITING BROWSER QA: common expense save retains inactive supplier/category, duplication protects drafts, template/series retain inactive store

## pricing-integral-browser-qa

Resultado: aprobado.

- PASS changing the simulated variant does not prompt a save, while actual edits stay protected
- PASS blank supplier cost cannot become a free purchase
- PASS blank competitor price cannot become zero
- PASS incomplete amounts clear preview without throwing
- PASS switching to variants cannot retain simple-product monthly profit
- PASS variant drafts tolerate incomplete typing and recover Spanish decimals
- PASS an interrupted supplier-cost response cannot duplicate the purchase quote
- PASS initial supplier and variant previews never turn invalid text into zero cost
- PASS stored cost, proposed PVP, discounts and monthly benefit agree after reopening
- PASS consultation conversion keeps the original and preserves the study in a product
- PASS all pricing screens fit 320 to 2560 pixels with readable mobile actions

## full-flow-qa

Resultado: aprobado.

- OK Arranque real y autenticación simulada
- OK Navegación: accesos directos ocultos y rechazo sin excepción
- OK Roles por módulo: alta, edición y restablecimiento
- OK Ayudas i: apertura, contenido y campos de un gasto
- OK Cajas: creación, cálculo, guardado y lectura
- OK Gastos: creación, importe decimal y líneas fiscales
- OK Gastos: adjuntar factura PDF y recuperar el documento
- OK Gastos: índice de facturas, búsqueda, desglose gestor y PDF descargable
- OK Cajas: segunda tienda, fecha distinta y conciliación de todos los cobros
- OK Gastos: control interno, clasificación y rechazo de factura duplicada
- OK Gastos: reemplazar justificante, previsualizar Excel y evitar archivos huérfanos
- OK Facturación: crear borrador con líneas e importes
- OK Facturación externa: archivo PDF original obligatorio y vinculado
- OK Proforma: emisión, conversión a factura y líneas sin duplicación
- OK Documentos: subida, archivo y metadatos
- OK Documentos: importación ZIP por lote, vista previa y sin duplicados
- OK Documentos Excel: carga y vista previa
- OK Documentos PDF: subir, mostrar y descargar
- OK Descarga conjunta de documentos archivados
- OK Documentos homónimos: dos subidas y descarga ZIP sin sobrescrituras
- OK Usuarios: crear y comprobar persistencia simulada
- OK Navegación de todas las pestañas tras operaciones
- OK Descargas desde los botones reales de Cajas, Gastos e Informes
- OK Pricing: guardar consulta con histórico y producto independiente
- OK Fiscalidad: alta y edición de ajuste fiscal
- OK Backup integral: descarga de base de datos y archivos simulados
- OK Paquete gestor ZIP: ambos Excel, CSV conciliados y facturas PDF originales
- OK Roles: gerente y encargado con permisos de navegación
- OK Roles personalizados: crear, asignar permisos, editar, listar en usuarios y eliminar
- E2E MOCK QA: operaciones y pestañas correctas

## expense-integral-browser-qa

Resultado: aprobado.

- PASS Importes inválidos y base pendiente no se convierten en cero
- PASS Pago parcial exige fecha igual que Registrar pago
- PASS Proveedor aplica tipo, NIF, pago e impuestos sin borrar un NIF vacío anterior
- PASS Control interno excluye fiscalidad y conserva el gasto y sus documentos
- PASS Factura sin revisión, revisión fiscal y retención coherentes con previsiones
- PASS Duplicados y fecha futura rechazados sin alterar la factura guardada
- PASS Factura común conserva su ámbito al filtrar documentos de una tienda
- PASS Archivo adjunto y pago mantienen los datos fiscales y el original
- PASS Guardar solo color permite guardar después, sin aceptar cambios concurrentes
- PASS Guardar solo adjunto avisa antes de descartar otros cambios
- PASS Exportación respeta pagos Excel, internos, alias Vaperalia y adjuntos
- PASS Proveedor: alta, edición, inactivo, búsqueda y protección de referencias
- PASS Presentación: tres pestañas, ficha y proveedor entre 320 y 2560 px

## closing-integral-browser-qa

Resultado: aprobado.

- PASS a partial draft preserves unknown closing cash after reopening
- PASS negative cash in one till cannot be offset by the other till
- PASS invalid amounts cannot keep a plausible sales preview
- PASS changing store in a saved draft reloads its own tills
- PASS exported reconciliation label matches the accepted screen
- PASS movements, fiscal inclusion, reopening and next-day cash stay coherent
- PASS incomplete draft export leaves unknown figures blank and retains known movements
- PASS downloaded Excel contains the actual saved totals and both till balances
- PASS verified historical sales stay visible in Excel without duplicating monthly fiscal income
- PASS desktop and mobile list and editor have no horizontal page overflow

## stock-async-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## stock-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## tasks-browser-qa

Resultado: aprobado.

- TASK BROWSER QA: create, repetition, state, checklist, edit dialog, filters, week/list, desktop and mobile OK

## chat-ai-target-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## api-manager-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## team-chat-browser-qa

Resultado: aprobado.

- TEAM CHAT BROWSER QA: create/edit/archive/retire, thread, member, drafts, search/dates, pins, tasks, reactions, retries, nine sizes and accounting isolation OK [{"width":1920,"scroll":1920,"sidebarOverflow":0,"buttons":[]},{"width":1440,"scroll":1440,"sidebarOverflow":0,"buttons":[]},{"width":1280,"scroll":1280,"sidebarOverflow":0,"buttons":[]},{"width":1024,"scroll":1024,"sidebarOverflow":0,"buttons":[]},{"width":900,"scroll":900,"sidebarOverflow":0,"buttons":[]},{"width":768,"scroll":768,"sidebarOverflow":0,"buttons":[]},{"width":700,"scroll":700,"sidebarOverflow":0,"buttons":[]},{"width":390,"scroll":390,"sidebarOverflow":0,"buttons":[]},{"width":320,"scroll":320,"sidebarOverflow":0,"buttons":[]}]

## account-workspace-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## user-permissions-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## user-purge-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## write-lock-browser-qa

Resultado: aprobado.

- WRITE LOCK BROWSER QA: concurrent clicks create one copy and preserve invoice defaults

## ambiguous-write-browser-qa

Resultado: aprobado.

- AMBIGUOUS WRITE BROWSER QA: committed attachment survives a lost response without duplicate accounting records

## annual-package-browser-qa

Resultado: aprobado.

- ANNUAL ZIP BROWSER QA: actual download includes cross-year expense/tax originals, paid taxes once, separate fiscal result and missing-document index

## recovery-browser-qa

Resultado: aprobado.

- RECOVERY BROWSER QA: reviewed copy, typed confirmation, cancellation without writes, upload, completion and journal actions OK (isolated adapters)

## live-refresh-qa

Resultado: aprobado.

- LIVE REFRESH QA: Apply, Enter and quarter shortcuts fetch new server data and preserve selected dates.

## session-startup-browser-qa

Resultado: aprobado.

- SESSION STARTUP BROWSER QA: delayed saved/absent/error sessions and one-at-a-time sign-in resolve correctly

## configuration-journeys-browser-qa

Resultado: aprobado.

El recorrido terminó sin error; consultar la suite y su registro para los argumentos y aserciones.

## Límites

Los problemas iniciales de servidor/dependencias se resolvieron y no se han contabilizado como fallos de la aplicación. El fallo inyectado del CDN se recoge aparte en F-01; las 21 suites correctas no lo descartan. La recuperación se simula con adaptadores, no sobre contabilidad real.
