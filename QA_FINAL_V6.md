# TOTUS CENTRAL · QA DE DESARROLLO

Fecha: 2026-10-07
Rama probada: `desarrollo-v6`
Commit UI QA de referencia: `2feb390a56344d757c753a1e5837f4cabf055431`
HEAD documentado: `29b544f4120313c1256f397d77daf636329c110c`
Producción: `main` NO modificada.

## Navegación
- Inicio
- Pricing
- Cajas
- Gastos
- Facturación
- Documentos
- Fiscalidad
- Informes
- Administración
- Login único para toda la aplicación.
- Pricing conserva su navegación interna y su buscador propio.

## Facturación
Probado:
- factura ordinaria
- factura rectificativa
- proforma
- proforma -> factura
- numeración por series
- bloqueo de líneas tras emisión
- detección de número externo duplicado
- factura creada fuera + avance automático de serie
- plantillas
- logo / colores / títulos / textos / datos de pago
- snapshot de diseño al emitir
- hash de documento emitido
- PDF
- organización de documentos por año/trimestre/mes/tienda/tipo/cliente

## Cajas
Probado:
- Hortimatic: Caja vape + Caja head
- NewOldSmok: Caja vape
- fórmula efectivo: caja final + salidas + gastos de caja - apertura
- permisos sobre cierre cerrado
- gerente puede corregir; encargado no puede modificar un cierre cerrado

## Gastos
- gastos fiscales y gastos internos separados
- horas extra y almacén pueden quedar en control interno
- gastos internos fuera de cálculo fiscal y paquete de gestoría
- IVA / recargo / retenciones / varias líneas
- histórico 2026 importado desde fuentes facilitadas

## Informes
- XLSX de gastos con estructura de gestoría
- XLSX de ingresos con estructura de gestoría
- libros diarios por tienda
- libro global Totus
- PDF fiscal
- ZIP de documentos
- paquete gestor ordenado:
  01_INGRESOS
  02_GASTOS
  03_DIARIOS
  04_RESUMEN
  05_DOCUMENTOS

## Datos / integridad
Consulta de integridad con resultado 0 incidencias en:
- líneas huérfanas
- totales cabecera/líneas desajustados
- cierres duplicados
- referencias de importación duplicadas
- documentos emitidos sin número
- facturas emitidas sin hash
- documentos emitidos sin snapshot
- series retrasadas respecto al último número
- rutas de documentos duplicadas
- hashes documentales duplicados

Las pruebas transaccionales de QA se ejecutan con ROLLBACK y no dejan datos de prueba.

## Storage
Probado en ambos buckets privados:
- subir
- descargar
- comparar bytes
- eliminar
- business-documents
- business-assets

## Navegador
GitHub Actions / Playwright:
- workflow: Totus Central QA
- resultado final saneado: SUCCESS (run 55)
- módulos recorridos: Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes, Administración
- cálculo Pricing con coma decimal y conservación de foco
- cálculo de caja
- controles de gasto interno
- factura/proforma/rectificativa
- PDF
- subida/descarga documental simulada
- fiscalidad
- XLSX / PDF / ZIP
- configuración
- responsive móvil

## Seguridad
RLS probado por roles:
- Admin
- Gerente
- Encargado

Supabase Security Advisor:
- 0 avisos de funciones SECURITY DEFINER expuestas tras mover la frontera privilegiada al esquema `private`.
- El único aviso restante es `Leaked Password Protection`.
- La organización está en plan Free y Supabase documenta esa protección como disponible únicamente en Pro o superior; no es corregible por SQL/código en el plan actual.

## Endurecimiento de permisos de facturación · 2026-10-06

Se detectó y corrigió una discrepancia real entre el modelo de roles y RLS:
- `encargado` mantiene lectura/consulta de facturas, rectificativas y proformas
- creación, edición, emisión, cobro, rectificación y conversión quedan en `admin` / `gerente`
- `ops_sales_invoices` INSERT/UPDATE: `private.is_manager()`
- `ops_sales_invoice_lines` INSERT/UPDATE/DELETE: `private.is_manager()`
- RPC internas de emitir, registrar documento externo y convertir proforma: `private.is_manager()`
- migración canónica: `migrations/2026-10-06_totus_central_management_hardening_v6.sql`

Pruebas:
- RLS real con Davinia / rol gerente: creación de borrador permitida dentro de transacción con ROLLBACK
- RLS real con Óscar / rol encargado: INSERT bloqueado por RLS
- UI encargado: Facturación en modo consulta, sin botones de creación/guardado
- GitHub Actions · Totus Central QA · run 55: SUCCESS
- Commit QA: `2feb390a56344d757c753a1e5837f4cabf055431`
- El commit posterior solo versiona la migración SQL y no modifica JS/CSS/tests.


## Cierre técnico adicional · 2026-10-06

Guardados financieros endurecidos:
- cierres guardados de forma atómica mediante `ops_save_closing`
- gastos + líneas guardados de forma atómica mediante `ops_save_expense`
- borradores de factura/proforma + líneas guardados de forma atómica mediante `ops_save_document_draft`
- si falla una línea, no queda una cabecera huérfana
- prueba forzada de error de FK en gasto: 0 residuos tras el fallo
- adjuntos validados antes de guardar: límite configurado y extensiones PDF/JPG/JPEG/PNG/WEBP/XLSX/XLS/CSV
- factura externa: el adjunto se procesa antes de emitir; si falla la subida queda en borrador y no se emite a medias

Seguridad y rutas de escritura:
- escrituras directas de cierres, detalle de cajas, gastos, líneas y clientes endurecidas
- la operativa diaria de encargado pasa por RPC atómicas controladas
- escritura directa por RLS para encargado: denegada
- encargado puede registrar cierre/gasto a través de la RPC prevista
- encargado no puede guardar ni emitir documentos de venta
- admin/gerente mantienen facturación completa

Coherencia de series:
- trigger `ops_validate_sales_document_series_tg`
- impide año de fecha distinto del año de serie
- impide serie de otra tienda
- impide serie de otro tipo de documento/factura
- caso inválido 2028 con serie 2026: bloqueado correctamente
- factura externa válida y proforma -> factura: probadas con transacción y ROLLBACK

QA navegador ampliada:
- GitHub Actions run 55: SUCCESS
- cálculo Pricing y normalización decimal
- guardado de cierre con dos cajas
- guardado de gasto con factura PDF adjunta
- guardado de proforma, emisión, numeración y PDF
- subida y descarga documental
- fiscalidad
- XLSX, PDF y paquete ZIP
- administración
- rol encargado en modo consulta
- responsive móvil

Integridad final de datos modernos:
- 0 líneas de gasto huérfanas
- 0 líneas de factura huérfanas
- 0 descuadres cabecera/líneas de gastos
- 0 descuadres cabecera/líneas de facturas
- 0 cierres modernos duplicados
- 0 cierres modernos fuera de fórmula
- 0 facturas emitidas sin número
- 0 facturas emitidas sin hash
- 0 series retrasadas
- 0 documentos con año de serie incorrecto
- 0 documentos con tienda de serie incorrecta

Histórico:
- existen 9 cierres importados con `legacy_cash_method=true` que no siguen la fórmula moderna.
- se conservan sin modificar porque representan el histórico original importado y están explícitamente marcados como legado.

Avisos Supabase:
- `Leaked Password Protection` sigue desactivado en Auth; requiere configuración del proyecto.
- el linter avisa de 7 RPC `SECURITY DEFINER`. Es intencionado: son las rutas atómicas públicas controladas internamente por `private.is_team_member()` / `private.is_manager()`, con `EXECUTE` revocado a `anon`.
- avisos de índices no usados son informativos con el volumen/uso actual; no se eliminan índices preventivamente sin carga real que lo justifique.

## Nota
La rama `main` sigue siendo la versión de producción anterior. No mezclar/promover esta rama hasta aprobación expresa.


## Limpieza estructural · 2026-10-06
- eliminadas sobrescrituras runtime `priorRender`, `priorGo`, `priorTab`, `baseManagement`
- 0 funciones duplicadas entre núcleo y módulo de Gestión
- eliminado `gestion-v6-ext.js`; sustituido por `gestion-v6-features.js`
- eliminados `gestion-v6-ext.css` y `facturacion-v7.css`; estilos consolidados en `gestion-v6.css`
- `gestion-v6.js` reducido aproximadamente de 84 KB a 42 KB al retirar implementaciones antiguas de facturación, fiscalidad, documentos e informes
- migraciones de endurecimiento fragmentadas sustituidas por una única migración canónica
- GitHub Actions ya no se ejecuta en cada commit
- informes contrastados de nuevo con los originales de gestoría y diarios 2026
- gastos nuevos exportan concepto + fila separada `IVA SOPORTADO (RECARGO - REAGYP)` cuando corresponde
- diarios recuperan formato `Día | Gastos | Precio | Tarjeta | Salida de caja`


## Cierre final · 2026-10-06
- QA final saneada: **SUCCESS**, GitHub Actions run 55.
- GitHub Actions queda en `workflow_dispatch` únicamente: no se ejecuta con cada commit y no genera una cadena de avisos por cambios intermedios.
- eliminado `.qa-trigger` temporal.
- fixtures de QA anonimizadas.
- descarga documental probada contra la llamada real a Supabase Storage en la simulación.
- informes de gestoría contrastados con los documentos originales facilitados:
  - gastos: columnas fiscales, fecha `DD/MM/AAAA`, fila separada de IVA/RE, total acumulado y desglose por conceptos;
  - ingresos: agrupación mensual por establecimiento, columnas equivalentes y total acumulado;
  - diarios: 12 hojas y estructura `Día | Gastos | Precio | Tarjeta | Salida de caja`.


## Revisión integral · 2026-10-07

Revisión pestaña por pestaña ampliada y saneada:
- **Gastos:** validación de factura/abono, importes pagados, bases, tipos fiscales y borrado controlado.
- **Facturación:** ficha maestra completa de clientes, validación de fechas, líneas, precios negativos y documentos externos.
- **Documentos:** vista previa dentro de Totus para PDF/imágenes, selección múltiple coherente y bloqueo de ZIP incompletos si falta algún archivo físico.
- **Fiscalidad:** registro de modelos 130/111/115/309 con importe real, estado y justificante enlazado al archivo documental.
- **Informes:** Excel con fórmulas reales, estilos, códigos contables, totales acumulados y estructura de gestoría; libro global ampliado con conciliación de cierres.
- **Configuración:** marca/logo concentrados en Facturación → Plantillas; guardado único de parámetros generales.
- **Responsive:** comprobación móvil de todos los módulos operativos, no solo Inicio.
- **Base de datos:** índices de claves foráneas versionados en `2026-10-07_management_fk_indexes_v12.sql`.

Validación final:
- GitHub Actions · **Totus Central QA · run 151: SUCCESS**
- Commit funcional probado: `29b544f4120313c1256f397d77daf636329c110c`
- Módulos recorridos: Pricing, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración.
- Integridad Supabase posterior: **0** líneas huérfanas de gastos/facturas, **0** cierres duplicados, **0** documentos emitidos rotos, **0** documentos sin ruta y **0** gastos sin importe contable.
- Security Advisor: queda el aviso conocido de protección de contraseñas filtradas y un aviso sobre la RPC de restauración de backup `ops_restore_backup_data`; esta RPC mantiene control interno de administrador y existe precisamente para la restauración completa. No se oculta el aviso.

El workflow vuelve a quedar en **ejecución manual** para no generar carreras/cancelaciones por cada commit. Producción `main` sigue sin tocarse.
