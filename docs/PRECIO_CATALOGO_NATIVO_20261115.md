# Precio conectado al catálogo

Precio incorpora dos pestañas: Estudios de Totus conserva las consultas, proveedores, familias y fichas locales; Catálogo PrestaShop monta el mismo controlador y editor que Productos. Conserva sus filtros de marca, categoría y tienda, columnas, perfiles, edición rápida y publicación con relectura. Requiere lectura de Productos; las escrituras siguen exigiendo sus permisos y los del servidor. No duplica el catálogo en tablas locales ni instala servicios.

Para ajustar una familia: filtrar marca/categoría, seleccionar sus productos y pulsar Ajustar precios seleccionados. El lote permite precio base común o variación porcentual. Revisa cada huella nativa antes de escribir, muestra antes/después y publica secuencialmente mediante el editor existente. Son precios base sin IVA: conserva los impactos de combinaciones y ofertas. No promete un mismo PVP final para variantes con impactos diferentes.

Hasta 200 productos por revisión; un catálogo mayor se trabaja en lotes explícitos. La selección puede contener IDs coincidentes de ambas tiendas porque su clave incluye el origen. La aritmética usa seis decimales enteros y no acepta notación exponencial ni resultados fuera del intervalo permitido.

Si el precio cambió en la tienda después de leer el catálogo, se detiene la revisión sin escribir. Si una respuesta se pierde durante la publicación, se detiene el resto y se conservan las filas y su identificador de solicitud. Comprobar guardado abre la edición rápida existente para recuperar la misma operación. El guardado previo de la solicitud utiliza el mecanismo existente de invokeShop; no se añade otra capa de persistencia.

Pruebas con datos ficticios: revisión sin escrituras, dos productos publicados y releídos, cuadro en 390/768/1440/1920, respuesta perdida sin continuar el lote, recuperación con el mismo identificador, precio concurrente cambiado y permiso denegado. Las escrituras de esta prueba no se realizaron en tiendas reales. Este bloque requiere controles completos y publicación antes de considerarlo disponible.
