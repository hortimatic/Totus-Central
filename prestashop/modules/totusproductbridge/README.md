# Totus · precios unitarios por API

Módulo separado para PrestaShop 1.7.8.x y 8.x. No sustituye archivos del núcleo, no crea endpoints ni almacena claves. Usa los hooks anteriores al guardado de Product únicamente cuando el script ejecutado es el dispatcher oficial del Webservice y el método es POST/PUT/PATCH.

La API recibe `unit_price_ratio`. ProductCore vuelve a calcularlo desde `unit_price` al guardar. En altas, este último puede permanecer en cero y sobrescribir el dato solicitado. El módulo sincroniza el valor derivado antes del guardado. También conserva el ratio cuando se modifica el precio por API. Las ediciones manuales del administrador y las lecturas GET quedan excluidas.

Instalar el ZIP mediante el gestor de módulos de cada tienda, después de autorización y de probarlo en su versión de PrestaShop. La desinstalación usa la gestión normal de módulos; no borra productos ni datos comerciales. No requiere nuevos permisos ni recursos de la clave Webservice. Verificar siempre por GET el precio, la unidad y el ratio guardados. Para PrestaShop8 debe repetirse la prueba de integración en esa versión antes de usarlo allí; la prueba automatizada actual utiliza1.7.8.11.

Referencia del comportamiento nativo: https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/Product.php (`getFieldsShop`, `updateWs`).
