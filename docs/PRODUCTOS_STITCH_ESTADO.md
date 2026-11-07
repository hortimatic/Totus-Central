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
- 70 comprobaciones unitarias de Productos cubiertas en esta rama.

## Pendiente antes de poder decir «idéntico y completo»

1. Contraste visual por captura de **cada** vista y subvista con el original,
   con iguales medidas y un conjunto de datos comparable. Los estilos reutilizados
   y las pruebas de navegación no acreditan por sí solos igualdad visual.
2. Contrastar la experiencia completa de la cola de copias múltiples con datos
   reales. La selección admite varias fichas y mantiene sus solicitudes, pero
   la confirmación de cada tienda sigue siendo individual y explícita.
3. Conectar edición de organización, relaciones y atributos nuevos sobre fichas
   existentes. El alta ya mapea relaciones; no atribuir ese soporte a toda edición.
4. Completar controles de orden, sustitución y eliminación de imágenes,
   y eliminación de combinaciones. No sustituir
   controles faltantes por avisos que simulen una operación correcta.
5. Revisar la cola completa de borradores e historial frente a las tarjetas del
   prototipo; la aplicación actual conserva las solicitudes por cuenta/tienda,
   no debe mostrar tres borradores ficticios.
6. CI completo y contraste con datos reales de ambas conexiones. Los nuevos
   campos de lectura y filtros de existencias requieren desplegar el servicio.

No se han modificado productos, ventas, facturas, existencias, permisos ni
servicios de producción mediante estas pruebas. Las simulaciones usan transporte
ficticio en un servidor local.

## Creación real delegada a ChatGPT (separada de las pruebas de interfaz)

ChatGPT ha informado de cuatro fichas del Argus P3: Hortimatic 170807056 y
170807057; NewOldSmok 170807254 y 170807255. Ha propuesto conservar las segundas,
pero esta anotación **no acredita una relectura independiente ni un borrado**.
Faltan imágenes y un valor de atributo en Hortimatic. No presentar esta creación
como terminada ni crear más bases para resolver sus etapas pendientes.
