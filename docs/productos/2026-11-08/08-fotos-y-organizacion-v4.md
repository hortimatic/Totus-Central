# Productos: fotografías y organización V4

## Uso

- Las fotos de catálogo se muestran a 68 × 68 px, manteniendo su proporción. Al pasar el cursor o enfocar la foto aparece una ampliación dentro de la pantalla. En móvil se abre al tocar; se cierra con el botón, Escape o fuera de la imagen.
- Foto y nombre permanecen fijos al desplazar columnas. En móvil el nombre ocupa menos ancho y puede repartirse en varias líneas. El margen final de la tabla permite acceder a las acciones sin quedar debajo de las columnas fijas.
- «Ver en la web» abre una pestaña independiente en la tienda de esa fila o ficha. Usa el ID nativo, por lo que no depende de adivinar una URL amigable. Un producto inactivo puede no estar disponible públicamente. Un borrador sin ID no ofrece un enlace ficticio.
- La cabecera reúne tienda, estado de conexión y cinco pestañas. No repite grandes indicadores. Las nueve secciones de ficha continúan disponibles.
- La foto lateral queda proporcionada: 200 px en escritorio y una banda de 120 px junto al resumen en pantallas menores. Los botones de revisión y borrador están juntos en la cabecera, sin duplicarlos bajo la foto.
- Los campos adicionales de información, SEO, transporte, disponibilidad y precios se muestran sin abrir otro desplegable. La configuración de columnas y las acciones secundarias conservan sus menús accesibles.

## Diseño y alcance

La entrega íntegra de Stitch V4 está conservada en `design-reference/stitch-products/console.v4.original.html`, con su huella en `provenance.v4.json`. La cabecera y navegación se extraen mediante `scripts/extract-stitch-products-v4.py`; se eliminan sus manejadores de demostración. Las operaciones reales continúan enlazadas a los circuitos nativos existentes.

Esta revisión aplica la cabecera original V4 y su jerarquía compacta a los controles funcionales existentes. No se declara una reproducción píxel a píxel de todas las vistas V4. No se instala software ni se cambia configuración en las tiendas. No cambia el servicio, la base de datos ni los permisos.

La configuración visual se aplica al marco exterior y los colores; los grupos internos utilizan divisiones finas para evitar múltiples bordes gruesos y sombras superpuestas.

## Comprobación

Pruebas de fotos en 390, 680 y 1200 px: tamaño, ampliación, límites de pantalla, foco, Escape, toque, cierre y retirada de manejadores. Recorridos del módulo: catálogo completo y paginado, edición y relectura, copia con variaciones, alta, imágenes y acciones existentes. Son simulaciones aisladas; sus escrituras no son pruebas comerciales reales.

Se conserva aparte la evidencia comercial previa de copia con dos fotos y tres variantes: NewOldSmok #170807258, con referencia QA-FOTOS-N-20261108. Este documento no convierte esa prueba anterior en una nueva prueba real de todos los circuitos.

## Límites nativos que se mantienen visibles

La API de PrestaShop 1.7 no permite prometer todas las operaciones de orden y textos ALT de la galería principal. El borrador de Totus diferencia esos datos locales de los efectivamente guardados y releídos. Costes y márgenes siguen identificados como aproximados. No se presentan imágenes inexistentes ni datos de demostración como datos de tienda.

## Revisión adicional de ventanas y menús

Se corrigió la ventana de textos de imagen, que se montaba fuera del módulo y perdía sus estilos. Las vistas previas y la edición de textos ahora usan un cierre común: Escape, botón, pulsación fuera y devolución del foco. Cerrar una foto también retira la ampliación flotante anterior. Los menús se cierran al desplazar con rueda o toque, al pulsar fuera, con Escape o al redimensionar, sin confundirse con el desplazamiento automático que necesita el navegador para alcanzar un botón.

La matriz ampliada añade 390 × 500, 390 × 900, 680 × 660 y 1440 × 900. Comprueba límites de ventanas y menús, flechas de columnas, las nueve secciones, ayudas solo desde el icono, cancelación sin guardar, textos locales, selección de portada, variante predeterminada, existencias, organización, fotos por variante, eliminación confirmada, sustitución, arrastrar fotos, atributos, impuestos y margen. El informe estructurado se guarda como `qa-artifacts/productos-existing-actions-report.json`; son operaciones simuladas.

Se corrigió también la caché de publicación: `productos.css` y sus importaciones locales reciben el identificador de la versión. `tests/productos-release-cache-qa.py` ejecuta el ensamblado real de publicación en una carpeta desechable y comprueba que tanto los estilos como los módulos nuevos se actualizan juntos, sin incluir pruebas ni código de Supabase en la web publicada.

La navegación con Inicio/Fin comprueba también el botón de destino: Fin muestra las acciones finales, sin llevar al margen vacío que permite despejarlas de las columnas fijas. La prueba exige que «Abrir ficha» quede dentro de la zona visible y fuera de la identidad fijada.
