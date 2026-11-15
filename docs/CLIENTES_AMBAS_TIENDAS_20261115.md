# Clientes de ambas tiendas

La opción «Ambas tiendas» del directorio Clientes también está disponible desde Facturación. Lee cada tienda con su sesión autorizada y conserva sus identificadores, idiomas y direcciones por separado. Dos clientes con el mismo ID nativo siguen siendo dos registros independientes. El CSV identifica la tienda.

Abrir una ficha, sus direcciones o sus ventas cambia primero al origen correspondiente y utiliza su editor existente. Crear exige escoger la tienda. No existe una escritura conjunta ni se fusionan clientes. Los permisos del directorio siguen siendo obligatorios.

Una tienda inaccesible se indica expresamente y no oculta los resultados de la otra. Las respuestas tardías no sustituyen la vista después de cambiar de origen o cuenta. La selección «Ambas» se recuerda localmente por cuenta; las preferencias de columnas mantienen el contrato existente del servidor.

Validación simulada: `combined-customers-browser-qa.mjs` comprueba IDs coincidentes, idiomas, direcciones, búsqueda, selección y CSV, edición y relectura en el origen correcto, creación, permisos, fallo parcial, respuesta tardía y anchos 390/768/1440/1920. `contact-directory-browser-qa.mjs` conserva el recorrido individual en cinco tamaños. Estos resultados no equivalen a escrituras reales en las tiendas.

El retorno del formulario de conexiones utiliza la misma barra superior que los demás registros. La prueba de desplazamiento de tablas espera conjuntamente el desplazamiento y la actualización del botón; mantiene la comprobación del regreso efectivo.

Estado de este bloque: implementación local; pendiente de controles remotos y publicación. No modifica servicios, configuración ni datos reales de PrestaShop.
