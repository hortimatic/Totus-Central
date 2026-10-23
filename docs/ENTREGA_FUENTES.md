# Totus Central · entrega y continuidad
## Qué conservar en Fuentes
1. El ZIP del código de la revisión aprobada, descargado desde GitHub. Incluye código, pruebas y manuales; no las facturas privadas ni las claves.
2. Este documento como índice.
3. docs/MANUAL_CHATGPT_ONLINE.md: arquitectura, conexiones y mantenimiento.
4. docs/GUIA_TRABAJO_DIARIO_CHATGPT.md: gastos, cajas y documentos.
5. docs/COTEJOS_CHATGPT.md: recepciones y biblioteca.
6. docs/auditorias/REVISION_INTEGRAL_2026-10-24.md: alcance, resultados y pendientes.
No elimines las fuentes antiguas hasta verificar que puedes abrir los nuevos documentos. No copies claves ni contraseñas a Fuentes.

## Dónde está cada cosa
- Web única: https://hortimatic.github.io/Totus-Central/
- Código: hortimatic/Totus-Central, rama totus-central.
- Supabase: awmojepsasikxocoeqtu, proyecto Totus Central. Registros, acceso, permisos y procesos.
- OneDrive: Apps/Totus Central. Originales y copias verificadas.
- Copias: diez completas, retirando la antigua tras verificar la nueva; 00:35 Europe/Madrid en servidor.
El código público no es la copia de la contabilidad. Para recuperar datos usa una copia completa verificada. La recuperación conserva las contraseñas actuales; las claves del servidor se configuran aparte.

## Dos chats de trabajo
### Gastos y cajas
Lee GUIA_TRABAJO_DIARIO_CHATGPT.md y MANUAL_CHATGPT_ONLINE.md desde GitHub. Descubre las herramientas GitHub, Supabase y SharePoint/OneDrive disponibles. Prueba primero la lectura de las dos tiendas y de un documento conocido por ID, comprobando contenido.
Para registrar, identifica proveedor, tienda, número e importe de factura; contrasta Excel sin exigir igualdad de fecha de pago y emisión. Evita duplicados. Adjunta el original correcto y verifica vista previa y tratamiento fiscal. Los impuestos pagados y gastos internos quedan excluidos del beneficio fiscal. No cambies periodos presentados ni aceptes diferencias por aproximación.
### Recepciones
Lee COTEJOS_CHATGPT.md. Usa la instrucción de la recepción, su revisión y documentos exactos. Comprueba todas las páginas y líneas. Reutiliza solo equivalencias confirmadas de la misma variante. Guarda con revisión vigente y vuelve a leer el resultado. No modifica gastos ni existencias de PrestaShop.

## Prueba de conexiones de un chat nuevo
1. GitHub: leer este índice y manuales de la rama actual.
2. Supabase: leer ops_stores y totus_stock_context de un pedido conocido, usando la cuenta autorizada real.
3. OneDrive: leer un PDF por graph_item_url del contexto, cotejando nombre y contenido.
4. Si un lector no admite un formato, utilizar extracted_text solo con cobertura completa. No marcar como leídas páginas ausentes.
5. Informar de la operación exacta y respuesta. No recrear claves por fallos de formato. Una prueba desde Codex no certifica otro chat: hay que ejecutar esta lista allí.
6. Simular escrituras en pruebas aisladas. No crear gastos ficticios en producción.
Los procesos de servidor no necesitan un ordenador encendido. Cada chat debe disponer de los conectores autorizados en su sesión.

## Montaje y recuperación
Para la instalación actual, seguir README.md y el manual. GitHub publica después de las pruebas.
Para moverla, conservar archivos, copia completa y configuración privada del servidor en un gestor seguro.
Las migraciones describen la evolución de esta base existente. Un montaje comercial en una base vacía necesita preparar y certificar su esquema inicial, accesos, instalación y recuperación. Esta entrega no es todavía un instalador comercial certificado.

## Inventario del código propio
- src/api.js
- src/app.js
- src/archive-documents.js
- src/backup-index.js
- src/backup-retention.js
- src/backup-set.js
- src/backup-transport.js
- src/backup.js
- src/calculations.js
- src/cloud-backup-reader.js
- src/components.js
- src/config.js
- src/connection-maintenance.js
- src/dashboard-activity.js
- src/excel.js
- src/expense-register.js
- src/file-utils.js
- src/form-drafts.js
- src/gestor-format.js
- src/historical-acceptance.js
- src/income-breakdown.js
- src/onedrive-connection.js
- src/pages/main.js
- src/payment-information.js
- src/pdf-preview.js
- src/permissions.js
- src/recovery-core.js
- src/recovery-runner.js
- src/report-layout.js
- src/report-package.js
- src/report-period.js
- src/state.js
- src/stock-core.js
- src/stock-extract.js
- src/stock-ui.js
- src/stock-workflow.js
- src/storage-planning.js
- src/styles.css
- src/tax-expense.js
- src/utils.js
- src/workbook-preview.js
Los componentes de terceros se conservan con sus licencias y versiones. No borrar compatibilidad de copias por su antigüedad.
