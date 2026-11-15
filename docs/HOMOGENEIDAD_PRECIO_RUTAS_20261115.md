# Interfaz común, Precio y rutas de módulos

Implementación posterior al PR 206. La revisión, migración de estilos compartidos y publicación se registran con su commit al cerrar esta entrega; este documento no acredita por sí solo un despliegue.

## Criterio común

Los controles de columnas comparten `column-settings.js`: cabecera, buscador, lista vertical, controles de posición y pie para guardar/restablecer. Los adaptadores conservan la persistencia y los permisos de cada tabla. No se añade un segundo configurador a una tabla con controlador propio (`data-tc-columns-managed`). Previsión y Movimientos usan este mismo panel.

`interface-controls.css` concentra la escala de espaciado, barras de acciones, botones, tablas, emergentes y tipografía móvil. Las alturas se ajustan al contenido. Los cuatro indicadores financieros mantienen filas simétricas y la ganancia ocupa una franja con total y tiendas. El lienzo de edición conserva sus tamaños explícitos; los documentos impresos conservan su formato.

Los selectores de catálogos usan la búsqueda compartida de `productos-controls.js`. Ordenan alfabéticamente por nombre con comparación española, mantienen opciones generales al principio, no alteran la selección y no reordenan posiciones, estados o frecuencias. Escribir en el buscador no propaga cambios al formulario; solo elegir una opción confirma el cambio.

Se eliminan acciones equivalentes repetidas en la misma vista. No se confunden acciones que usan tiendas, fechas o registros diferentes. En Inicio la cabecera concentra las altas de gastos, facturas y documentos. En Productos queda una actualización de catálogo en su barra. Previsión conserva un solo configurador.

## Precio

Precio usa una tabla de trabajo para seleccionar productos por tienda, nombre, marca o familia/categoría. No monta las pestañas de creación, copia ni atributos de Productos. Sus columnas y vistas se conservan de forma independiente en este navegador, por cuenta, sin sobrescribir la distribución de Productos.

Un lote de 1 a 200 productos puede establecer un importe fijo o una variación porcentual del **precio de venta base sin IVA** o del **coste de compra base sin IVA ni RE**. La revisión identifica el campo, sus valores anteriores y los propuestos. El guardado utiliza la huella, solicitud persistente y relectura del circuito nativo existente. No cambia automáticamente los impactos de precio ni los costes particulares de las combinaciones; el diálogo lo indica antes de publicar.

Las ofertas por lote se publican mediante `specific_prices` nativos: porcentaje, cantidad mínima y fechas opcionales. Se comprueban las ofertas existentes y se rechazan solapamientos. Una respuesta incierta conserva la misma solicitud y detiene el resto del lote; el usuario puede comprobar los cambios pendientes sin duplicar altas. No se instalan módulos en las tiendas.

Los estudios internos permanecen separados de las escrituras nativas. Por petición expresa, el 15/11/2026 se retiraron los seis productos internos de prueba, sus tres variantes y tres familias, con copia previa y comprobación posterior de cero registros. No se eliminaron productos, familias ni combinaciones de PrestaShop. La creación de un nuevo estudio debe funcionar sin familias y muestra/focaliza el formulario. Un controlador de Productos desmontado no debe bloquearlo con un borrador ajeno.

## Inicio y carga

La ganancia conserva ingresos cobrados con IVA menos coste de compra con IVA y RE, sin descontar gastos generales. El desglose por tienda reutiliza el cálculo. Cuando existe el coste registrado en la venta, no se vuelve a consultar su producto o combinación. Las primeras páginas de líneas se consultan con un límite de dos lecturas simultáneas por tienda, manteniendo validación, paginación y cobertura. El historial de vendedores no bloquea la ganancia: otro widget puede completar esa información sobre el resultado en memoria, sin repetir pedidos y costes. No se replica el catálogo ni se crea almacenamiento persistente nuevo.

## Directorios, Configuración y Automatizaciones

Clientes, Proveedores y Marcas abren las tiendas. Las referencias internas de Totus que utilizan Gastos, Facturación y los estudios siguen accesibles desde Opciones del directorio; sus datos no se borran ni se publican en una tienda por cambiar de pestaña.

Configuración elimina el intercambio mediante códigos, la barra de búsqueda/expandir/contraer y la tarjeta explicativa duplicada. La biblioteca muestra estilos del equipo; cada usuario decide cuándo aplicar uno. El autor conserva sus derechos de modificar o eliminar. La lectura compartida es una RPC aditiva que devuelve únicamente propiedades visuales autorizadas; excluye identidad personal, fotos, logotipos, imágenes y orden de navegación. Las bibliotecas privadas existentes y su RPC de escritura permanecen intactas.

Automatizaciones muestra un resumen de qué se consulta, alcance, frecuencia, destino y estado antes de guardar. Mantiene la vista previa sin enviar, validación del destino y seguimiento de ejecución en servidor. No se declara ejecutada una regla porque solo se haya solicitado su comprobación.

## Direcciones

Los enlaces públicos usan `/precio`, `/tareas`, `/gastos` y demás rutas españolas, sin parámetros de otra pantalla. Se conservan los identificadores internos de permisos y datos, y la compatibilidad con enlaces antiguos `?module=...`. El paquete de publicación genera entradas de cada ruta para apertura directa y recarga en Pages, con base correcta de recursos incluso si existe un prefijo de alojamiento. Los contextos de pedidos se mantienen en el estado de navegación en vez de ensuciar la URL de módulos ajenos.

Las Fuentes sincronizadas bajo `sources/` son referencias de solo lectura. La entrega debe preparar un paquete actualizado de código y manuales; no afirmar que se sustituyeron automáticamente archivos del proyecto si la herramienta no lo permite.
