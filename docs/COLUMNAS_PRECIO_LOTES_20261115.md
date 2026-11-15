# Columnas comunes, Precio conectado y ofertas por lote

Esta revisión parte del código publicado `f0b9011a1b1e12c6ff1c2063ceed36a8ee20bf7b`. Consultar el commit servido en build-info.json y el resultado de publicación antes de dar por desplegados estos cambios.

## Columnas

`src/column-settings.js` genera la fila común de selección y posición. Productos, pedidos PrestaShop, directorios, Inicio y tablas generales comparten geometría, casillas, etiquetas y controles. Las hojas de estilo antiguas de esas filas se retiran; no se cambia el dato comercial ni el permiso de edición.

- Productos y pedidos conservan sus vistas personales, perfiles del equipo y persistencia existente. Pedidos conserva abierto el panel y la búsqueda después de ajustar una columna.
- Directorios conserva el guardado en la cuenta y sus perfiles del equipo. Ofrece guardado explícito y muestra el resultado o error del servidor.
- Inicio conserva las columnas en la distribución del tablero de la cuenta. «Guardar distribución» utiliza el mismo guardado y verificación de «Guardar cambios»; no descarta las demás ediciones pendientes del tablero.
- Las tablas generales conservan el identificador anterior por cuenta, módulo y cabeceras. Añaden vistas personales con nombre y guardado explícito, **en ese navegador**. No se anuncia sincronización entre dispositivos para estos controles.
- Los controles de presentación llevan `data-draft-ignore`: no deben provocar un aviso de cambios contables sin guardar. No se manipulan tablas de líneas editables de formularios ni su contrato de columnas.

## Precio conectado

Precio abre el catálogo PrestaShop por defecto. Se filtra por tienda, marca y categoría, se seleccionan los productos y se usa «Ajustar precios seleccionados». Puede fijarse un precio base sin IVA o variar ese precio por porcentaje. El lote muestra valores anteriores y nuevos, valida antes de escribir y guarda/relee cada producto con su solicitud estable. Conserva impactos de combinaciones y ofertas; no afirma igualar todos los PVP finales de las variantes.

Los estudios de Totus se mantienen en una pestaña secundaria con sus referencias de marcas, familias y proveedores. Son simulaciones locales de costes; no se presentan como precios publicados en una tienda. Las acciones de alta/edición de un estudio seleccionan expresamente ese contexto.

## Ofertas de una familia

Filtrar la familia, seleccionar sus productos y usar «Aplicar ofertas seleccionadas». Comprobar el número seleccionado: la casilla de cabecera selecciona la página; el control de selección de resultados del catálogo permite ampliar la selección. Los lotes de precio y oferta admiten hasta 200 productos por revisión; no se envían selecciones mayores silenciosamente.

El formulario solicita descuento porcentual, cantidad mínima y fechas opcionales en el horario de la tienda. Usa un precio específico nativo con `price=-1`, descuento fraccionario y aplicación a todas las combinaciones. Conserva el precio base. Comprueba previamente las ofertas del producto y no sustituye ofertas cuyo periodo se solape. Se puede ajustar un periodo posterior o revisar la oferta existente en la ficha; no se borran condiciones particulares automáticamente.

La publicación utiliza `prestashop_product_step_prepare/commit` ya instalados, con `existing_product=true`, padre y etapa estables, huella revisada y confirmación. Guarda el intento en el borrador de la cuenta **antes** de escribir. Una respuesta incierta detiene el lote; «Retomar ofertas pendientes» y «Comprobar y continuar» reutilizan la solicitud anterior. Cada oferta completada debe devolver persisted y verified, además del ID nativo. Un lote entre tiendas no es una transacción indivisible: se conservan las completadas y se informa de la pendiente. El resultado se incorpora al historial de operaciones de Totus.

No se añaden módulos, servicios, cron, réplica de catálogo ni consumo de IA. Las fechas de oferta las aplica PrestaShop. No se modifican precios ni ofertas reales durante los ensayos ficticios.

## Inicio y verificación

La tarjeta de ganancia estimada conserva el total y muestra la cifra de cada tienda, con su cobertura o estado pendiente. Reutiliza los datos del cálculo; no añade consultas. El resultado sigue siendo ingresos con IVA menos coste de compra con IVA y recargo, separado del resultado contable y del margen comercial sin impuestos.

Las pruebas de Playwright distinguen navegación, vistas guardadas, estados de error y escrituras simuladas. Incluyen recarga/cambio de cuenta, familias, publicación de precios, ofertas, recuperación tras perder una respuesta y reapertura del borrador, permisos y tamaños de pantalla. CI ejecuta los nuevos recorridos junto con los existentes. Una prueba simulada no acredita una escritura real en las tiendas del usuario.
