# Auditoría integral en curso — 26/10/2026

Este documento recoge un tramo verificable de la revisión. **No certifica que la auditoría completa haya terminado.** La rama de trabajo no debe sustituir producción mientras haya defectos de integridad pendientes.

## Defectos reproducidos y correcciones preparadas

1. **Respuesta perdida después de guardar un adjunto.** El servidor podía confirmar el cambio y el cliente interpretar la falta de respuesta como rechazo, eliminando el documento asociado. Se conservan los códigos del servicio, se comprueba por lectura el resultado de INSERT/UPDATE y se evita limpiar archivos cuando el resultado es incierto. La prueba reproduce un UPDATE confirmado cuya respuesta se pierde; comprueba documento, archivo y ausencia de gasto duplicado.
2. **Dos clics durante una escritura lenta.** Duplicar una plantilla podía iniciar dos altas. La exclusión de escrituras incluye las acciones antes omitidas, se vuelve a comprobar tras los diálogos asíncronos y solo libera el bloqueo su propietario. Se prueba también que dos duplicaciones intencionadas sucesivas siguen funcionando y que no cambian las plantillas predeterminadas.
3. **Numeración superior al ancho configurado.** Con cuatro cifras y número 10000, `lpad` producía una etiqueta terminada en 1000. El ancho pasa a ser un mínimo. No se renumera ninguna factura existente.
4. **Cadena de comprobación bajo emisión simultánea.** La fecha de comienzo de transacción podía ordenar las emisiones de forma distinta a sus números. La selección del anterior pasa a ordenar por número dentro de la serie, manteniendo su bloqueo transaccional. La prueba usa tres facturas ficticias y dos sesiones coordinadas con orden de comienzo invertido.
5. **Ficha antigua frente a cambios de otra sesión.** Los guardados de gastos/cajas/facturación admiten una versión esperada opcional, comprobada bajo bloqueo después de verificar permisos. El navegador conserva la versión de la ficha renderizada, aunque una lectura en segundo plano actualice el estado general. Se verifica rechazo de ficha antigua, conservación de sus campos, navegación cancelada y guardado después de revisar una ficha nueva.

Los parches SQL revisables están en `supabase/review_patches/005_invoice_sequence_integrity.sql` y `006_stale_business_forms.sql`. Deben revisarse y aplicarse mediante el procedimiento de cambios de base de datos antes de publicar una versión que dependa de ellos. El primero comprueba la implementación previa y conserva los permisos existentes. El segundo no amplía permisos de usuarios y deja compatible el JSON de integraciones anteriores. El código nuevo se ha ensayado en PostgreSQL desechable; no se ha restaurado ni alterado contabilidad real para estas pruebas.

## Alcance real de las pruebas

- La primera pasada ejecutó 56 programas de navegador: 55 correctos y uno sin su archivo de preparación. Después de generar esa preparación, el programa restante pasó. Ese fallo inicial fue de preparación de la ejecución, no un defecto del producto.
- Los 87 programas de cálculos, formatos, archivos y contratos de la pasada inicial terminaron correctamente.
- Las nuevas pruebas se añaden a la batería y deben repetirse junto a las regresiones afectadas antes de integrar cambios.
- El nuevo recorrido de directorios de Pricing comprueba marcas, familias, márgenes con coma decimal, proveedores, costes con descuento/envío, competencia y borrados protegidos por referencias.
- Las pruebas SQL privadas utilizan funciones, restricciones y políticas reales con identidades y datos ficticios. Sus metadatos y fixture se conservan fuera del repositorio público. No deben subirse mediante una inclusión indiscriminada de la carpeta de auditoría.
- Se distingue entre una acción observada, una afirmación comprobada y una prueba con datos reales. Un contador de programas correctos no acredita por sí solo todos los resultados posibles.

## Trabajo pendiente antes del cierre integral

1. Completar el protocolo de reintentos de RPC y subidas cuando se pierde una respuesta. La protección de limpieza incierta evita destruir el original, pero no demuestra todavía idempotencia de todas las altas.
2. Resolver la retirada documental completa frente a vínculos concurrentes y fallos de limpieza. Las FK `ON DELETE SET NULL` no equivalen a una protección contra borrar un documento asociado. No invertir pasos sin tener en cuenta la cola de archivo y el mapa de OneDrive.
3. Completar la matriz por acción/configuración, revisando las afirmaciones de cada recorrido y no solo sus pulsaciones. Comprobar los recorridos que queden sin evidencia.
4. Terminar la comprobación de recuperación aislada, de los componentes de copia y de la versión real publicada. Nunca restaurar sobre producción como parte de una simulación.
5. Consolidar informe, código y manuales en las ubicaciones autorizadas; comprobar lo entregado y retirar los recursos temporales de auditoría.

Mientras estos puntos sigan abiertos, no etiquetar la herramienta como «100 % revisada» ni presentar una simulación como prueba de una operación real no ejecutada.
