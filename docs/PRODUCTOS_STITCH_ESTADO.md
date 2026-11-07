# Productos · integración del original de Stitch

Estado de trabajo: **en rama de desarrollo; no publicado ni declarado completo**.

Referencia: consola `6572b3976ec14951908a50d400cbf949`, proyecto
`5869856515258186560`. El alcance completo permanece en
`PRODUCTOS_STITCH_ALCANCE.md`. Esta entrega no sustituye ese alcance.

## Conectado y comprobado localmente

- Plantillas y CSS originales del módulo guardados y generados de forma reproducible.
- Cinco pestañas principales y nueve apartados de ficha navegables.
- Catálogo real por tienda, fotografías, columnas configurables por usuario,
  filtros, selección de página, paginación y CSV con protección de fórmulas.
- Vista de ambas tiendas con claves compuestas por tienda e ID; los números
  coincidentes no mezclan fichas, relaciones, imágenes ni existencias.
- Selección múltiple conservada en una cola de revisión por producto; las
  solicitudes de cada ficha se conservan al abrir otra.
- Edición de campos, selección para copia y dos fichas con origen y destino explícitos.
- Encargo desde URL con los datos aportados, sin fingir una extracción automática.
- Guardado local por cuenta y conservación de borradores al cambiar de tienda.
- Etapas de imágenes y variantes sobre un producto existente, con identidad propia;
  no se repite su creación ni se cambia su combinación predeterminada al añadir otra.
- Precios y costes distinguidos de IVA; el PVP base para España solo se calcula si
  se comprueban país, regla e impuesto. Los casos territoriales o compuestos no se inventan.
- Recorrido completo simulado en 390, 768 y 1440: edición, combinación, lote,
  creación, existencias, imagen transparente, descripción visual y recuperación.
- Selección de portada y combinación predeterminada mediante revisión explícita,
  guardado y relectura; comprobada en simulación a 390 y 1440 píxeles.
- Vistas de catálogo con nombre, orden de columnas, filtros y contexto de tienda por cuenta.
- Recuperación de fichas conservadas y corrección del intercambio de tiendas.
- Disposición nativa de Información, Descripciones, SEO, Transporte y Disponibilidad,
  con campos adicionales plegados; herramientas de texto y vista previa aislada.
- Organización: revisión de categorías, principal, marca, proveedor e impuestos
  comprobada mediante simulación de API y navegador. Requiere desplegar el servicio.
- Matriz con nombres de atributos, existencias verificadas y fotos por combinación.
- Asociación de imágenes a combinaciones existentes, sin recrearlas.
- Eliminación de imágenes y combinaciones con confirmación escrita, identidad propia,
  comprobación de permisos DELETE, huella y relectura; sin repetir un borrado incierto.
- Normalización de imágenes al tipo configurado en la tienda, conservando el producto
  completo; la transparencia se comprueba antes de añadir márgenes al lienzo.
- 86 comprobaciones unitarias de Productos cubiertas en esta rama.
- Puente 1.1.0: orden y leyendas por idioma verificados contra PrestaShop 1.7.8.11
  aislado, con rechazo de intentos de cambiar producto o portada desde ese recurso.
- Sustitución nativa de fotos con el mismo ID: respuesta binaria contrastada con GET,
  galería y portada conservadas; respuesta perdida no provoca otra sustitución.
- Galería y dos fichas de copia restauradas con las tarjetas originales de Stitch;
  miniaturas de toda la galería, foto ampliada sin recorte y arrastre a revisión.
- Tarjetas originales de guardado con borradores de la cuenta y contadores de etapas;
  limpieza local de más de 30 días excluye cualquier operación enviada o incierta.
- Existencias existentes precargadas y total derivado de combinaciones conservado;
  ubicación y política sin existencias se gestionan en su registro de stock.
- Redirecciones SEO nativas con destino verificado en la misma tienda; los ID no
  se copian implícitamente entre tiendas. Contraste nativo aislado superado.

## Pendiente antes de poder decir «idéntico y completo»

1. Contraste visual por captura de **cada** vista y subvista con el original,
   con iguales medidas y un conjunto de datos comparable. Los estilos reutilizados
   y las pruebas de navegación no acreditan por sí solos igualdad visual.
2. Contrastar la experiencia completa de la cola de copias múltiples con datos
   reales. La selección admite varias fichas y mantiene sus solicitudes, pero
   la confirmación de cada tienda sigue siendo individual y explícita.
3. Creación de atributos y valores, características, etiquetas y accesorios:
   pruebas simuladas y nativas aisladas superadas. Las dos conexiones reales se
   comprobaron por lectura: 70 recursos nativos autorizados; falta el recurso
   propio de leyendas y orden de fotos hasta instalar el puente.
4. Instalar y autorizar el puente 1.1.0 en las dos tiendas reales después de los
   controles. Orden, leyendas y sustitución ya han pasado la prueba nativa aislada.
   La eliminación de imágenes y combinaciones
   ya está conectada y ha superado la prueba nativa aislada de PrestaShop 1.7.8.11.
   No sustituir controles faltantes por avisos que simulen una operación correcta.
5. Contrastar visualmente la lista de borradores recuperables y las etapas reales
   frente al prototipo. No mostrar borradores ni historiales ficticios.
6. CI completo y contraste con datos reales de ambas conexiones. Los nuevos
   campos de lectura, filtros de existencias y redirecciones requieren desplegar el servicio.

No se han modificado productos, ventas, facturas, existencias, permisos ni
servicios de producción mediante estas pruebas. Las simulaciones usan transporte
ficticio en un servidor local.

## Creación real delegada a ChatGPT (separada de las pruebas de interfaz)

ChatGPT ha informado de cuatro fichas del Argus P3: Hortimatic 170807056 y
170807057; NewOldSmok 170807254 y 170807255. Ha propuesto conservar las segundas,
pero esta anotación **no acredita una relectura independiente ni un borrado**.
Faltan imágenes y un valor de atributo en Hortimatic. No presentar esta creación
como terminada ni crear más bases para resolver sus etapas pendientes.

## Cierre de controles de la ficha (rama PR #144)

- Margen sobre venta y PVP desde el impuesto real; coste aproximado y coma decimal.
- Marca e impuestos seleccionables en la ficha, con revisión explícita parcial.
- Cambiar portada, marca, categorías o impuestos no envía descripciones ni indicadores
  de publicación ajenos a la selección. Una alta nueva sigue exigiendo esos indicadores.
- Cada campo genérico visible tiene contrato de escritura; stock y predeterminados
  usan sus acciones propias, no campos genéricos sin soporte.
- Capturas de las cinco vistas y nueve apartados, fuente y módulo, a 390/768/1440.
  Contraste de estilos activos y controles visibles. Las diferencias por datos,
  ayudas y pasos reales se conservan; no se afirma igualdad de píxeles universal.
- Aplicación completa con datos ficticios comprobada en 320/390/831/1440.
- CI del commit 3dbd663: 14 trabajos correctos. Incluye PrestaShop 1.7.8.11 real
  desechable: atributos, SEO, imágenes, variantes y recuperación. Los cambios
  posteriores de precio y guardados parciales requieren el siguiente CI.

Producción sigue en 3262132b. No se ha instalado el puente 1.1.0 ni desplegado
el nuevo servicio. Su ausencia impide usar orden y leyendas en las tiendas reales.
La compatibilidad nativa con PrestaShop 8 no está acreditada por estas pruebas.
