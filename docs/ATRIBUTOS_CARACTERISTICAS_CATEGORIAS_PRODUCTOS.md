# Organización y variaciones de Productos

## Qué corresponde a cada apartado
- **Organización → Categorías**: busca por nombre o ruta en todas las categorías de la tienda. Marca las asociadas y una principal. La búsqueda no se limita a la página visible. Mostrar permite 10, 20, 50, 100 o todas.
- **Organización → Características y materiales**: propiedades del producto completo (Material, Capacidad…). No crean combinaciones. Crear característica y Crear valor guardan registros compartidos únicamente en la tienda seleccionada; tras verificar el ID por relectura aparecen en los selectores.
- **Variaciones y atributos**: opciones de compra (Color, Talla…). Se elige un valor por grupo con los ID reales de la tienda. Gestionar atributos permite consultar y editar el catálogo compartido y sus productos asociados.

## Recorrido humano y de ChatGPT
1. Entrar con la cuenta propia autorizada y seleccionar tienda y producto. No reutilizar ID de otra tienda.
2. Consultar los catálogos nativos antes de crear. Reutilizar un nombre/valor existente cuando corresponda.
3. Si falta una característica o atributo, crear su registro y valor desde la acción del apartado. Revisar y guardar en la tienda. Esperar confirmación y relectura; no repetir una operación incierta.
4. Elegir los valores nuevos en la ficha. La creación del catálogo no asigna automáticamente el valor al producto.
5. Para características/categorías, pulsar **Revisar y sincronizar organización**, validar y **Guardar y sincronizar**. Se verifica la asociación completa, sin cambiar ventas, existencias ni visibilidad.
6. Para una combinación existente, **Editar atributos**, seleccionar los valores e imágenes y guardar. Las imágenes ya vinculadas se conservan si no se cambian. No se permite otra combinación con la misma selección exacta.
7. Para una combinación nueva, **Añadir combinación**, seleccionar sus atributos reales, referencia, EAN, precio, coste y demás datos. Revisar, guardar y releer el ID creado.
8. La publicación del producto se gestiona con **Publicar en PrestaShop**, diferenciada de guardar sus datos. Historial permite consultar las operaciones y su verificación.

## Alcance técnico
API oficial de PrestaShop: product_options, product_option_values, product_features, product_feature_values y asociaciones de products/combinations. Sin complementos, modificaciones del núcleo ni esquema SQL. Se mantiene autenticación, permisos y diario de recuperación. Un fallo de refresco no convierte un guardado incierto en éxito.

## Verificación
- Contratos y transporte: altas nativas tipadas, duplicados y relectura, conservación de campos ajenos.
- Playwright con transporte ficticio: 390×700, 969×680 y 1920×1080; creación de característica/valor, actualización del selector, conservación de categorías pendientes, asignación, modificación de combinación conservando imagen.
- La simulación de navegador no sustituye las operaciones reales del control PrestaShop 1.7.8.11 aislado ni la verificación posterior al despliegue.
