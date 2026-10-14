# Totus Central — Procedimiento operativo de staging
Actualizado: 14 de octubre de 2026.

## Separación obligatoria
- Código: GitHub `hortimatic/Totus-Central`, rama `staging`.
- Datos: Supabase `awmojepsasikxocoeqtu` (NUNCA `zwkpmjjuurgjygcrejiw`).
- Publicación temporal separada: Supabase Edge Function `totus-staging-preview`.
- Rama `main`, web pública y Supabase de producción: **prohibido cambiar sin autorización expresa**.

## Importante: la publicación no se actualiza sola
La función Edge sirve una **instantánea de los archivos web** recopilados de la rama staging en el momento del despliegue. Una corrección guardada en GitHub **no aparece por sí sola** en la dirección de staging. No anunciar una reparación como visible hasta desplegar una nueva versión de `totus-staging-preview` y comprobarla.

Hay una puerta de acceso temporal con cookie `totus_preview_session` antes de la autenticación habitual de Supabase. No guardar ni divulgar el token en este repositorio. El control de acceso real a datos sigue dependiendo de Supabase Auth, RLS y las políticas de Storage.

## Procedimiento para una entrega verificable
1. Consultar el último estado de `staging` y comprobar que `src/config.js` apunta exclusivamente a `awmojepsasikxocoeqtu`.
2. Ejecutar los controles `node tests/qa.mjs`, `node tests/functional-regression.mjs`, `node tests/code-integrity.mjs` y `node tests/route-smoke.mjs`.
3. Instalar las dependencias de QA y ejecutar también las pruebas de `tests/excel-qa.mjs`, `tests/quarter-fixture-qa.mjs` y el navegador según `.github/workflows/qa.yml`.
4. Probar, con usuarios sintéticos de administrador, gerente y encargado, **Inicio, Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración**.
5. Verificar altas, ediciones, borrados, fechas, búsquedas, permisos y exportaciones; abrir realmente los ZIP, XLSX y PDFs.
6. Generar nueva versión de la Edge Function con los archivos actuales de `staging`. No reutilizar copias antiguas.
7. Comprobar que Supabase informa `ACTIVE`, verificar acceso autorizado, respuesta de `index.html` y recursos JS/CSS, inicio de sesión de prueba, y carga de datos solo desde staging.
8. Registrar fecha, versión de despliegue, SHA de origen y evidencias de las pruebas; solo entonces informar del cambio visible.
9. Si falla algo, mantener producción intacta, registrar incidencia y preparar la siguiente corrección en `staging`.

## Situación al 14-10-2026
- `totus-staging-preview` desplegada como **v3 ACTIVE** con puerta de acceso propia.
- Las rutas y permisos del servidor de archivos superaron comprobaciones aisladas, pero las llamadas HTTP reales externas y un navegador autenticado no pudieron verificarse desde este entorno.
- `tests/route-smoke.mjs` comprobó 39 estados de interfaz, 86 acciones y 12 filtros/tiendas con fixtures desde el código actual de staging.
- Seguridad SQL: permisos anónimos de RPC privilegiadas revocados; gastos con restricciones numéricas; actualización de metadatos y contenido de documentos limitada por propiedad/rol.
- Pendientes críticos: restauración integral (deshabilitada), roles configurables finos, pruebas reales de Auth/Storage, importador Excel y validación fiscal de los informes.
- El antiguo workflow de GitHub Pages apunta a una rama inexistente; **no habilitarlo** sin garantizar un destino que no reemplace producción.

## Preparación para venta
No atribuir al producto nivel comercial o disponibilidad del 100 % hasta contar con pruebas repetibles de navegador, accesibilidad/responsive, integridad transaccional, política de copias restaurables, documentación del dato fiscal, recuperación ante errores y permisos individualizados con evidencia.
