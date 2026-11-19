# Alta de productos desde el mostrador: base de integración

17/11/2026. Trabajo local, no desplegado ni disponible en el mostrador.

Se reutilizan los escritores oficiales de Productos y sus diarios de idempotencia. El nuevo diario de TPV guarda la ficha preparada y el progreso; PrestaShop conserva la autoridad sobre productos, combinaciones, imágenes, proveedores y existencias. La disponibilidad se cambia al terminar todas las etapas solicitadas. Una respuesta perdida conserva el identificador original y se contrasta mediante el diario del escritor; no se genera otra alta.

El contrato admite categoría, marca, proveedor, impuestos, referencia, EAN, descripción, precio y coste con seis decimales, unidades, seis imágenes PNG preparadas y hasta cien combinaciones con precios y unidades propios. Se comprueba que una combinación no repita valores del mismo grupo. El servidor inspecciona los PNG con el validador común existente; no basta con la extensión del archivo.

El transporte liga todas las consultas y escrituras al establecimiento nativo asignado mediante `id_shop`. Rechaza el contexto global, grupos, otro establecimiento y otro origen. Las consultas de existencias también filtran la tienda. Esta restricción resulta especialmente relevante para el aviso [GHSA-3f36-4qv4-vfgh](https://github.com/PrestaShop/PrestaShop/security/advisories/GHSA-3f36-4qv4-vfgh), que afecta a la versión 8.2.8 del laboratorio. No se ha actualizado el núcleo ni ejecutado una prueba de explotación remota.

La respuesta destinada al navegador excluye imágenes codificadas, contenido de las escrituras, huellas internas, identidad del actor y testigo de bloqueo. El diario SQL exige permisos actuales, identidad, conexión, establecimiento y caja; permite leer el trabajo sin caja abierta y continuarlo tras una nueva apertura autorizada. Solo se cancela antes de crear una ficha nativa.

## Comprobaciones

- Suite SQL aislada: 390 aserciones aprobadas, incluidas recuperación de bloqueos, resultados tardíos, permisos, límite de trabajos y cambio de sesión de caja.
- Contrato y coordinación: diez pruebas aprobadas. Incluyen precisión decimal, compatibilidad con los validadores reales de Productos, respuesta perdida, confirmación local perdida, recuperación sin repetir la escritura de una etapa, separación de tienda y exclusión de datos internos.
- Las pruebas de coordinación usan dobles de transporte y diario. No acreditan una creación real de producto ni la integración del formulario.

## Trabajo abierto

Conectar las acciones autenticadas del servicio, revisar sus permisos y paquete de despliegue, completar el formulario de mostrador, probar el proceso con PrestaShop nativo aislado y después con la preproducción autorizada. Quedan pendientes la experiencia con cámara/imágenes, metadatos y precios con impuestos, pruebas de escritorio y móvil, documentación de uso y activación coordinada. TPV-06 permanece abierto. No se ha publicado una interfaz ni modificado producción.
