# Columnas comunes, Precio conectado y ofertas por lote

Esta revisión parte del código publicado `f0b9011a1b1e12c6ff1c2063ceed36a8ee20bf7b`. Consultar el commit servido en build-info.json y el resultado de publicación antes de dar por desplegados estos cambios.

## Columnas

`src/column-settings.js` genera la fila común de selección y posición. Productos, pedidos PrestaShop, directorios, Inicio y tablas generales comparten geometría, casillas, etiquetas y controles. Las hojas de estilo antiguas de esas filas se retiran; no se cambia el dato comercial ni el permiso de edición.

- Productos y pedidos conservan sus vistas personales, perfiles del equipo y persistencia existente. Pedidos conserva abierto el panel y la búsqueda después de ajustar una columna.
- Directorios conserva el guardado en la cuenta y sus perfiles del equipo dentro de Columnas. Se retira el botón exterior «Vistas» de Clientes, Proveedores y Marcas. Ofrece guardado explícito y muestra el resultado o error del servidor.
- Inicio conserva las columnas en la distribución del tablero de la cuenta. «Guardar distribución» utiliza el mismo guardado y verificación de «Guardar cambios»; no descarta las demás ediciones pendientes del tablero.
- Las tablas generales conservan el identificador anterior por cuenta, módulo y cabeceras. Añaden vistas personales con nombre y guardado explícito, **en ese navegador**. No se anuncia sincronización entre dispositivos para estos controles.
- Los controles de presentación llevan `data-draft-ignore`: no deben provocar un aviso de cambios contables sin guardar. No se manipulan tablas de líneas editables de formularios ni su contrato de columnas.
- Las tablas dentro de una factura renderizada o de `data-tc-static-table` conservan el documento sin herramientas de interfaz añadidas. El barrido de emergentes detectó que insertar un panel de columnas en la vista previa escalada de una plantilla producía controles desplazados en móvil y tableta; se excluye ese documento, manteniendo los controles de las tablas de trabajo.

## Precio conectado

Precio abre el catálogo PrestaShop por defecto. Se filtra por tienda, marca y categoría, se seleccionan los productos y se usa «Ajustar precios seleccionados». Puede fijarse un precio base sin IVA o variar ese precio por porcentaje. El lote muestra valores anteriores y nuevos, valida antes de escribir y guarda/relee cada producto con su solicitud estable. Conserva impactos de combinaciones y ofertas; no afirma igualar todos los PVP finales de las variantes.

Los estudios de Totus se mantienen en una pestaña secundaria con sus referencias de marcas, familias y proveedores. Son simulaciones locales de costes; no se presentan como precios publicados en una tienda. Las acciones de alta/edición de un estudio seleccionan expresamente ese contexto.

## Ofertas de una familia

Filtrar la familia, seleccionar sus productos y usar «Aplicar ofertas seleccionadas». Comprobar el número seleccionado: la casilla de cabecera selecciona la página; el control de selección de resultados del catálogo permite ampliar la selección. Los lotes de precio y oferta admiten hasta 200 productos por revisión; no se envían selecciones mayores silenciosamente.

El formulario solicita descuento porcentual, cantidad mínima y fechas opcionales en el horario de la tienda. Usa un precio específico nativo con `price=-1`, descuento fraccionario y aplicación a todas las combinaciones. Conserva el precio base. Comprueba previamente las ofertas del producto y no sustituye ofertas cuyo periodo se solape. Se puede ajustar un periodo posterior o revisar la oferta existente en la ficha; no se borran condiciones particulares automáticamente.

La publicación utiliza `prestashop_product_step_prepare/commit` ya instalados, con `existing_product=true`, padre y etapa estables, huella revisada y confirmación. Guarda el intento en el borrador de la cuenta **antes** de escribir. Una respuesta incierta detiene el lote; «Retomar ofertas pendientes» y «Comprobar y continuar» reutilizan la solicitud anterior. Cada oferta completada debe devolver persisted y verified, además del ID nativo. Un lote entre tiendas no es una transacción indivisible: se conservan las completadas y se informa de la pendiente. El resultado se incorpora al historial de operaciones de Totus.

No se añaden módulos, servicios, cron, réplica de catálogo ni consumo de IA. Las fechas de oferta las aplica PrestaShop. No se modifican precios ni ofertas reales durante los ensayos ficticios.

## Gestión desde Totus y destino de las escrituras

El criterio de producto es gestionar desde Totus y utilizar PrestaShop para vender en la web. Las altas y modificaciones nativas de productos, combinaciones, atributos, marcas, proveedores, clientes, precios, ofertas y stock deben dirigirse a la tienda seleccionada. No basta con guardar un borrador de Totus: la confirmación exige respuesta persistida y relectura verificada de la API oficial. Mantener permisos, identificadores de solicitud y recuperación ante una respuesta incierta. No trasladar IDs entre tiendas ni anunciar éxito parcial como publicación completa.

Esta regla no convierte los estudios de precios, tareas o registros contables locales en recursos de PrestaShop. Tampoco acredita que cada operación imaginable esté implementada: si la API instalada no permite alguna, debe mostrarse la limitación; no instalar módulos, modificar el núcleo ni simular sincronización para ocultarla.

Los errores de publicación del formulario de directorios se muestran encima de los campos y se desplazan a la vista al fallar. Las pruebas cubren altas completas de marca y proveedor en ambas tiendas, destino, error visible, solicitud estable al reintentar y confirmación verificada. CI comprueba además POST/PUT/DELETE nativos en un PrestaShop desechable, incluyendo descripción y SEO.

Se reprodujo en producción el bloqueo anterior a cualquier POST de directorio: `totus_directory_operation` es SECURITY INVOKER y su comprobación del registro de tiendas fallaba con `permission denied for table totus_websites`. El servidor tenía permiso de lectura de los metadatos de conexión anteriores, pero no de las columnas `connection_id,status` del registro añadido después. La migración `20261115084252_directory_journal_website_metadata.sql` concede únicamente esas dos columnas a `service_role`; conserva SECURITY INVOKER y no concede acceso a navegadores, secretos ni al resto de columnas. El ensayo SQL desechable reproduce primero el rechazo y ejecuta después los recorridos de alta, reintento y edición con la misma comprobación de registro que producción. Contrastar su aplicación y una consulta posterior con el rol del servidor antes de dar el bloqueo por corregido. No crear la marca ficticia «cocus» para verificarlo sin una instrucción expresa sobre sus datos.

## Automatizaciones y navegación de Ventas

«Configurar campana» llama al controlador de cabecera y abre directamente la configuración. Se detiene la propagación del clic de origen: antes ese mismo clic llegaba al cierre exterior y ocultaba inmediatamente el panel. Las pruebas usan el botón real desde Automatizaciones, guardan el intervalo y vuelven a abrirlo. Se mantienen el cierre exterior normal, Escape y los permisos de administración.

«Comprobar ahora» solicita al planificador una ejecución; no acredita una comprobación terminada. La regla muestra pendiente, en curso, completada, parcial o fallida a partir de un trabajo identificado. Consulta su resultado mientras la pantalla está abierta, durante un máximo de 90 segundos; después conserva el estado pendiente y puede actualizarse el registro. No repite la solicitud para refrescar el resultado, no consume modelos y cancela el seguimiento al salir. Un resultado parcial no se muestra como éxito completo. Cambiar de cuenta limpia ese seguimiento.

La vista previa de gastos recurrentes acepta su contrato `rows`; antes se rechazaba al exigir por error las propiedades del registro de automatizaciones. Se elimina la opción duplicada de EAN del selector y se invalida una vista previa cuando cambia su configuración. Las pruebas recorren todas las consultas disponibles, los orígenes web frente a TPV, la ausencia de envíos en vista previa, errores de lectura y guardado, conservación del borrador y el historial. No se envían mensajes reales para ensayar.

Ventas conserva un único control de página. Se retiran sus botones redundantes Anterior/Siguiente; las flechas para columnas horizontales se conservan. El campo de página admite escritura y Enter, valida y limita el número, evita cambios accidentales por las flechas del control numérico y recupera el foco después de cargar una página remota. Volver a una página ya consultada no repite la petición. Se comprueban los límites, entrada vacía, foco y desplazamiento en móvil y escritorio.

Gastos retira el acceso de cabecera «Proveedores». Su gestión permanece en el módulo Proveedores y el selector del formulario de gasto conserva los datos guardados. Los recorridos de alta, modificación, inactivación y protección de referencias se prueban entrando por el menú del módulo.

## Inicio y verificación

La tarjeta de ganancia estimada conserva el total y muestra la cifra de cada tienda, con su cobertura o estado pendiente. Reutiliza los datos del cálculo; no añade consultas. El resultado sigue siendo ingresos con IVA menos coste de compra con IVA y recargo, separado del resultado contable y del margen comercial sin impuestos.

Las pruebas de Playwright distinguen navegación, vistas guardadas, estados de error y escrituras simuladas. Incluyen recarga/cambio de cuenta, familias, publicación de precios, ofertas, recuperación tras perder una respuesta y reapertura del borrador, permisos y tamaños de pantalla. CI ejecuta los nuevos recorridos junto con los existentes. Una prueba simulada no acredita una escritura real en las tiendas del usuario.
