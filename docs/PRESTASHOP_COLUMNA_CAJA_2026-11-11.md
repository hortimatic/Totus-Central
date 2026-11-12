# PrestaShop · columna Caja (11/11/2026)

## Petición
Columna **Caja** opcional en Pedidos y ventas, compatible con selector, ordenación y vistas guardadas. No toca ventas, costes, vendedor, cierres ni facturación. Los nombres nuevos deben proceder del catálogo de la tienda, nunca estar escritos en código.

## Evidencia documentada de POSTPV, solo Hortimatic
Inspección del módulo instalado POS TPV 6.0 comunicada por un colaborador (11/11/2026). `posp_cajas.id_cajas` es una clave de **apertura**: aparecen distintos IDs y fechas para el mismo nombre. El catálogo de nombres debe indexarse por tienda + ID de apertura, no por un nombre único de terminal. `posp_tickets.id_order` está vinculado al pedido, **sin** campo de caja. `posp_devoluciones.id_cajas` vincula devoluciones a aperturas, pero no demuestra qué caja cobró el pedido original. `posp_movimientos.id_cajas` y `id_order` son BLOB sin codificación documentada; está prohibido inferir IDs con casts, horarios, empleados o importes. NewOldSmok aún no se ha inspeccionado.

El fabricante documenta **«Cajas en listado de pedidos en exportar»** desde versión 4.7.6: https://www.pos-tpv.com/es/content/7-changelog-lista-de-cambios-pos-prestashop . También documenta el cifrado de movimientos desde 4.1. Este listado/exportación nativa es una **fuente candidata de lectura**, NO una atribución verificada: confirmar en las versiones instaladas que la exportación incluye por fila ID inequívoco de pedido + ID de apertura de caja y nombre, su comportamiento con cobros mixtos, anulaciones y pagos múltiples, y que permite un acceso permitido sin instalar ningún puente.

## Contrato preparado (sin fuente conectada)
`cashBoxAttributionFromCatalogue(order,store,assignments,openings)` es una función pura, no una consulta. La fuente futura debe aportar vínculos **comprobados** `{store,order_id,drawer_id,verified:true}` y el catálogo de aperturas `{store,drawer_id,name}`, ambos con tienda explícita. La función exige un ID de apertura único por pedido, catálogo inequívoco y nombre válido; devuelve `null` si falta, discrepa, hay varias cajas o hay datos sin verificar. Repetir movimientos de una misma apertura no crea ambigüedad; distintos IDs sí, aun con el mismo nombre.

`verifiedOrderCashBoxName` solo muestra un objeto de atribución ya validado. **La API estándar de PrestaShop no suministra esa atribución y el módulo todavía no dispone de un adaptador de lectura verificado.** No fusionar el PR como funcional hasta comprobar y conectar una fuente real compatible con las dos tiendas y su crecimiento.

## Pruebas
QA de navegador y pruebas puras con datos **ficticios** para columna configurable, tiendas separadas, futuras cajas, ventas online sin caja, fuentes no verificadas, duplicados y ambigüedades. Ninguna de estas pruebas sustituye el contraste de pedidos reales de ambas tiendas.

## Identidad y permisos
El alias técnico `chatgpt@totuscentral.invalid` está inactivo. La cuenta manual llamada ChatGPT es otra identidad: resolverla desde Administración y verificarla con `totus_agent_submit` antes de trabajar; no confundir el rechazo del alias antiguo con una ausencia de acceso de todas las cuentas ChatGPT. La cuenta `integration-3f6d…` utilizada antes se atribuyó erróneamente a ChatGPT y NO constituye su identidad verificada. No intercambiar identidades, ni elevar permisos. Un permiso PrestaShop válido tampoco concede acceso a las tablas SQL privadas de POSTPV.

## Contraste añadido por Codex, 12/11/2026

Se ha leído el historial nativo de NewOldSmok (`AdminTPVCaja`), sin escrituras. Cada contenedor `cajas_<id>_contenedor` identifica una sesión de caja y tiene un nombre visible. La tabla ofrece ID de movimiento, forma de pago, concepto, descripción con ID y referencia de pedido, importe, empleado y fecha. Esto acredita una relación real dentro del historial; no es una inferencia por horario ni vendedor.

El CSV de una sesión obtenido mediante su botón nativo contiene todas sus 20 filas aunque la página muestre 17. Sus cabeceras son `ID`, `Forma de pago`, `Concepto`, `Descripción`, `Cantidad`, `Empleado`, `Fecha`. **Ese CSV por sesión no contiene ni ID ni nombre de caja**: necesita el contexto de sesión y tienda de donde se descargó. No importar un CSV suelto atribuyéndole una caja por su nombre de archivo. Tampoco concluir que una exportación acredita ventas futuras.

El JavaScript nativo `tpvtiendaCaja.js` utiliza el recurso existente `modules/tpvtienda/classes/actions/actionsCaja.php` con las acciones de lectura `getCajas` y `getMovimientosByCaja`. Son llamadas internas del backoffice, no recursos registrados del Webservice de PrestaShop. Después de autorización puntual expresa de Diego se probó una lectura de movimientos de NewOldSmok por HTTP fuera del navegador: respondió HTTP 200, `text/html`, cuerpo **`ERROR TOKEN`**. No se guardó la credencial ni se cambiaron datos. Esto prueba que el token de la URL de administración usado en esa prueba no basta para ese acceso; no identifica por sí solo el mecanismo adicional exigido ni autoriza copiar cookies, leer secretos o probar otros tokens.

### Pendiente real

Una segunda prueba, también autorizada expresamente por Diego, utilizó la credencial del enlace nativo «TPV Tienda» de la misma sesión de NewOldSmok para la misma acción y apertura. Respondió igualmente HTTP 200 con `ERROR TOKEN`. Se detuvieron las pruebas de credenciales: no se han copiado cookies, automatizado inicios de sesión ni almacenado tokens administrativos. Las dos pruebas no demuestran que exista o no una API de servicio del fabricante; demuestran que esas credenciales visibles de navegación no bastan en las solicitudes ensayadas.

Para completar el PR con actualización automática falta una vía de autenticación de servicio documentada y autorizada para esas dos acciones nativas, o un recurso oficial equivalente. La API de productos ya conectada no acredita ese acceso. Debe contrastarse también Hortimatic con su propia fuente y, por tienda, un pedido cobrado, cobro mixto y pedido online. No publicar esta preparación como una integración completa ni instalar módulos, persistir sesiones humanas o modificar las tiendas para sortear la falta de acceso.
