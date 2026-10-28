# Auditoría de Gastos · 28/10/2026

## Alcance y conservación

Se revisan Registros de gastos, Facturas y justificantes, Proveedores y la ficha
de cada gasto: conceptos, impuestos, pago, control interno, color de los diarios,
adjuntos, revisión, permisos y descargas. Se conserva la organización existente.
Las mejoras previas de ChatGPT se revisan en el historial y se mantienen; no se
revierte el circuito de cuenta propia, el cotejo documental ni el desglose fiscal.
Hostinger permanece pendiente de aclaración fiscal por indicación del titular.

## Incidencias reproducidas y correcciones

1. La descarga no respetaba «Pagos del Excel» y la búsqueda por Vaperalia podía
   seleccionar datos distintos de la pantalla. Una selección compartida elimina
   esa divergencia; se mantienen fecha, tienda, pago, tipo y filtro de adjuntos.
2. Los impuestos pagados podían aparecer en una descarga que solo pedía gastos
   fiscales, pagos del Excel o facturas. Se exportan en su hoja informativa solo
   cuando ese ámbito corresponde al listado de registros seleccionado.
3. Una factura común al autónomo podía atribuirse a una tienda al filtrar sus
   justificantes, tomando la tienda del archivo. Ahora prevalece el gasto.
4. Un importe mal escrito se mostraba como cero en el resumen. Se pide revisar
   importes, conservando el bloqueo al guardar. Una base sin completar tampoco
   se guarda como cero; el cero explícito sigue siendo válido.
5. La ficha admitía un pago parcial sin fecha, a diferencia de Registrar pago.
   La fecha se exige en ambos recorridos. El servidor recibe la misma protección.
6. Elegir proveedor ignoraba el tipo de documento guardado y podía conservar el
   NIF de otro proveedor cuando el nuevo no tenía NIF. Se aplican los valores de
   proveedor a nuevas fichas, sin sustituir el tipo de una factura existente.
   Se permite Control interno como valor de proveedor y se validan porcentajes.
7. Elegir una categoría interna no actualizaba inmediatamente todos los controles
   fiscales. Se usa el mismo tratamiento que al elegir Control interno.
8. Las cabeceras desbordaban en anchos intermedios, aunque en móvil estrecho no
   ocurría. Los controles se distribuyen dentro de su propio bloque.
9. PDF.js requería un método de Map ausente en navegadores anteriores. Un adaptador
   de compatibilidad carga solo cuando es necesario; no modifica el paquete del
   proveedor y mantiene intacto el método nativo cuando existe. Se verifica que
   las páginas se dibujan y que se pueden recorrer, no solo que existe el visor.
10. Guardar solo el color podía dejar antigua la versión de la ficha, impidiendo
    guardar después otros cambios propios. Se avanza la versión únicamente si
    ningún otro campo del servidor ha cambiado. Si hubo cambios concurrentes,
    se mantiene el rechazo de la ficha antigua.
11. Guardar solo el adjunto podía descartar otros cambios sin avisar. Ahora, si
    los hay, explica qué se guardará y permite cancelar conservando campos y archivo.
12. Un apunte bancario expresamente vinculado a una factura podía bloquear su
    edición como si fuera otra factura duplicada. Se exceptúa únicamente el
    apunte interno que acredita el vínculo a esa misma factura. Crear una factura
    realmente duplicada continúa rechazándose en pantalla y servidor.

## Seguridad y datos

El parche 021 mantiene el RPC existente y añade validaciones: base explícita,
importes finitos, porcentajes de 0–100 y fecha del pago parcial. No modifica
tablas, estructura de copias, datos históricos, funciones de cálculo ni permisos.
Se preservan autorización, reintentos idempotentes, bloqueo de mantenimiento,
protección frente a fichas antiguas y auditoría. Su aplicación se comprueba en
PostgreSQL aislado, incluyendo repetición y rechazo sin autorización.

Las operaciones de escritura y eliminación se ensayan con datos ficticios. La
comprobación de producción es de lectura y navegación; no se registran gastos
ficticios ni se cambian revisiones fiscales reales para obtener una prueba verde.

## Matriz de aceptación

| Zona | Comprobación |
|---|---|
| Registros | Filtros, indicadores, gastos fiscales, internos, pagos del Excel e impuestos sin duplicar coste |
| Ficha | Alta y edición, varias líneas, céntimos, retención, abonos, pago pendiente/parcial/completo, fechas, duplicados y bases explícitas |
| Fiscalidad | Gasto sin revisar excluido; revisión expresa incluida; internos e impuestos excluidos; retenciones 111/115 conservadas |
| Justificantes | Subida, sustitución, guardar solo adjunto, vista previa, descarga, desvinculación, original conservado y errores de transporte |
| Proveedores | Alta/edición, NIF, valores por defecto, porcentajes, activos/inactivos, búsqueda y referencias existentes |
| Excel | Filas coincidentes con filtros, colores, importes, selección fiscal/interna y hoja informativa correcta |
| Concurrencia | Cambios reales protegidos; guardar solo color no invalida por sí mismo la ficha; cambios ajenos no se aceptan silenciosamente |
| Presentación | Tres pestañas a 17 anchuras de 320 a 2560 px, ficha en móvil/tableta/escritorio y PDF con contenido dibujado |
| Conexiones | Circuito de cuenta propia de ChatGPT y adjuntos cubierto por sus pruebas específicas existentes |

La batería ampliada está en `tests/expense-integral-browser-qa.mjs` e integrada
en GitHub Actions. Se ejecutan también las pruebas existentes de redondeo,
abonos, colores, impuestos, adjuntos, reintentos, concurrencia, permisos y visor.
Los resultados de revisión y publicación, y la comprobación de sesión real,
se incorporan al acta privada de cierre. La existencia de pruebas no se presenta
como ejecución aprobada: el cierre exige que sus resultados sean correctos.

## Continuidad para ChatGPT

Usar el circuito documentado de cuenta propia y las funciones de Gastos; no SQL
directo para eludir validaciones. Distinguir cotejo documental de aprobación
fiscal. No marcar revisión fiscal si falta información. Adjuntar un justificante
no cambia importes ni convierte un pago en gasto fiscal. Los pagos importados
vinculados no deben contabilizarse dos veces. Conservar originales y trazabilidad.
Para revisar permisos, conexión o uso del agente, consultar los manuales vigentes
de conexión y gastos del repositorio antes de cambiar ningún permiso.

«100 % de comprobaciones de aceptación superadas» se limita a esta matriz y a la
versión cuya ejecución se documente; no promete ausencia universal de fallos.
