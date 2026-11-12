
## Verificación del bloque en desarrollo

Las altas se realizan desde Crear cliente/proveedor/marca. El botón de publicar prepara, envía y relee la ficha; un resultado incierto conserva la misma solicitud y no repite un POST a ciegas. No se copian contraseñas de clientes existentes. El servidor genera una contraseña aleatoria para el alta nativa, sin devolverla a la interfaz.

Pedidos consulta el historial del cliente en la tienda seleccionada, sus líneas y los costes actuales del producto o combinación. La venta incluye impuestos; el margen comercial utiliza ingresos de mercancía sin impuestos menos costes sin impuestos y no representa beneficio neto. Los pedidos no válidos se excluyen del total y cada moneda permanece separada. Si faltan costes se muestra la cobertura parcial. Productos consulta las asociaciones nativas de marcas/proveedores.

Eliminar pide confirmación, comprueba relaciones y verifica el resultado nativo. No permite borrar clientes con pedidos, marcas/proveedores con productos ni atributos usados. Los registros fiscales locales permanecen separados y conservados.

Comprobaciones realizadas: 32 pruebas de contratos, transporte, sesión, creación, edición, borrado y ventas; Playwright a 390, 768, 1017, 1440 y 1920 px para búsqueda completa, paginación, columnas, persistencia, alta, edición, pedidos y eliminación. Estas pruebas de navegador emplean API simulada y no acreditan escritura en tiendas reales. CI del commit eee47c3: tipos, PostgreSQL desechable y navegador correctos. Los parches 076/077 no están aplicados en producción y este bloque aún no está publicado.

Pendientes del bloque antes de entrega: edición completa de direcciones conservando las utilizadas en pedidos, grupos del cliente, proveedores secundarios, recorridos nativos aislados y comprobación real autorizada, además de integración y publicación. El resto del plan de 26 puntos y los puntos prioritarios 27/28 siguen abiertos según el registro general.
