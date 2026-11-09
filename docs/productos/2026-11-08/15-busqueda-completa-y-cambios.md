# Buscadores y Cambios

Los buscadores de Catálogo, Producto y Copiar consultan en el servidor de la tienda por nombre, referencia, EAN o ID, sobre todo el catálogo. Solo cargan páginas de coincidencias. Mostrar permite 10, 20, 50, 100 o Todos; Todos consulta las páginas restantes de forma explícita. Las lecturas auxiliares se reutilizan durante la sesión, sin repetirlas al cambiar de pestaña o término. No cambian las escrituras de productos.

Referencia del filtro nativo y paginación: https://devdocs.prestashop-project.org/1.7/webservice/tutorials/advanced-use/additional-list-parameters/

Limpiar búsqueda vacía el buscador de Producto/Copiar; Limpiar búsqueda y filtros restablece Catálogo. Ninguna acción escribe en PrestaShop.

Cambios separa borradores locales, propuestas y operaciones registradas. Las ayudas explican cada estado. Descartar propuesta elimina la propuesta calculada; no elimina el producto ni su historial. Limpiar selección vacía las casillas del catálogo. La limpieza de borradores antiguos conserva las operaciones enviadas.

Las cabeceras no incluyen aprox.; la ayuda sigue explicando las limitaciones del coste de origen. La retirada de una palabra no cambia la precisión de los datos.

ChatGPT debe seguir el protocolo de identidad del manual 12: verificar su propia cuenta antes de operar; nunca elegir otra IA ni una cuenta predeterminada.

Cada borrador sin solicitudes enviadas permite eliminarse individualmente con confirmación. Los registros con operaciones enviadas conservan su historial. El borrado local no borra productos de la tienda.

El listado general completa su lectura en segundo plano sin dibujar todas sus filas. La paginación controla los elementos visibles; el número de página permite saltar directamente. Producto y Copiar tienen su selector incluso sin ficha seleccionada. Una búsqueda cancela la precarga anterior y consulta toda la tienda mediante filtros nativos. Las respuestas de una precarga cancelada no sustituyen el resultado actual.

Copiar tiene una sección visible propia de Variaciones y un acceso desde sus apartados. Seleccionar todas / Limpiar variaciones modifica solo esa selección; no los campos del producto ni sus fotos. Se mantiene el recorrido validado de correspondencias y guardado. La referencia se muestra una sola vez cuando su columna está activa.

Columnas opcionales: Creado (fecha y hora nativas), Actualizado (fecha y hora nativas), Usuario creador. El usuario procede exclusivamente de la solicitud completada de creación de Totus. Sin registro se muestra No registrado; antes de consultar, Sin consultar. No se deduce el autor de la cuenta que abre la ficha. El acceso de solo lectura 072 exige permiso de visualización de Productos y limita la consulta a los ID de la tienda solicitada.

Caché en memoria de sesión por cuenta y tienda, comprobando la revisión de conexión. No hay renovación temporizada. Volver al módulo muestra la caché y la contrasta en segundo plano con la tienda. Las pestañas reutilizan la misma información sin volver a cargarla. Actualizar fuerza una lectura; escribir invalida la tienda afectada y cambiar de usuario elimina la caché. Los borradores están separados de la lectura de catálogo. No se guardan claves.
