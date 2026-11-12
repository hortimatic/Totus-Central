
## Verificación del bloque en desarrollo

Las altas se realizan desde Crear cliente/proveedor/marca. El botón de publicar prepara, envía y relee la ficha; un resultado incierto conserva la misma solicitud y no repite un POST a ciegas. No se copian contraseñas de clientes existentes. El servidor genera una contraseña aleatoria para el alta nativa, sin devolverla a la interfaz.

Pedidos consulta el historial del cliente en la tienda seleccionada, sus líneas y los costes actuales del producto o combinación. La venta incluye impuestos; el margen comercial utiliza ingresos de mercancía sin impuestos menos costes sin impuestos y no representa beneficio neto. Los pedidos no válidos se excluyen del total y cada moneda permanece separada. Si faltan costes se muestra la cobertura parcial. Productos consulta las asociaciones nativas de marcas/proveedores.

Eliminar pide confirmación, comprueba relaciones y verifica el resultado nativo. No permite borrar clientes con pedidos, marcas/proveedores con productos ni atributos usados. Los registros fiscales locales permanecen separados y conservados.

Comprobaciones realizadas: 32 pruebas de contratos, transporte, sesión, creación, edición, borrado y ventas; Playwright a 390, 768, 1017, 1440 y 1920 px para búsqueda completa, paginación, columnas, persistencia, alta, edición, pedidos y eliminación. Estas pruebas de navegador emplean API simulada y no acreditan escritura en tiendas reales. CI del commit eee47c3: tipos, PostgreSQL desechable y navegador correctos. Los parches 076/077 no están aplicados en producción y este bloque aún no está publicado.

Pendientes del bloque antes de entrega: edición completa de direcciones conservando las utilizadas en pedidos, grupos del cliente, proveedores secundarios, recorridos nativos aislados y comprobación real autorizada, además de integración y publicación. El resto del plan de 26 puntos y los puntos prioritarios 27/28 siguen abiertos según el registro general.

## Atributos independientes del producto

En Productos → Atributos elige la tienda y Atributos o Características. Crear atributo/característica no exige abrir un producto. Para añadir un valor, selecciona su grupo y pulsa Crear valor; el formulario propone ese grupo, que también puede elegirse de su catálogo real. Publicar en la tienda seleccionada crea/actualiza y relee el registro antes de actualizar la lista. Editar grupo o Editar valor permite corregir los textos, el tipo, la posición y los campos propios del recurso. Eliminar aparece dentro de esa ficha con permiso de borrado y comprueba primero las asociaciones; los valores utilizados no se eliminan.

El español se resuelve por el catálogo real de idiomas; el operador no introduce IDs de idioma. La conservación incluye las traducciones de los idiomas inactivos. En 1.7.8, si el generador nativo de esquemas falla con HTTP 500, solo se usa el contrato oficial de conservación después de comprobar la cabecera de versión. Nunca se inventan los valores actuales de la ficha.

El recorrido de clientes/direcciones/marcas/atributos del commit 8345cda ha superado el entorno nativo PrestaShop 1.7.8.11 desechable de GitHub (run 43249384276, job 131290698744). Esto acredita operaciones nativas aisladas, no escrituras en las tiendas de producción. El nuevo editor independiente tiene además pruebas de alta y edición con Playwright en cinco tamaños usando API simulada.
