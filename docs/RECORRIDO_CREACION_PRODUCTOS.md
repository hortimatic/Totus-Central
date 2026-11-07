# Recorrido de creación de productos desde Totus Central

## Regla de identidad y tienda
ChatGPT opera con su propia cuenta vinculada y los permisos asignados. La conexión de tienda es un servicio, no un usuario de chat. Cada operación indica tienda, conexión y revisión; los identificadores de relaciones nunca se trasladan entre tiendas.

## Recorrido obligatorio
1. Consultar el perfil de creación y los catálogos de la tienda elegida. El inventario de idiomas del perfil y el de la validación deben ser idénticos; no deducirlos del esquema en blanco, que puede mostrar solo el idioma predeterminado.
2. Completar ficha y traducciones, categoría principal y asociadas, impuestos, proveedor, marca y características con los registros reales de destino. Validar nombre y referencia antes de reservar ninguna escritura. PrestaShop no admite < > ; = # { } en nombres.
3. Las imágenes proceden exclusivamente de archivos o una URL suministrados por Diego. No generar, buscar ni reemplazar imágenes por iniciativa propia. Una imagen ausente es una etapa pendiente que debe declararse.
4. Prevalidar sin escritura. Conservar la ficha exacta, la huella devuelta y un identificador estable de solicitud. La confirmación autoriza una sola creación inicialmente inactiva.
5. Enviar la creación una sola vez. Totus relee la referencia, textos, precio, categoría y campos solicitados antes de confirmar el ID. Una respuesta HTTP correcta no sustituye esta lectura.
6. Si la respuesta es incierta: conservar identificador y referencia. Comprobar primero el resultado. Si existe y coincide, recuperarlo sin otro POST. Si no existe, solicitar recuperación explícita mediante retry_absent:true con una huella recién preparada. El servidor comprueba la ausencia dos veces, conserva identidad y referencia y registra las firmas anterior y nueva en el historial. Una reserva en curso, completada, con ID o de otra cuenta no se puede sustituir. No borrar diarios, cambiar de cuenta o inventar otra referencia para sortear este paso.
7. Tras acreditar el ID, completar las etapas independientes: combinaciones con atributos de destino, imágenes proporcionadas, existencias, proveedores, precios y finalización. Cada etapa tiene identificador estable y lectura posterior; una etapa confirmada no vuelve a enviarse.
8. Verificar el resultado final por lectura: nombre, idiomas, relaciones, cuatro combinaciones para esta prueba, imágenes cuando se aporten y existencias cero. Guardar state=1 y el tipo derivado de las combinaciones reales. Para estas muestras: active=0, available_for_order=0 y visibility=none. No publicar ni permitir compras sin otra instrucción.
9. Repetir el recorrido de forma independiente en la segunda tienda. No reutilizar sus IDs, idiomas, moneda, atributos ni huellas.

## Entrega exigida
Por tienda: ID y referencia del producto, IDs de combinaciones e imágenes, resultado de las relecturas y etapas pendientes. No declarar completo si falta una etapa ni confundir una propuesta o prevalidación con un producto creado.

## Corrección preparada
Esta revisión incorpora validación anticipada del nombre, inventario coherente de idiomas y recuperación de contenido corregido con historial de firmas y control de concurrencia. Su publicación y las pruebas reales se registrarán en la entrega; este documento por sí solo no acredita que esté desplegada.
