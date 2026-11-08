# Productos: alcance íntegro para Stitch e integración fiel

Estado: diseño integral previo a continuar la implementación. Los cambios locales de interfaz están aislados en `feat/products-stitch-workspace`, sin publicar. El servicio de producción anterior no se sustituye por una maqueta.

## Reglas del encargo

- Stitch diseña el módulo COMPLETO y todos sus recorridos conectados. No una sola ficha, una imagen o un formulario independiente.
- Solo contenido de Productos: conservar cabecera y navegación global actuales de Totus. No duplicarlas.
- Se integrará el diseño original exportado: composición, jerarquía, tamaños, espaciado, colores y componentes; no un rediseño improvisado de Codex. Respetar las preferencias de interfaz ya existentes.
- Interfaz en castellano, compacta y profesional. Datos e imágenes son protagonistas. Sin indicadores enormes, cajas redundantes, paneles técnicos de XML/JSON o IDs como principal modo de trabajo.
- Datos ficticios en la maqueta. No presentar simulaciones de Stitch como funciones ya conectadas. Cada acción real se implementará y comprobará antes de darse por terminada.

## Catálogo

- Hortimatic, NewOldSmok y consulta comparada; dejar inequívoco el origen de cada registro.
- Tabla con miniaturas y columnas configurables: nombre, ID secundario, referencia, EAN, marca, proveedor, categoría, coste aproximado neto, precio base, PVP cuando esté acreditado, existencias por tienda, variantes, estado, peso, dimensiones y última modificación.
- Elegir y ordenar columnas; guardar vistas por usuario, restablecerlas y mantener aislamiento entre cuentas.
- Buscar por nombre, referencia, EAN e ID; filtrar marca, categoría y estado, y mostrar claramente si la consulta es completa o parcial.
- 20/50/100 registros, paginación, selección de página, selección individual, limpiar selección y exportar datos consultados o seleccionados.
- Abrir/editar ficha, iniciar copia a otra tienda y crear producto sin perder el contexto de filtros y página.
- No ocultar datos cortados ni producir listas interminables. Adaptación móvil real, no tabla de escritorio reducida.

## Ficha completa

- Foto de referencia visible constantemente, galería, identidad, tienda, referencia y estado.
- Pestañas ordenadas para Información, Descripciones, Precios, Variaciones, Imágenes, SEO, Transporte, Disponibilidad y Organización.
- Producto simple o con combinaciones. Campos nativos adicionales solo cuando correspondan al tipo, nunca desaparecidos sin explicación.
- Nombre, referencia propia y del fabricante, EAN/UPC/ISBN/MPN, nuevo/usado/reacondicionado y mostrar condición.
- Resumen y descripción con texto e imágenes, tablas de especificaciones, materiales y contenido del embalaje, con vista previa segura.
- Marca, proveedor y su referencia/precio, categorías múltiples, categoría padre y principal, características y valores, materiales, etiquetas y productos relacionados/accesorios.
- Idiomas propios de cada tienda, incluidos los instalados inactivos; conservar textos ajenos al campo que se está editando.
- Ayudas «i» específicas, una sola abierta, accesibles por ratón, teclado y toque; cierre fuera y Escape. Sin iconos flotando fuera de su campo.

## Precios y disponibilidad

- Coste de compra neto, precio del proveedor y moneda, precio de venta neto/bruto y grupo real de impuestos.
- Apoyo de Precio para simular márgenes, IVA y recargo; distinguir simulación de los impuestos reales de la tienda.
- Costes de PrestaShop son aproximados por el problema comunicado de redondeo de combinaciones; no etiquetar el margen calculado como beneficio neto fiable.
- Precio por unidad/unidad de medida, ecotasa, indicador de oferta y precios específicos: importe o porcentaje, impuestos del descuento, fechas, cantidad mínima, grupo/cliente/país/moneda cuando corresponda.
- Existencias por tienda y combinación, cantidad mínima, umbral/aviso de stock bajo, ubicación, permitir pedidos sin existencias y dependencia de stock cuando corresponda.
- Activo/inactivo, visibilidad catálogo/búsqueda/oculto, mostrar precio, permitir compras, solo online, fecha y textos de disponibilidad.
- No confundir existencias del proveedor con las propias; tampoco sumar el registro padre y sus combinaciones dos veces.

## Variaciones

- Tabla editable con grupos/valores por nombre: color, capacidad u otros reales, referencia, EAN, coste, precio proveedor, impacto de precio (no PVP), peso, mínimo, disponibilidad, predeterminada, stock e imagen asociada.
- Crear una variación en una ficha existente sin crear de nuevo la base ni sustituir las anteriores. Conservar cantidades, imágenes y predeterminada no modificadas.
- Seleccionar todas/ninguna, por combinación y por campo; cambios masivos revisables.
- Evitar duplicados por referencia y conjunto de atributos. No inventar colores, EAN o disponibilidad.

## Imágenes y transporte

- Fotos aportadas por Diego o de la URL autorizada del proveedor; nunca generar imágenes nuevas del producto.
- Portada, galería, orden, ampliación, reemplazo y vinculación por variante con vista previa.
- Preparar fondo transparente y lienzo uniforme conservando el artículo completo. Tamaño tomado de los tipos de imagen configurados en la tienda, no una recomendación universal inventada.
- Nombres y leyendas adaptados a la tienda. Las leyendas localizadas deben distinguirse de los metadatos realmente admitidos por el cargador.
- Si la eliminación de fondo no es fiable, mostrar revisión pendiente; no afirmar que un JPEG renombrado es transparente.
- Peso kg, ancho/alto/profundidad cm, distinguir dispositivo y embalaje, suplementos de transporte, tipo de plazo y textos con/sin existencias; opciones nativas de transportistas cuando estén disponibles.

## Copia entre tiendas

- Dos fichas paralelas con sus imágenes. Cambiar origen/destino explícitamente; distinguir crear nuevo de actualizar existente.
- Seleccionar TODO/NINGUNO, por grupo y por campo; incluir variantes e imágenes. Persistir selección y borrador al cambiar pestaña.
- Revisar qué existe ya por referencia/EAN y qué difiere, sin duplicar productos.
- Mapear por nombres los registros reales de cada destino: idiomas, marca, proveedor, categorías/árbol, impuestos, características, etiquetas y atributos. NUNCA copiar IDs de origen como si fueran de destino.
- Permitir adaptar manualmente los campos no copiados y el SEO. No inventar reglas comerciales, nuevos EAN, prefijos o precios automáticos.
- Paso claro «Copiar selección a borrador» y después revisión y creación/actualización en la tienda elegida.
- No trasladar stock físico de una tienda a otra de forma implícita. Cantidades y publicación requieren elección explícita.

## Alta manual, URL y ChatGPT

- Un único modelo de ficha para crear a mano, copiar o partir de URL; no sistemas incompatibles.
- Alta rápida con URL, tienda(s), marca/proveedor si faltan, coste neto, PVP bruto, EAN, medidas/peso, cantidades por color, variantes y fotos necesarias. Pedir solo datos no acreditados; nunca inferirlos de una fotografía.
- Mismos precios en ambas tiendas cuando Diego lo indique, convertidos con los impuestos reales sin confundir bruto y neto.
- ChatGPT convencional debe ejecutar mediante su propia cuenta vinculada y las operaciones de Productos. Preparar y copiar un encargo no equivale a haber creado el producto ni a tener una API de ChatGPT contratada.
- Ficha y descripción visual completas con las imágenes autorizadas, SEO propio por tienda, todas las variantes acreditadas y todos los datos posibles de la fuente.
- No pedir al usuario que interprete o pegue XML/JSON para trabajar. Si el recorrido necesita importar datos, ofrecer formulario y revisión comprensibles.
- Prueba comercial actual delegada a ChatGPT: Argus P3 1500 mAh Voopoo, https://vaperalia.es/voopoo/argus-p3-1500mah-voopoo-15303.html, ambas tiendas y sus variantes; precios publicados, iguales en ambas según Diego.

## Guardado, trazabilidad y verificación

- Preparar → revisar campos/relaciones/diferencias → confirmar → guardar por etapas → releer resultado.
- Progreso verificable de base, variantes, stock, precios, imágenes y publicación; errores explicados y posibilidad de reanudar.
- Conservar solicitudes e identidad. No repetir altas inciertas, cambiar referencias o alterar diarios para forzar una operación.
- Producto visible en listado administrativo (`state=1`) es independiente de activarlo para compra pública.
- Conservar permisos de usuario y la estabilidad de los módulos existentes. No dar acceso nuevo a terceros por diseñar una pantalla.
- Historial real de operaciones y pendientes. Acciones de eliminación requieren el flujo de confirmación y permisos correspondientes; una maqueta no borra datos.
- Playwright comprobará recorridos, resultados, persistencia, aislamiento entre usuarios y medidas 390/768/1440. El contraste visual usará las mismas pantallas de Stitch.

## Entrega exigida a Stitch

Una consola navegable del módulo íntegro, no una imagen de una pestaña. Todas las zonas y pasos anteriores accesibles; estados de carga/vacío/error/pendiente. Exportación de HTML/CSS/JS originales y matriz de cobertura de cada requisito. Si una parte requiere otra pantalla, generarla sin omitirla. Codex no continuará la integración por fragmentos mientras esta propuesta esté incompleta.
