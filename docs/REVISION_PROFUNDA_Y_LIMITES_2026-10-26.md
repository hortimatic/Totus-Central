# Revisión profunda y corrección del método — 26/10/2026

## Autocrítica concreta

Las pruebas anteriores no justificaban hablar de funcionamiento completo. La existencia de un manejador para un botón no demuestra que produzca el resultado correcto; una captura sin desbordamiento no demuestra que guardar conserve las relaciones. El editor de plantillas expuso esa diferencia. Un recuento grande de pruebas no elimina los huecos de cobertura.

## Casos adicionales encontrados sin que el usuario los señalase

1. Al editar un gasto común al autónomo, `null` se interpretaba como falta de valor y se preseleccionaba la primera tienda. Guardar una observación podía cambiar la asignación. Además, el servidor y el formulario exigían tienda aunque ofreciesen la opción común. Se conserva la selección vacía y se ajusta exclusivamente esa validación. La columna ya admite `NULL`; no se cambia su estructura. La consulta real encontró cero gastos comunes, por lo que es un fallo de una opción disponible, no evidencia de gastos comunes actuales mal asignados.
2. Tiendas, proveedores, categorías, clientes, series y plantillas desactivados desaparecían de algunos selectores de edición. Se conservan las referencias ya utilizadas; los registros nuevos siguen ofreciendo solo opciones activas. También se revisan proveedores de Pricing y ajustes fiscales.
3. Los nombres y detalles de cajas históricas podían desaparecer al desactivar la tienda o caja. Se consultan los registros históricos aunque sus entidades estén inactivas. Para editar un cierre con caja desactivada se explica que hay que reactivarla: la función del servidor exige cajas activas. No se eliminan sus importes ni se modifica esa protección.
4. Los paquetes anuales y del periodo omitían los diarios de tiendas inactivas. Se mantienen sus diarios en ambas descargas y en la selección de informes.
5. Duplicar desde una plantilla con cambios pendientes cerraba el formulario sin aplicar la protección de borradores. Se pide decidir qué hacer con esos cambios; cancelar conserva el formulario y no crea la copia.

## Evidencia exigida

`reference-options-qa`: conservación de referencias, gasto común, factura con referencias inactivas y caja histórica. `deep-editing-browser-qa`: editar, guardar y releer un gasto común con proveedor/categoría inactivos; cancelar y aceptar la duplicación; guardar plantilla y serie conservando su tienda. `annual-package-browser-qa`: inspección de los ZIP anual y mensual con una tienda inactiva y sus originales.

`common-expense-db-qa.sql` comprueba en PostgreSQL desechable el guardado común, su edición, el rechazo de duplicados/proveedor vacío, el historial y que no se amplíe el acceso anónimo. Usa conceptos de importe cero para aislar ámbito y validaciones; no acredita por sí sola la aritmética fiscal.

Las pruebas usan datos ficticios y adaptadores aislados. Esta revisión no crea registros contables en producción ni cambia permisos o tablas. El único ajuste del servidor sustituye la exigencia de tienda en la función existente, conservando su cuerpo restante y permisos, y rechaza aplicar el parche si la definición esperada ha cambiado.

## Regla para futuras auditorías

Para cada operación se debe identificar: entrada, permisos, validación, persistencia, reapertura y efecto en documentos/exportaciones/historial. Variar estados: nuevo/existente, activo/inactivo, común/tienda, borrador/emitido/cerrado, con/sin documento, cancelar/error/reintento. Una operación solo se marca comprobada cuando hay una prueba de su resultado; una lectura de código se marca como lectura, y una captura como comprobación visual. Registrar los casos no ejecutados y sus motivos.

No afirmar una cobertura exhaustiva de todas las combinaciones ni «100 % sin fallos». Los recorridos cubiertos y sus límites deben acompañar a cada entrega. Restauración real, concurrencia entre dispositivos y fallos externos prolongados requieren sus pruebas aisladas específicas; no se dan por acreditados solo por esta revisión de edición.
