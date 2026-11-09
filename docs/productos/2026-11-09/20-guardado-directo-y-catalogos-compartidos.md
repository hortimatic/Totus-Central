# Recorridos directos: Productos, variaciones, copia y pedidos

Documento de implementación y comprobación. Fecha: 9 de noviembre de 2026.
Consultar junto al índice de cumplimiento 19. Hasta registrar despliegue y versión, estas instrucciones describen la entrega preparada, no una publicación comprobada.

## Identidad y tienda

ChatGPT debe usar su cuenta propia «ChatGPT». Codex usa su cuenta propia. Comprobar identidad y tienda al iniciar cada recorrido; no aprovechar la sesión de otra persona ni cambiar permisos para sortear un rechazo. Los permisos efectivos de Productos distinguen consultar, crear, editar, borrar y exportar.

Hortimatic y NewOldSmok conservan identificadores propios. No trasladar sus ID de categoría, atributo, imagen, proveedor o producto como si fueran comunes. Totus relaciona por nombre, idioma, referencia y atributos y verifica el resultado nativo.

## Crear desde cero

1. Entrar en Productos → Catálogo y pulsar **Crear producto**.
2. Elegir la tienda en la cabecera. Completar la ficha vacía: identidad, contenidos, precios, medidas, preferencias y SEO que correspondan. No inventar EAN, cantidades o costes desconocidos.
3. En la propia ficha, pulsar **Revisar datos de esta ficha**. Consultar los idiomas reales y seleccionar la categoría del destino. Completar nombre y URL de cada idioma.
4. Validar el alta, revisar lo que se enviará y confirmar **Crear en PrestaShop (inactivo)**. El alta inicial tiene su propia solicitud; conservarla ante una respuesta incierta.
5. Tras la relectura, la ficha utiliza el ID real recién creado. Continuar en ella; no repetir el alta ni abrir Cambios para completar el producto.
6. Añadir variaciones desde Variaciones, imágenes desde Imágenes, existencias y otras relaciones desde sus apartados. Cada guardado verifica la respuesta de la tienda.
7. Pulsar **Revisar publicación** en la ficha. Elegir activo/inactivo, visibilidad y si se permiten compras. Guardar y sincronizar. Se puede publicar una ficha incompleta y terminarla después: la interfaz advierte de pendientes sin convertirlos en una prohibición arbitraria. Las exigencias nativas de PrestaShop siguen aplicándose.

## Modificar producto o variación

- Producto: editar en Producto, seleccionar el idioma cuando corresponda, revisar las diferencias y pulsar **Aceptar y sincronizar en [tienda]**. Solo cambian los campos revisados; se conserva el resto de idiomas y relaciones.
- Variación: editar sus celdas, pulsar **Revisar cambios** en esa misma fila y después **Aceptar y sincronizar**. El servicio verifica que pertenece al producto indicado.
- Catálogo: doble clic o Intro en una celda editable abre la edición rápida de fila. Revisar y guardar cambios para sincronizar. Costes derivados, impuestos y márgenes calculados no se escriben como campos nativos.
- Cambios conserva borradores e historial. No es necesario trasladarse allí para enviar una modificación.

## Fotografías

La portada del producto y las imágenes asociadas a una variación son elecciones distintas.

En Variaciones, **Subir foto** guarda primero la imagen en la galería del producto y comprueba su ID. A continuación presenta su selección para esa variación; guardar y sincronizar aplica la asociación. También pueden elegirse fotografías ya presentes mediante miniaturas. No declarar terminada la asignación solo porque se haya subido el archivo.

La integración usa la API oficial, sin complementos. El texto y orden de la galería auxiliar de Totus pueden conservarse en el borrador o incorporarse a la descripción. No presentarlos como metadatos nativos editados si la API instalada no los admite.

## Copiar entre tiendas

1. Seleccionar el producto de origen en Catálogo o en el selector de Copiar.
2. En Copiar, revisar las dos fichas paralelas. **Seleccionar Todo** incluye datos disponibles, imágenes y variaciones. La sección **Variaciones** permite seleccionarlas por separado y consultar sus fotos, referencias e impactos.
3. Revisar contenidos y SEO adaptados al destino, incluidas menciones a la tienda y enlaces. Las imágenes usan nuevos ID del destino.
4. Pulsar **Preparar subida a [destino]**. Relacionar idiomas y categorías propios del destino y revisar las preferencias de cantidades, ofertas y publicación.
5. Pulsar **Confirmar y subir copia a [destino]** para crear la base una vez. Después, **Completar copia en [destino]** envía y verifica las imágenes y variaciones seleccionadas y sus asociaciones. Permanecer en Copiar.
6. Si la referencia ya existe, revisar la propuesta de actualización sobre su ID; no crear un duplicado. Si la respuesta de un alta es incierta, comprobar esa misma solicitud.
7. Comprobar el producto y sus combinaciones en destino, las imágenes asignadas, el estado solicitado y que el origen no cambió. Una base creada no equivale a una copia completa.

## Marcas, proveedores y atributos compartidos

En Catálogo, abrir **Marcas, proveedores y atributos**. El gestor consulta el catálogo completo de entidades de la tienda de trabajo, permite buscar por nombre o ID y editar sus datos mediante revisión y sincronización.

Renombrar una marca, proveedor, atributo o valor es un cambio compartido que repercute en todas sus fichas asociadas. Las traducciones se editan por idioma y los demás idiomas se conservan. La representación del atributo mantiene coherente el indicador nativo de grupo de color. No se mueve un valor a otro grupo por un simple renombrado.

**Consultar productos asociados** completa expresamente las lecturas necesarias antes de mostrar los contadores. Para proveedores incluye tanto el proveedor principal como las relaciones adicionales; para atributos cuenta productos distintos y combinaciones. El catálogo es una lectura sucesiva de la API, no una transacción: si otros operadores cambian datos durante la lectura, actualizar antes de decidir una reorganización.

Para crear una entidad durante la preparación de una ficha, seleccionar primero el producto de trabajo. **Crear marca/proveedor/atributo/valor** abre la operación en su ficha; completarla y pulsar **Guardar y sincronizar**. Crear el registro compartido no lo asigna automáticamente: elegirlo después en Organización o Variaciones y guardar esa relación. Este contexto conserva la trazabilidad de la operación; no modifica otros productos.

No se añade eliminación masiva de entidades compartidas en esta entrega. No confundir eliminar una combinación de un producto con eliminar un valor utilizado por muchos productos.

## Pedidos y ventas

La tabla permite elegir columnas, ordenarlas, ajustar anchos, guardar vistas, cambiar densidad, seleccionar filas, exportar CSV y paginar. Las preferencias de esta tabla se guardan por usuario en el navegador actual; la distribución de Productos mantiene su guardado de perfil existente.

**Limpiar búsqueda y filtros** vacía los textos y selecciones locales, conserva el periodo consultado y vuelve a la primera página. El cliente se consulta con la identidad de la conexión; si no se puede recuperar su nombre, se muestra su ID. **Cargar datos de esta página** completa los detalles de sus pedidos.

Fecha y hora proceden del pedido. El empleado no se deduce del usuario actual ni de quien cambió un estado: si la API no publica al vendedor, figura **No informado por la tienda**.

El margen de pedidos utiliza el cálculo existente: ventas sin IVA, sin envío ni embalaje, menos costes de las líneas. Es estimado, no beneficio neto, y no incluye gastos, comisiones o devoluciones posteriores. Si faltan líneas o costes válidos aparece **Sin calcular**. No mostrar cero como sustitución de un coste ausente.

## Abrir el backoffice

El enlace público y **Abrir en administración** son distintos. Para este último, configurar el enlace real de Catálogo → Productos de la sesión administrativa de la tienda. No sirve el token del Dashboard. El vínculo se conserva exclusivamente en la sesión del navegador de ese usuario, no en GitHub, borradores ni servidores. Al caducar la sesión de PrestaShop puede ser necesario renovarlo; no ignorar sus avisos de token inválido.

## Evidencias de pruebas

- `productos-direct-save-browser-qa.mjs`: ficha, idioma, combinación, foto y asignación, edición rápida, alta desde cero, añadir combinación y publicación sin repetir el alta, a 390/969/1920.
- `productos-copy-upload-browser-qa.mjs`, `productos-image-copy-browser-qa.mjs` y `productos-copy-complete-browser-qa.mjs`: preparación, confirmación y copia de elementos.
- `productos-masters-browser-qa.mjs`: edición compartida, idioma conservado, contadores y creación desde contexto.
- `productos-masters-qa.mjs`: contratos y transporte, preservación, creación nativa simulada e idempotencia.
- `prestashop-orders-table-browser-qa.mjs`: configuración, páginas, búsqueda y limpieza de selección.
- `prestashop-sandbox/live-product-qa.mjs`: recorrido contra PrestaShop 1.7.8.11 aislado, sin modificar las tiendas reales. Se amplía para marcas y proveedores nativos.

Estos nombres identifican pruebas repetibles; sus resultados y los de producción deben constar por separado en el cierre de la entrega.
