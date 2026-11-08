# Productos: copia completa y navegación estable

## Objetivo de esta ampliación
Cada pestaña, campo y botón debe identificar su destino, su efecto y el estado de guardado. La revisión se centra en Productos y sus recorridos reales; no cambia el resto de módulos ni instala componentes en PrestaShop.

## Recorrido de copia
1. Seleccionar el producto del catálogo. La copia incluye por defecto los campos disponibles y todas sus combinaciones; se pueden desmarcar individualmente. La selección de combinaciones queda visible.
2. Revisar las fichas de origen y destino. La adaptación reconoce Hortimatic / NewOldSmok sin depender de mayúsculas, tanto en nombres como en textos, etiquetas descriptivas y SEO. Las URLs de fotos solo se cambian cuando existe una imagen importada y verificada en destino.
3. Preparar idiomas y relaciones. Los idiomas se relacionan por código ISO, categorías por ruta y nombre, marca/proveedor/impuestos por coincidencia única y características por su pareja de característica y valor. Los relacionados se buscan por referencia exacta.
4. Elegir fotos, existencias, precios de proveedor/ofertas generales y estado de publicación. Las cantidades no se trasladan físicamente: es una copia explícita del valor. Si no se conserva estado, el nuevo producto queda inactivo.
5. Validar y crear la base. Se conserva una copia del origen y de los datos validados. Cambiar de pestaña o editar otro borrador no cambia la solicitud enviada.
6. Guardar la copia completa seleccionada: importar fotos, guardar combinaciones con los nuevos IDs de imagen y atributo, cantidades/precios opcionales y descripción final con enlaces de imagen ajustados. Se conserva la variante predeterminada y portada.
7. Cada paso utiliza su operación estable y se relee. El progreso se guarda localmente antes de enviar y después de verificar. Ante una interrupción se comprueba la misma operación y se conservan los pasos terminados.
8. Volver al catálogo y abrir la ficha creada. Los cambios posteriores se realizan sobre esa ficha.

## Correspondencias que requieren revisión
- No se trasladan IDs de categorías, proveedores, atributos, monedas o características entre tiendas.
- Las coincidencias ambiguas o inexistentes aparecen indicadas; el usuario puede elegir los registros de destino.
- Las ofertas restringidas a clientes, grupos, países, carritos o grupos de tienda concretos se indican como pendientes de correspondencia. No se convierten silenciosamente en descuentos generales.
- Los enlaces a otros productos o páginas internas no se sustituyen inventando una URL. Las fotos importadas y el enlace al mismo producto sí usan los nuevos identificadores.
- Orden y textos de la galería de trabajo de Totus no equivalen a modificar metadatos nativos no expuestos por PrestaShop 1.7. No se instala ningún módulo para ampliarlos.

## Comprobaciones realizadas
- 131 pruebas de lógica y contratos: creación, edición, combinaciones, imágenes, relaciones, lecturas y precios.
- Playwright: copia entre tiendas con atributos distintos, alta simple con combinaciones, edición y conservación de cambios entre las cinco pestañas a 390/768/1440 px.
- Simulación específica de copia completa: dos fotos, dos combinaciones, atributos e imágenes con IDs nuevos, portada, variante predeterminada y descripción adaptada.
- Interrupción provocada tras subir las fotos; restauración del borrador y continuación sin duplicar fotos ni operaciones terminadas.
- Fotos reconocibles, ampliación, teclado/móvil, ventanas, menús, tablas y paginación mediante los recorridos existentes.
- Los nuevos recursos de lectura (idiomas, precios de proveedor y ofertas) siguen siendo GET y verifican la pertenencia al producto solicitado.

## Estado
La versión anterior (PR #153, 272d25d5) está publicada y comprobada con sesión real. Esta ampliación tiene pruebas locales y está pendiente de controles remotos, actualización de totus-connections, publicación y una nueva copia de prueba real en destino. Una simulación no se presenta como una escritura real.
