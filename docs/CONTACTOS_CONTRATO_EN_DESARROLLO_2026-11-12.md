# Contactos sincronizados: trabajo en desarrollo

Este documento no acredita una funcionalidad terminada ni publicada. La rama
`feat/contactos-sincronizados-20261112` contiene el contrato de campos y el
transporte de lectura; todavía no están conectados al despachador del servicio
ni a la interfaz. No se han realizado escrituras en tiendas o bases de datos.

## Separación de datos

- Clientes de Totus: conservar `ops_customers` y sus relaciones con Facturación.
- Proveedores fiscales: conservar `ops_suppliers` y sus relaciones con Gastos.
- Proveedores de Precio: conservar `providers`; no confundirlos con los fiscales.
- Marcas locales: conservar `brands` y las familias que las utilizan.
- Registros de PrestaShop: identificar siempre por tienda, recurso e ID. Un ID
  igual en dos tiendas no representa por sí solo a la misma entidad.

## Contrato preparado

Lecturas paginadas de clientes, proveedores, marcas, atributos y sus relaciones;
campos permitidos explícitos; validación de titular de direcciones y pedidos;
comprobación de conexión, tienda y revisión antes de emitir la petición; HTTPS
con transporte existente, límites de respuesta y rechazo de HTML de acceso.
Las contraseñas, claves de sesión y tokens de recuperación nunca forman parte
de los datos que recibe la interfaz. Se filtran incluso si la tienda los envía.

La operación autorizada debe resolverse en el servidor a partir del directorio:
Clientes → Facturación; Proveedores → Gastos; Marcas → Precio; Atributos →
Productos. El cliente no puede elegir otro módulo para ampliar sus permisos.

## Trabajo necesario antes de habilitarlo

1. Contexto de permisos de servidor y pruebas SQL aisladas para cada directorio.
2. Registro durable de operaciones, recuperación sin repetir altas inciertas y
   preparación/publicación/relectura con conservación de campos no editados.
3. Alta de clientes por API nativa sin exponer ni registrar contraseñas; probar
   el comportamiento de la versión exacta de ambas tiendas.
4. Direcciones y relaciones verificadas en la tienda elegida. Comprobar productos
   asociados antes de permitir eliminar atributos, valores, marcas o proveedores.
5. Tablas configurables, búsqueda completa, ficha, pedidos o productos asociados,
   selección de tienda y una acción de publicación clara con resultado verificado.
6. Guardado de preferencias de tablas y pruebas de separación por cuenta.
7. Pruebas de creación, modificación, errores, respuestas tardías y comparación
   posterior. Distinguir simulaciones, PrestaShop aislado y verificaciones reales.
8. Manual humano/ChatGPT y publicación acreditada antes de retirar accesos antiguos.

Pruebas actuales: siete casos locales de contrato y transporte, con respuestas
simuladas. No se consideran pruebas de sincronización completa ni de escritura.
