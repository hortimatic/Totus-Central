# Controles comunes y estabilización — 15 de noviembre de 2026

## Criterio obligatorio

Una función equivalente debe utilizar los mismos controles, jerarquía y comportamiento. No crear una cuarta configuración de columnas o un nuevo estilo de ventana para cada módulo. Conservar las preferencias de Mi interfaz y los contratos de escritura existentes.

- Controles normales de 36 px mínimos; acciones de la misma fila alineadas, espacio común de 8 px. No estirar botones para llenar huecos.
- Flechas de tablas al pie del contenedor y visibles durante su recorrido vertical, con el mismo tamaño. No inmovilizar columnas ni añadir una barra lateral nueva.
- Configuración de columnas compacta: búsqueda, visibilidad, posición, restauración y persistencia explícita. Los controladores existentes conservan sus perfiles y sincronización; las tablas genéricas nuevas guardan solo su distribución por cuenta en este navegador. No presentarlas como perfiles compartidos o sincronizados en servidor.
- Volver en la cabecera de la ficha, antes de su título, con el patrón de Cajas. No esconderlo al final del formulario.
- Ventanas con título y cierre alineados, acciones al final, límites de pantalla y colores de Mi interfaz. Las dimensiones pueden variar según la función; la estructura y las medidas de sus controles son comunes.
- Nunca mover las celdas de formularios editables mediante un controlador genérico. Sus columnas pertenecen a su formulario y a su protocolo de guardado. Una regresión en Facturación detectada durante esta intervención se aisló y corrigió con esta separación.

## Cambios de este bloque

1. Flechas comunes en tablas genéricas, directorios, pedidos y productos; las de Pedidos y Productos pasan al pie del contenedor.
2. Tablas de consulta genéricas con selección y orden de columnas, búsqueda y restablecimiento. Persistencia local separada por cuenta, módulo y estructura. No cambian los datos ni las exportaciones canónicas.
3. Directorios con configuración en un emergente compacto anclado al botón, búsqueda de columnas y conservación de su guardado en cuenta.
4. Facturación / Clientes reutiliza el directorio existente, con sus orígenes Totus, Hortimatic y NewOldSmok, en lugar de otra implementación independiente.
5. El selector de gráfica explica su alcance y nombra las opciones como número de pedidos e importe vendido. No modifica los totales del resumen.
6. Inicio / Tareas permite abrir directamente la creación de una tarea para la fecha seleccionada; conserva los permisos de creación y el formulario oficial de Tareas.
7. Mi cuenta / Documentos limita la representación a 10, 20 o 50 documentos, con búsqueda y navegación. Mantiene los documentos originales y su autoría; no elimina el vínculo de auditoría ni promete aún paginación de servidor.
8. Chat / Ajustes permite marcar todos los canales propios como leídos, hasta la última secuencia conocida. Excluye canales sin pertenencia, conserva los mensajes nuevos y no envía mensajes.
9. Documentos de solo consulta utiliza también el enlace Volver en su cabecera.

## Comprobaciones

Matriz local: 70 suites, todas correctas tras las correcciones. Incluye creación y modificación de productos, copia completa e imágenes, facturas, gastos, recepciones/cotejos, cierres, informes y descargas con datos ficticios. No confundir simulaciones con escrituras de producción. La geometría de ventanas contempla 52 sesiones en 320, 390, 768 y 1440 px; otros circuitos alcanzan 1920 px.

Las pruebas específicas de controles verifican desplazamiento, límites, cambio de anchura del contenedor, persistencia de columnas, separación entre cuentas y eliminación de observadores. Las de tareas comprueban fecha seleccionada y permiso de creación; las del perfil comprueban 31 documentos sin lista infinita y búsqueda entre páginas; las de Chat excluyen del marcado un canal ajeno.

PR #200 ya publicado en `3820e30770922ce24982d1e48ba8929bd489ca99`: verificados acceso a Inicio, personalización y lectura real de existencias y desglose de variantes del producto señalado por Diego, sin escribir en la tienda. Este bloque nuevo requiere su propia publicación y contraste posterior.

## Pendientes reales que no deben darse por cerrados

- Vista combinada de clientes de ambas tiendas dentro de Facturación; este bloque reutiliza la selección individual existente.
- Ocultación persistente de documentos de la ficha personal y paginación de servidor, conservando autoría, contabilidad y documentos originales.
- Unificar también los editores especializados de columnas que aún tengan opciones propias, conservando perfiles y anchos guardados; no sustituir su controlador por el genérico de consulta.
- Continuar la revisión visual real de cada módulo y sus pestañas. Que una matriz pase no prueba la ausencia de todos los defectos ni una auditoría completa de datos reales.
- Precio conectado al catálogo y operaciones por familias según el registro previo; quedan fuera de este bloque común.

Offline y Totus TPV siguen siendo exclusivamente estudio de montaje y construcción. No se implementan aquí, no se retira POSTPV y no se modifica PrestaShop ni sus servicios o permisos.

## Regresión responsive aportada después

Se reprodujo en el dominio publicado el recorte interno de «Personalizado» en escritorio. La comprobación previa solo detectaba desbordamiento de página y no era suficiente. Se añade comprobación de recortes internos y límites de filtros en diez anchos: 320, 390, 768, 1024, 1280, 1366, 1440, 1600, 1920 y 2560 px. Las tarjetas ajustan sus filas por su propio ancho, no solo por el tamaño de la ventana; las estrechas usan una cuadrícula regular de periodos. Fechas y selectores ocupan su celda sin mínimos rígidos. Las gráficas horarias dejan de exigir 330/355 px y sus etiquetas extremas se alinean dentro del dibujo. Las fechas inicial y final de la gráfica de actividad ya no se centran sobre el borde del SVG.

La matriz incluye ahora también `subtab-walk-qa`: 104 estados por clic real de módulos y pestañas, en 1640, 1180, 390 y 320 px, sin fallos. El detector distingue controles realmente enlazados a su controlador; el restablecimiento de columnas se comprueba además pulsando el botón y contrastando el resultado. El contrato mantiene los doce circuitos originales y permite añadir el circuito nuevo sin eliminar ninguno.

### Regresiones adicionales antes de publicar
La prueba de acciones de Productos detectó que la paginación sustituía accidentalmente el contenedor de flechas tras moverlo. El pie se captura antes de insertar los controles; las flechas conservan exclusivamente sus dos botones y siguen el borde inferior sin interceptar las filas. Recorrido simulado completo de edición, recuperación, archivo, duplicado y eliminación: tres anchuras, correcto. Se incorpora a la matriz obligatoria (71 suites locales). La navegación elimina release y totus_refresh de la barra tras cargar sin alterar la identidad interna del código ni los enlaces funcionales de pedido/tienda.
