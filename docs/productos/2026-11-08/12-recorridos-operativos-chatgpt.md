# Recorridos operativos de Productos para ChatGPT

Fecha de revisión: 9 de noviembre de 2026. Este documento consolida el uso actual; los documentos 01–10 conservan el historial de pruebas y no certifican por sí solos que una muestra comercial esté completa.

## Entrada y producto activo

1. Entrar en Totus Central con la cuenta propia autorizada y abrir Productos. Elegir Hortimatic o NewOldSmok y comprobar que la conexión está disponible. No usar la identidad de otra IA.
2. En Catálogo, buscar por ID/referencia exacta en tienda si el artículo no está entre los consultados. La búsqueda local solo filtra las páginas cargadas; una lista parcial no acredita ausencia.
3. Pulsar el nombre o marcar una única casilla activa ese producto para Producto, Copiar y Cambios. Varias casillas son una selección de lote. En Producto y Copiar hay un selector visual con búsqueda, foto, referencia e ID; elegir allí otro artículo conserva su borrador y mantiene la pestaña de trabajo.
4. Comprobar tienda, ID y referencia antes de editar. Los ID pueden coincidir entre tiendas sin representar el mismo artículo. No confundir un borrador conservado con datos guardados.

## A. Crear un producto desde una URL

1. Registrar URL de proveedor, tienda(s) destino, nombre, referencia, tipo simple/con combinaciones y datos confirmados por el usuario. Extraer solo datos acreditados de la ficha: marca, proveedor, descripciones, características, materiales, medidas, peso, EAN y fotos. Una fotografía no acredita EAN, stock ni coste. Diferenciar peso del artículo y peso de envío.
2. Usar Alta asistida para preparar el encargo y Nuevo producto para el borrador. El encargo no ejecuta por sí solo la creación: ChatGPT debe continuar con los controles de Productos. Completar Datos, Contenido, Precios e impuestos, SEO, Transporte y Disponibilidad. Trabajar cada idioma que la tienda tenga configurado.
3. Introducir coste sin impuestos y precio de venta sin impuestos; comprobar el PVP con el grupo fiscal de destino. El coste total con IVA y recargo es una estimación sobre el coste leído y no corrige redondeos de PrestaShop. No confundir impacto de combinación con PVP total.
4. Elegir categoría principal y asociadas, marca, proveedor, características/materiales, etiquetas y relacionados entre los valores de la tienda elegida. No trasladar identificadores desde otra web. Revisar mínimos de venta, disponibilidad, fechas, condición, transporte, redirección y permiso de compra cuando procedan.
5. Preparar la tienda destino y consultar su esquema, categorías e idiomas. Validar el alta sin escribir. Corregir los campos que la validación indique. Revisar la ficha completa, escribir CREAR y crear una única base. Conservar el identificador de solicitud y el ID devuelto.
6. La base no significa producto terminado. Completar combinaciones, imágenes, cantidades, precios adicionales y estado mediante sus etapas. Validar, guardar y releer cada una. Crear atributos por su grupo/valor de destino, sin duplicar tuplas existentes. Elegir una sola combinación predeterminada y comprobarla.
7. Usar imágenes del usuario o del proveedor autorizado, sin sustituirlas por imágenes generadas. Prepararlas al tamaño admitido por los tipos de imagen de la tienda, sin deformarlas y con transparencia cuando corresponda. Subirlas mediante Totus y asociarlas al producto/variantes correctos. Una imagen dentro de la descripción no sustituye la galería nativa.
8. Revisar expresamente activo/inactivo, visibilidad y permiso de compra; son decisiones distintas. Releer la ficha y abrir Ver en la web si es pública. Registrar ID, referencia, fotos nativas, combinaciones y datos pendientes. No declarar terminada una etapa que no se haya guardado y verificado.

## B. Modificar un producto existente

1. Seleccionar el artículo y releerlo. Abrir Producto, escoger apartado e idioma y editar únicamente los campos deseados. En tabla, distinguir las celdas editables de los cálculos derivados; guardar la edición de tabla y comprobar la relectura.
2. Preparar los cambios contra la misma tienda y el mismo ID. Revisar valores anteriores/nuevos y validar antes de confirmar. No crear una base nueva para modificar una existente.
3. Guardar y releer nombre, referencia, texto, precio o campo afectado. En fotos, existencias, precios especiales, organización o combinaciones, utilizar su etapa correspondiente y comprobar el resultado nativo.
4. Cambiar de pestaña o producto conserva el borrador, pero no lo guarda en PrestaShop. Al volver, distinguir el dato releído de una modificación local pendiente.

## C. Crear o modificar combinaciones

1. Seleccionar el padre exacto y abrir Variaciones y atributos. Consultar sus combinaciones y los grupos/valores disponibles en esa tienda.
2. Para añadir, pulsar Añadir combinación y elegir la tupla de atributos. Completar referencia, EAN acreditado, coste, impactos de precio/peso, mínimo y disponibilidad aplicables. Para modificar, seleccionar la variante existente por ID y atributos; no añadir otra que represente la misma tupla.
3. Validar y guardar la etapa. Releer que la combinación pertenece al padre correcto y conserva sus atributos. Después asignar fotos nativas de esa misma tienda, cantidades y variante predeterminada mediante sus controles.
4. Un precio de combinación puede ser un incremento sobre la base: comprobar el precio final, sin introducir el PVP como incremento. Nunca inventar cantidades ni copiar inventario físico por omisión.
5. Si el padre era simple, verificar después que se muestran sus nuevas combinaciones y que no se han perdido los datos anteriores. Si ya tenía variantes, comprobar también que las no editadas permanecen.

## D. Copiar de una tienda a la otra

1. Abrir Copiar y elegir el origen desde su selector visual o desde Catálogo. Confirmar nombre, ID, referencia, foto, número de imágenes y combinaciones. Elegir destino; si se invierte la dirección, releer ambas identidades antes de actuar.
2. Seleccionar Todo cuando se requiera copia íntegra. Comprobar expresamente Copiar imágenes y las combinaciones seleccionadas. Los apartados permiten una copia parcial: datos, contenido, precios, SEO, transporte y disponibilidad. Revisar cada apartado antes de preparar.
3. El destino sin fotos muestra las del origen como Vista previa pendiente de copiar. Eso permite revisar la selección, pero no acredita una subida. Tras guardar deben aparecer ID y dominio de la foto nativa del destino.
4. Pulsar Preparar copia. Buscar correspondencia por referencia exacta: si existe, revisar la actualización; si no existe, preparar el alta. Un resultado ambiguo requiere escoger el producto correcto, nunca elegir el primer ID por comodidad.
5. Pulsar Relacionar datos del origen con esta tienda y revisar las correspondencias. Resolver categoría principal/asociadas, marca, proveedor, impuestos, características, etiquetas, relacionados y atributos de variantes usando datos de destino. La categoría padre también debe ser correcta. Si un nombre no coincide, seleccionar la equivalencia real.
6. Adaptar todas las versiones localizadas: nombre comercial cuando corresponda, resumen, descripción, título/meta descripción, palabras clave, etiquetas de disponibilidad y textos de entrega. Sustituir Hortimatic ↔ NewOldSmok solo donde identifica la tienda; no cambiar marcas del fabricante ni datos técnicos.
7. Revisar enlaces internos: dominio y ruta/ID deben corresponder a una categoría o producto real de destino. No reemplazar únicamente el dominio de una URL con ID. Mantener enlaces de proveedor cuando deban seguir siendo externos. No cambiar el host de una imagen manteniendo el ID del origen.
8. Revisar precios de proveedor y ofertas si se seleccionan. Las existencias no se copian por defecto; solo hacerlo cuando se haya pedido expresamente y la cantidad de destino esté acreditada. La conservación de estado/visibilidad también se elige expresamente.
9. Validar el alta o actualización. Crear la base una sola vez si procede; después Guardar copia completa seleccionada completa las etapas disponibles. Revisar el diario y terminar cualquier etapa pendiente, sin repetir el alta.
10. Releer destino: campos de ambos idiomas, referencia, precios/costes/impuestos, relaciones, todas las fotos, tuplas de variantes, impactos, fotos por variante y predeterminada. Abrir el destino en Catálogo y Ver en la web. Confirmar que el origen no cambió. Registrar cualquier campo no trasladado y la causa concreta.

## E. Duplicar, archivar y eliminar

Duplicar dentro de la misma tienda requiere una referencia nueva y revisión de los mismos apartados. Archivar es reversible y debe verificarse por estado. Eliminar definitivamente exige confirmar el producto concreto y verificar su ausencia; no borrar muestras o artículos ajenos al encargo. No confundir borrar un borrador con eliminar un producto de la tienda.

## Errores y recuperación

- Lectura parcial o fallida: indicar lo que falta. Un único reintento automático solo cubre fallos temporales GET; permisos y cuota no se eluden. No sustituir datos desconocidos por cero ni impuestos por porcentajes supuestos.
- Escritura incierta: conservar la solicitud existente y usar su comprobación/recuperación. Consultar por ID/referencia antes de otra escritura. No cambiar referencia o UUID para sortear la incertidumbre.
- No instalar módulos ni modificar archivos, núcleo o base de datos de PrestaShop. Usar Totus y la API nativa. La API 1.7 instalada no garantiza edición de orden/textos alternativos de la galería principal; no anunciar esos cambios como guardados nativos si solo están en el borrador o descripción.
- No prometer que cualquier ChatGPT tiene acceso: necesita su conexión autenticada a Totus y permisos de Productos. Disponer de este protocolo no crea esa conexión.

## Evidencia de cierre

Entregar por recorrido: fecha, versión de Totus, tienda(s), ID/referencia, solicitud, campos/etapas, resultado releído, IDs de fotos/combinaciones, estado y enlace público cuando exista. Separar simulación Playwright, PrestaShop aislado y tienda comercial.

Pruebas reproducibles: productos-ui-browser-qa, productos-table-browser-qa, productos-copy-circuit-browser-qa, productos-copy-complete-browser-qa, productos-existing-actions-browser-qa, productos-image-copy-browser-qa y productos-shared-selection-browser-qa. Sus simulaciones no sustituyen una verificación comercial del artículo solicitado.

Prueba comercial finalizada en el lote anterior: Bandeja Mario Jump, Hortimatic #170807053 → NewOldSmok #170807260, foto nativa #12673 y textos/enlaces adaptados en ambos idiomas. Stock destino 0; no se duplicó inventario. Esa bandeja no tiene combinaciones. La muestra Argus #170807259 sigue siendo una base incompleta; no presentarla como copia íntegra ni repetir su alta.
