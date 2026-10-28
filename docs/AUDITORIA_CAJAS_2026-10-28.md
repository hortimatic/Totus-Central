# Auditoría de Cajas — 28/10/2026

## Alcance y protección de los datos

Revisión del listado, filtros, indicadores, detalle, creación, borrador, cierre,
reapertura, conciliación de importados, Excel y conservación de las aperturas por
caja. Se conserva la estructura de la herramienta y la contabilidad existente.
Las escrituras de ensayo utilizan datos ficticios en simulación y una base
PostgreSQL desechable. No se crean cierres de prueba en producción.

## Defectos reproducidos y correcciones

1. Un efectivo final pendiente se convertía en cero al guardar y reabrir un
   borrador. Se conserva la diferencia entre desconocido y cero confirmado,
   tanto en el formulario como en el listado y Excel. El borrador incompleto
   no presenta un total de ventas terminado. No se añade una columna nueva a
   la base: se usa una propiedad estructurada en la referencia del registro.
2. La comprobación conjunta permitía compensar ventas en efectivo negativas
   de una caja con el saldo positivo de otra. Se comprueba cada caja antes de
   aceptar el cierre, en la interfaz y en el servidor. Deben incluirse todas
   las cajas activas de la tienda.
3. Un texto o importe incompleto podía dejar una cifra aparentemente válida en
   el resumen. Ahora muestra el problema y recupera el cálculo al corregirlo.
4. Cambiar la tienda de un borrador guardado conservaba las cajas anteriores.
   Se solicitan descartar los cambios pendientes y se cargan las cajas de la
   tienda elegida, manteniendo la protección frente a cambios simultáneos.
5. Excel mostraba «cerrado» mientras la pantalla decía «Conciliado y aceptado».
   Ambas representaciones usan el mismo criterio. Los totales de las celdas y
   su valor calculado coinciden; los datos pendientes permanecen en blanco.
6. Al recuperar varios turnos de una misma caja, el editor tomaba el primer
   saldo final. Conserva ahora la primera apertura y el último efectivo final,
   igual que el listado y la siguiente apertura.
7. El servidor comparaba la fecha con el día UTC. Utiliza el calendario de
   España, para no rechazar la jornada actual después de medianoche.

El parche conserva autorización, protección de periodos cerrados, solicitudes
idempotentes, bloqueo de fichas antiguas, auditoría y selección fiscal existente.
No cambia importes históricos ni convierte referencias mensuales en ingresos
duplicados. La evidencia original se conserva.

## Verificaciones reproducibles

- `tests/closing-integral-browser-qa.mjs`: borradores parciales, errores de
  lectura, cambio de tienda, estados exportados, movimientos de ambas cajas,
  reapertura sin duplicar ingresos, aperturas independientes, Excel y tamaños
  entre 320 y 2560 píxeles.
- `tests/closing-readings-qa.mjs`: cero frente a desconocido, decimales, estados
  y primera apertura/último cierre en capturas con varios turnos.
- `tests/closing-db-fixture.sql` y `tests/closing-db-qa.sql`: base aislada,
  permisos, incompletos, caja omitida, tienda equivocada, caja duplicada,
  descuadres, importes no finitos, fecha futura, conservación del origen y
  selección fiscal. Todas las operaciones de ensayo se revierten.
- Se mantienen las pruebas existentes de cierre/reapertura, histórico,
  conciliación de origen, retiradas, desglose de ingresos, borradores y Excel.
- La publicación exige además toda la batería común del repositorio.

## Cómo usarlo

Completa cada caja por separado: dinero con el que empezó, dinero que dejas,
tarjeta y movimientos del día. «Guardar para terminar después» conserva un
borrador; no entra en los ingresos fiscales. «Cerrar las cajas» comprueba los
datos y el total anotado. «Reabrir cierre» permite corregir un cierre manual;
volver a cerrarlo actualiza el mismo registro, no añade otro. Las referencias
históricas cubiertas por un resumen mensual conservan su criterio fiscal.

## Límites de la comprobación

Las pruebas de pantalla automatizadas utilizan la misma aplicación con un
servidor simulado y datos ficticios. Las pruebas SQL ejecutan el procedimiento
en PostgreSQL aislado; las comprobaciones de producción son de solo lectura.
Esto no equivale a haber creado y borrado contabilidad real desde vuestra
sesión. No se garantiza ausencia universal de fallos ni compatibilidad con
todos los navegadores, tamaños o futuras modificaciones. Los resultados de
CI y de publicación quedan vinculados al cambio de GitHub.

La revisión se limita a Cajas y sus efectos asociados. El siguiente módulo
requiere la autorización del usuario, según el procedimiento acordado.
