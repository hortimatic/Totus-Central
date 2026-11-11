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
La identidad técnica explícita de ChatGPT es `chatgpt@totuscentral.invalid` según el servicio; su sesión por `private.totus_agent_submit` respondió **«Cuenta propia de IA no activa»** el 11/11/2026. La cuenta `integration-3f6d…` utilizada antes se atribuyó erróneamente a ChatGPT y NO constituye su identidad verificada. No intercambiar identidades, ni elevar permisos. Un permiso PrestaShop válido tampoco concede acceso a las tablas SQL privadas de POSTPV.
