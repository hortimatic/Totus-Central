# Productos: formato de Copiar y recuperación de lecturas

## Medidas comunes
- Tipografía de controles, etiquetas y botones: 12 px, línea 18 px. Títulos del módulo: 15 px.
- Altura mínima compartida de botones, inputs y selects: 34 px. Espacio entre controles: 8 px. Separación de fichas: 12 px.
- Foto principal: 112 px (88 px en móvil); galería: miniaturas de 52 px con ampliación.
- Dos fichas de igual ancho cuando el módulo dispone de al menos 640 px; una columna debajo. Nunca fijar anchos que desborden su contenedor.
- Misma columna de selección de 20 px en ambos lados. El destino reserva ese pequeño espacio para que las etiquetas y entradas se alineen.
- Texto SEO: 56 px de alto inicial; resumen: 96 px; descripción: 128 px. Son editables y ampliables. No usar la longitud del texto para deformar la ficha.
- Preparar copia no publica. Ir a guardado abre la revisión preparada; no simula un envío directo.

## Imágenes antes y después
Si está seleccionada Copiar imágenes y el destino todavía no tiene una foto, debe mostrar la del origen como Vista previa pendiente de copiar. Nunca cambiar el dominio conservando el ID de otra tienda. Tras guardar, la relectura nativa reemplaza la vista previa por el ID y la imagen de destino.

## Tabla
Solo las dos flechas acompañan el desplazamiento vertical, dentro del área de la tabla y por debajo de la cabecera. El control deslizante queda en su posición normal. Todas las columnas se desplazan juntas, sin inmovilizarlas ni añadir un hueco final.

## Lecturas incompletas
Las consultas auxiliares se ejecutan secuencialmente para no lanzar una ráfaga a la tienda. Un cierre de conexión o fallo temporal admite un único reintento de lectura GET. No se reintentan denegaciones de permiso, cuota ni escrituras. Si falta alguna consulta, se informa de la categoría de datos pendiente y los cálculos no acreditados siguen como Sin verificar. Una copia releída actualiza la ficha destino sin introducir sus filas en el catálogo de otra tienda.

## Verificación
Playwright verifica el desplazamiento vertical con veinte filas, las flechas visibles mientras el deslizador queda arriba, las entradas homogéneas, la vista previa sin atribuirle ID de destino y los fallos de lectura recuperables o de permiso. Simulación y tienda real se registran por separado.

## Producto de trabajo común
Seleccionar un único producto mediante su casilla o nombre en Catálogo lo activa para Producto, Copiar y Guardado sin obligar a abrir otra pantalla. Varias casillas siguen representando una selección de lote. Producto incorpora un selector visual de dos fichas por página con foto, nombre, referencia e ID y búsqueda entre los productos consultados. Cambiar de artículo conserva el borrador sin enviarlo a la tienda. No confundir esta búsqueda local con una consulta completa al servidor.
