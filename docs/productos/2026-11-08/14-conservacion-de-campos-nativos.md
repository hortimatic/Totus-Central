# Conservación de campos nativos al modificar productos

El contraste independiente de ChatGPT señaló un cambio no solicitado de date_add en un producto QA. El código oficial 1.7.8.11 confirma que WebserviceRequest pone a null campos opcionales omitidos durante PUT; ObjectModel rellena una fecha de creación nula con la fecha actual. Una selección limitada a los campos editables no es suficiente para preservar el resto del producto.

La corrección consulta el esquema nativo de la tienda para construir la lectura de conservación: incluye campos opcionales no editados y asociaciones, excluye campos calculados/no escribibles y existencias derivadas. El XML continúa procediendo exclusivamente de la tienda. El cliente no puede añadir campos arbitrarios ni aportar XML. La actualización cambia solo los campos solicitados sobre esa lectura completa. La finalización utiliza el mismo procedimiento.

Prueba nativa aislada: preparar un producto con imágenes y combinaciones, fijar mediante su API una fecha histórica y valores de personalización, ejecutar finalización, cambios de publicación y edición de precio, y comprobar que fecha y campos no seleccionados permanecen. La prueba nunca apunta a las tiendas comerciales.

Fuentes primarias de la semántica: [WebserviceRequest 1.7.8.11](https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/webservice/WebserviceRequest.php) y [ObjectModel 1.7.8.11](https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/ObjectModel.php).

Separar ese hallazgo de type/product_type: [Product::getWsType](https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/Product.php) clasifica simple/pack/virtual; product_type distingue standard/combinations. Que un producto tenga type=simple y product_type=combinations no demuestra una inconsistencia. Se verifican las combinaciones reales, sus atributos y su predeterminada.

El resultado comercial del contraste de ChatGPT se conserva aparte de las pruebas simuladas y aisladas. No declarar corregida una tienda comercial antes del despliegue y la relectura de un QA.

El renderizador de esquemas de 1.7.8 puede devolver HTTP 500 por asociaciones vacías. Solo cuando la cabecera PSWS-Version identifica esa familia se usa la lista completa de campos y asociaciones de su definición oficial, conservando valores mediante GET nativo. No se inventan datos ni se utiliza esa alternativa para versiones desconocidas. Las pruebas comprueban también ese fallo de esquema.
