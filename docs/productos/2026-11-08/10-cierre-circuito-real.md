# Cierre del circuito real de copia

La publicación PR154 está en producción (4db31eb8), con totus-connections v34. Hortimatic se amplió de 1000 a 1500 peticiones por autorización expresa, se comprobó HTTP 200 y se reactivó con la misma clave.

## Muestra real conservada
- Origen Hortimatic: Argus P3 #170807057, siete combinaciones y seis fotos.
- Destino creado en NewOldSmok: #170807259.
- Referencia: QA-COPIA-ARGUS-N-20261108.
- Solicitud estable: 04095e12-03c6-4cbd-945f-c5e8ecd974ad.
- Estado: inactivo, sin permitir compras, existencias cero. No se ha repetido el alta.

## Hallazgos y correcciones
1. Actualizar catálogo vuelve a consultar la revisión de la conexión tras cambiar una cuota en otra pestaña.
2. Las lecturas de idiomas y precios admiten el permiso existente de Productos cuando el usuario no tiene acceso al módulo PrestaShop. Sin permiso de lectura no se accede a las credenciales.
3. Escribir un dato y pulsar Validar/Guardar no debe sustituir el botón durante el evento de pérdida de foco. Se conservan los campos y solo se actualiza el estado de los controles. La confirmación CREAR habilita su botón mientras se escribe.
4. NewOldSmok guarda el mismo HTML con cierres XHTML de elementos vacíos. La muestra enviada tenía 5094 caracteres; la guardada 5118. Las doce diferencias son únicamente cierres de br e img. Todos los textos, atributos y URLs coinciden. Se admite exclusivamente esa equivalencia de sintaxis en las comprobaciones de alta, edición y etapas; no se admite pérdida de imágenes, enlaces, texto o tablas. No se alteran la firma ni la solicitud de la operación pendiente.

## Comprobaciones
- Prueba de endpoint: tres recursos, usuario con permiso de Productos y usuario denegado; las credenciales solo se consultan para el permitido.
- Playwright: conexión de revisión 1 a 2; lecturas actualizadas sin escrituras.
- Playwright: editar y pulsar Validar directamente; habilitar Crear sin salir del campo de confirmación.
- Contrato HTML: igualdad de cierre, atributo con > entre comillas, rechazo de cambios de URL/texto/atributos, etiquetas ausentes y contenido literal.
- Recuperación de alta incierta por dos GET y el mismo diario, sin POST.
- El caso inicial de alta en PrestaShop 1.7.8.11 aislado incluye ahora br e img con serialización HTML.

## Pendiente de producción
Controles remotos de esta corrección, actualización del servicio y recuperación de la muestra existente. Después se completarán sus imágenes y combinaciones, con relectura real. No se declara terminada esa copia hasta verificarla.

## Catálogo y copia: revisión de uso
- Buscador en su propia fila y filtros que se ajustan al ancho disponible del módulo.
- Control horizontal superior continuo, accesible con teclado y sincronizado con la tabla; se conservan las flechas; todas las columnas se desplazan juntas, sin columnas inmovilizadas ni espacios reservados. No añade desplazamiento vertical anidado.
- Coste base, coste con IVA, coste con IVA y RE, precio base, PVP y diferencia PVP menos coste total. El recargo es editable; la fórmula suma IVA y RE sobre la base, sin componerlos. Si falta coste o impuesto verificado no se inventa un resultado. No se presenta como beneficio neto.
- La vista predeterminada anterior incorpora las columnas nuevas; las vistas personalizadas se conservan.
- Fichas de copia con foto principal de 112 px, galería de fotos nativas y recuentos de fotos/combinaciones. El destino solo muestra imágenes existentes, nunca una copia ficticia de la foto de origen.
- Playwright verifica búsqueda sin desbordamiento y control horizontal con Home/End en 390, 768 y 1440 px. Selectores, galerías, ayudas y acciones existentes también pasan en 390, 680 y 1440 px.

## Prueba comercial solicitada
La bandeja Hortimatic #170807053 se ha localizado mediante Totus: Bandeja Metal Mario Jump 18x14 cm, referencia BANDEJA-MARIO.JUMP, coste base 1,90 €, PVP 6 €, sin combinaciones. Copia todavía en preparación: no se declara terminada hasta comprobar la imagen nativa y todos los campos en NewOldSmok.
