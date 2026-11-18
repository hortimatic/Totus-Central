# TotusTPV · manual del puesto

Manual de trabajo actualizado el 17/11/2026. Describe el módulo integrado y sus ampliaciones en desarrollo; no acredita que todas estén publicadas. Consulta primero `TOTUSTPV_ESTADO_IMPLEMENTACION.md` y el registro de activación. Mientras el puesto indique tienda de pruebas, los pedidos y cambios de existencias son de prueba y no se mezclan con los cierres comerciales. La documentación final incluirá las imágenes privadas de referencia; estas no forman parte del repositorio público.

## Dónde funciona

Se accede dentro de Totus Central, en **TotusTPV** (`/tpv`), con la cuenta habitual. No hay que abrir localhost, arrancar programas, mantener una base de datos en el ordenador ni iniciar una sesión paralela. Los permisos, establecimiento, caja y operador se comprueban en el servidor. No se comparten claves de PrestaShop con el navegador.

## Preparar el puesto una vez

1. Un responsable abre **Administrar tiendas y cajas → Asignar tienda y caja** desde la entrada de TotusTPV. Dentro del mostrador también puede acceder por **Más acciones → Configuración → Configurar puesto y operadores**.
2. Comprueba que el origen es `https://preproduccion.hortimatic.com`, selecciona el establecimiento físico, su caja y el operador ya registrados en Central.
3. Comprueba la tienda nativa indicada. Efectivo y tarjeta están incluidos; activa Bizum o transferencia únicamente si se utilizan.
4. Elige si la persona puede vender o solo consultar y si puede gestionar el efectivo. Lee y marca la autorización de preparación y pulsa **Preparar y asignar puesto**. Se reutilizan los datos auxiliares nativos existentes; si faltan, se crean exclusivamente en QA.
5. El operador entra al mostrador con su cuenta, selecciona su tienda/caja y recupera la sesión abierta. Si no hay una abierta y tiene permiso, introduce el fondo inicial y pulsa **Abrir caja**. Una caja física sólo puede tener una sesión abierta en ese entorno.

Una asignación nueva no desactiva medios de cobro previamente configurados para otros operadores. La retirada de un medio requiere una futura operación de configuración explícita; no se simula quitando una casilla de alta.

## Crear un artículo desde el mostrador

Ampliación comprobada en laboratorio, pendiente de activación remota.

1. Con una caja abierta y permiso de creación de Productos, abre **Más acciones → Nuevo producto**. El ticket actual se conserva.
2. Escribe nombre, referencia, precio y categoría. Puedes añadir coste, código EAN, marca, proveedor y unidades. Elige **Solo en el TPV** o **TPV y tienda online**.
3. Si introduces el PVP con impuestos, se convierte a precio base usando el impuesto simple comprobado. La estimación indica España; el ticket nativo confirma el impuesto aplicable a la dirección del cliente. No se supone un IVA fijo.
4. Añade imágenes si las necesitas: elige un archivo o **Hacer foto**. Usa un fondo liso o una imagen sin fondo para prepararla correctamente. Para tallas, colores u opciones, pulsa **Añadir combinación** e indica las unidades de cada una. El precio vacío de una combinación hereda el del artículo.
5. Pulsa **Guardar ficha para revisar**. Esto guarda una revisión y todavía no crea el artículo en la tienda. Comprueba su nombre, referencia y pasos, y pulsa **Confirmar y crear producto**.
6. Espera a **Alta terminada**. Cierra la ventana, busca el artículo y añádelo al ticket.

Si se interrumpe el guardado de la revisión, pulsa **Comprobar envío** manteniendo la misma ficha. Si ya comenzó el alta, utiliza **Comprobar y continuar alta**; los pasos verificados se conservan. Para encontrarla después de volver a entrar, abre **Más acciones → Altas de productos**. La consulta funciona también sin caja abierta; continuar requiere una sesión y permisos vigentes. No prepares otra alta para sustituir una que tenga resultado incierto.

## Crear una categoría al preparar un producto

Pulsa **+ Crear categoría** junto al selector del artículo. Escribe su nombre, elige **Dentro de** y pulsa **Revisar categoría**. Confirma su creación y, cuando aparezca **Categoría creada**, pulsa **Usar en este producto**. La ficha y el ticket se conservan. Las solicitudes permanecen en **Categorías guardadas**; una respuesta pendiente se consulta con la misma solicitud antes de volver a crear nada.

## Elegir cómo se muestran los precios

En **Más acciones → Configuración → Precios de las tarjetas**, elige **Con IVA** o **Sin IVA** y guarda el mostrador. Cada tarjeta indica su modalidad; el ticket confirma el total con los impuestos del cliente. En Tabla puedes añadir **Precio sin IVA** desde Columnas y conservar **PVP con IVA** para comparar. Si la conexión no entrega el importe sin IVA, se indica que no está disponible.

## Elegir cómo buscar artículos

En **Más acciones → Configuración → Buscar artículos**, marca referencia, EAN, UPC, ISBN o nombre/atributos y guarda. Debe quedar un criterio. Puedes activar el teclado numérico para móvil. Los cambios conservan el ticket y actualizan la búsqueda de toda la tienda. Enter añade una unidad solo ante un identificador activado, exacto y único; ante dudas se elige el artículo o su variante.

## Ocultar artículos en el mostrador

En **Configuración → Visibilidad del catálogo de venta**, elige si ocultar agotados y categorías con sus subcategorías. Puedes mostrar marca, proveedor y códigos. Guarda; el ticket se conserva. Los padres con variantes indican **Existencias por variante**. La entrada de stock no aplica estas exclusiones para permitir reposición; al volver a Venta se recuperan sus filtros.

## Contar el efectivo

Ampliación comprobada en laboratorio, pendiente de activación remota.

1. En **Más acciones → Configuración → Efectivo · billetes y monedas**, elige los valores que utilizas y pulsa **Guardar mostrador**. Se recuperan en tu cuenta y esa caja desde otros ordenadores.
2. Al abrir caja, recibir efectivo o contar el cierre, abre **Contar billetes y monedas**. Introduce cuántas unidades tienes de cada valor. El importe total se actualiza sin hacer la suma a mano.
3. Revisa el importe aplicado. Puedes introducir un total manual; al hacerlo se limpia el desglose anterior. En un cobro, comprueba también el cambio mostrado.
4. Para cerrar, pulsa **Cerrar caja**. El registro conserva el total contado. Si se pierde la respuesta, mantén los datos y vuelve a consultar el mismo cierre; las cantidades de la vista se conservan.

En **Accesos a las cajas → Cambiar acceso**, el responsable puede cambiar venta/consulta, gestión de efectivo y activación por separado. Retirar el acceso conserva el historial y no cierra la caja. Si otra persona cambió el acceso mientras se editaba, actualiza y revisa su configuración antes de guardar de nuevo. Si se pierde la respuesta, reintenta los mismos cambios o actualiza para comprobar el resultado. Cambiar tu propio acceso te devuelve a la entrada para recuperarlo con los permisos actuales.

## Vender

1. Busca por nombre o referencia. Selecciona la variante concreta cuando corresponda; la cantidad y disponibilidad se verifican de nuevo al preparar el cobro.
2. Para la pistola, enfoca el buscador, escanea y termina con Enter. Sólo una coincidencia exacta y única se añade automáticamente. Si hay varias, elige el artículo.
3. Elige cliente y dirección si los necesitas; por defecto se usa el cliente de mostrador. Puedes crear o editar la ficha con permisos. Corregir una dirección crea una nueva y conserva la usada por pedidos anteriores.
4. Ajusta cantidades y, si procede, descuento de línea, descuento general o cupón. Son condiciones de ese ticket, no modificaciones del precio del catálogo.
5. Prepara el cobro. El total y los impuestos proceden del cálculo nativo de PrestaShop. Revisa el resultado antes de aceptar.
6. En efectivo, introduce lo entregado o pulsa el billete correspondiente. Se muestra el cambio; no permite confirmar si falta dinero. En tarjeta, realiza el cobro en el datáfono independiente y confirma después su recepción. Bizum y transferencia también necesitan confirmación de recepción; un pago pendiente no es un cobro.
7. En mixto, indica la parte de efectivo y el segundo medio. Comprueba ambos importes y el cambio.
8. Confirma una vez. La confirmación exige releer pedido, pagos, estado y evidencia de stock. Ante respuesta incierta, conserva la solicitud y utiliza recuperación; no crees otro ticket para repetir el mismo cobro.

## Aparcar y recuperar

Con el ticket sin cobrar, pulsa **Aparcar ticket**. Se guarda en el servidor con versión y responsable. Recuperarlo en otro acceso recalcula precios y disponibilidad; no conserva un precio antiguo como autorización de cobro. Un ticket vendido no puede volver a convertirse en otra venta. Cancela o termina una devolución antes de trabajar con otro ticket.

## Documentos

Desde una venta verificada puedes imprimir ticket o regalo y descargar factura/albarán nativos ya existentes. Reimprimir no cobra ni crea otro número de factura. El perfil de impresión utiliza papel de 58 mm y contenido de 48 mm; configura el controlador de la Bisofice a 58 mm, escala 100 %, sin cabeceras ni pies del navegador. La apertura automática del cajón y la impresión física todavía requieren aceptación en el puesto real; no hay un agente local instalado.

Puedes consultar **Pedidos y devoluciones** con la caja cerrada. Para localizar un pedido, escribe su número o lee el código del justificante en el buscador. No se abre otra caja ni se crea una venta al consultar. Para devolver sí necesitas una caja abierta y permiso de venta.

En **Configuración**, las opciones de justificante se agrupan por establecimiento, contenido, confirmación y cliente. Permiten ajustar título, pie, fecha, letra, logo, referencia, numeración de artículos, precio unitario, impuestos, operador, web y datos opcionales del cliente. La vista previa usa datos de ejemplo. El ticket regalo oculta importes y cliente. Los cambios se guardan para tu cuenta y caja; no modifican la numeración de la factura nativa. Las demás opciones solicitadas siguen en la matriz de requisitos y no se consideran disponibles por aparecer en una captura de referencia.

## Pantalla para el cliente

En **Configuración → Pantalla para el cliente**, activa la opción y guarda. Puedes ocultar precios, permitir el nombre del cliente, cambiar color y tamaño de letra. Desde **Más acciones → Pantalla para cliente**, abre la ventana, muévela al segundo monitor y pulsa **Pantalla completa**. Si se bloquea, permite las ventanas emergentes de Central y repite la acción.

La lista acompaña el ticket y distingue la estimación del total verificado. El nombre necesita permiso de Clientes y desaparece al confirmar; no se muestran datos de contacto ni de pago. Al salir o cerrar caja se borra y cierra la ventana. Si pierde la actualización del mostrador, pasa a espera y borra sus datos. Esta función se ha comprobado en ventanas de navegador; su aceptación en el monitor físico sigue pendiente.

## Devolver

Busca el pedido en el historial del establecimiento, elige las líneas/cantidades, indica el motivo y si el artículo vuelve a existencias. Puedes respetar el reparto original o elegir un medio original con saldo suficiente. Revisa el abono y confirma el reintegro externo cuando corresponda. TotusTPV registra el reintegro; no opera el datáfono ni la cuenta bancaria. La recuperación de una respuesta incierta consulta la misma operación. El abono PDF se descarga del documento nativo existente.

## Caja e inventario

Los ingresos y retiradas de efectivo requieren importe y motivo. Antes de cerrar, termina, aparca o descarta el ticket pendiente y recupera operaciones inciertas. Introduce el efectivo realmente contado y revisa la diferencia. Un informe de caja cerrada puede consultarse sin abrir otra sesión; muestra operador, cobros por medio, devoluciones, movimientos y diferencia. La recepción de stock es aditiva, por producto/variante y con motivo: no es una sustitución arbitraria de la cantidad global.

Si se pierde la respuesta al cierre, conserva los mismos importes y motivo y reintenta: se recupera la solicitud original aunque la caja ya figure cerrada. No hagas otro movimiento para compensar un resultado que todavía no has comprobado.

En **Más acciones → Entrada de stock**, busca o escanea los artículos. Las lecturas repetidas acumulan unidades en la misma línea. Revisa variantes, cantidades y motivo antes de guardar el lote; guardarlo todavía no modifica existencias. Al registrarlo en la tienda, cada línea muestra su resultado. Si una respuesta queda pendiente, recupera ese lote para comprobar las líneas ya registradas; no crees otro para repetirlas.

## Límites que impiden declarar explotación completa

Quedan pendientes crédito/anticipos/cobros posteriores, presupuestos/reservas, vales/saldo, traslados e inventarios generales, stock avanzado/compartido/paquetes/virtuales, apertura directa del cajón y aceptación física, además de concurrencia web y numeración de facturas. No se debe sustituir todavía la operativa comercial de producción ni cambiar el dominio.

## Crear o gestionar cajas desde la preparación del puesto

El administrador puede abrir Crear y gestionar cajas. Se abre Administración → Negocio y cajas en otra pestaña, conservando la preparación del TPV. Crea o edita allí la caja y guarda. Regresa al TPV y pulsa Actualizar tiendas y cajas. Revisa la selección y asigna el puesto a su operador; crear una caja no le concede acceso automáticamente. Si la conexión ha cambiado, cancela la preparación y vuelve a entrar. Esta ampliación sigue en rama, pendiente de publicación.

## Elegir una variante en una venta

Pulsa el artículo. La ventana muestra cada combinación con sus atributos, existencias y precio. Elige un atributo para ordenar, como Color, o cambia a orden por existencias o precio. Usa Anterior y Siguiente para recorrer todas las combinaciones. En móvil se abre con tarjetas; Vista permite cambiar a Tabla y usar las columnas comunes. Pulsa una combinación habilitada para añadirla: la ventana se cierra y conserva el resto del ticket. Volver a productos o Escape cancela la selección. Ordenar las variantes no cambia el orden guardado del catálogo. Esta ampliación sigue en rama, pendiente de activación remota.

Para elegir cómo se abren siempre las combinaciones, entra en Configuración y busca Orden inicial de las variantes. Selecciona el orden y pulsa Guardar mostrador. Se conserva para tu cuenta en esa caja; el orden del catálogo permanece independiente. El selector permite cambiarlo sólo para la consulta actual sin volver a guardar.

## Vender cuando faltan existencias

Por defecto, los artículos sin unidades suficientes no pueden añadirse para vender. Si tu operativa permite venderlos, abre Más acciones → Configuración → Ventas y existencias, activa Permitir vender con existencias insuficientes y pulsa Guardar mostrador. Debe estar desactivada la opción Ocultar productos sin existencias para poder elegirlos. El ajuste corresponde a tu cuenta y caja y requiere permiso de venta.

Los artículos y variantes habilitados muestran sus existencias reales, incluso cero o negativas, y el aviso Venta sin existencias permitida. Revisa la cantidad del ticket antes de cobrar. El pedido registra las unidades vendidas y el stock resultante; la configuración de venta online del artículo se conserva. Desactivar el ajuste después de calcular un cobro exige volver a calcularlo antes de confirmar. Si la respuesta queda pendiente, utiliza Recuperar resultado para comprobar la misma operación.

Esta ampliación está verificada en laboratorio con ventas y devoluciones reales del entorno local aislado, pendientes de activación y aceptación remotas.
