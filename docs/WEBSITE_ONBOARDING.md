# Conectar y retirar webs independientes

## Alta desde Totus
1. Administración de la tienda: habilitar el Webservice nativo y una clave con los recursos y métodos necesarios. No instalar complementos ni modificar el núcleo.
2. Totus → APIs → crear conexión PrestaShop. Usar la dirección HTTPS terminada en /api/ y guardar la clave en el campo protegido.
3. Probar la conexión y autorizar los datos reales; activar cuando la comprobación sea correcta.
4. Abrir «Tienda y módulos»: nombre visible, estado, negocio físico opcional y participación en totales. Una web nueva queda fuera de los totales consolidados por defecto.
5. Entrar en Productos, PrestaShop, Ventas y directorios: la web se obtiene del registro común, sin añadir nombres al código. Las opciones se actualizan al entrar en los módulos.

## Identidad y aislamiento
La clave de la web y su conexión UUID son permanentes. Renombrar no cambia diarios, productos ni cachés. Cada operación exige el permiso del módulo, conexión exacta, revisión actual y web activa. No se copian credenciales al navegador. Desactivar la conexión impide operar; retirar conserva el historial.

Los clientes, marcas, proveedores y atributos pertenecen a su web. Copiar productos exige seleccionar origen y destino; los IDs de las bases de datos no se trasladan como equivalencias. Las validaciones y capacidades nativas siguen aplicándose a cada versión de PrestaShop.

## Negocios, cajas y totales
Una web no es una caja física. Asociar el negocio permite utilizar los recorridos existentes de facturas y recepciones; crear negocios y cajones se hace en Administración. Una preproducción con pedidos migrados no debe sumar sus ventas a las de producción. Hortimatic antigua y Hortimatic 2.0 conservan identidades independientes hasta el cambio decidido por el administrador.

Un panel guardado de una web retirada muestra que ya no está disponible, en lugar de convertir su consulta en «Todas las tiendas». Las reglas de automatización mantienen su lista explícita de webs; no se añaden destinatarios ni webs a reglas existentes automáticamente.

## Alcance y diagnóstico
El alta automática actual admite Webservice nativo en la raíz HTTPS /api/. Una clave incorrecta, permisos ausentes, recursos de terceros no publicados o autenticación bloqueada por el alojamiento requieren corregir la configuración de esa web: Totus no puede concederse permisos ni inventar datos. El registro común evita cambios de código para nuevas instalaciones compatibles; no convierte recursos privados de POSTPV en API nativa.

HTTP 401 en Hortimatic 2.0: se ha verificado Webservice habilitado y clave activa; el modo CGI nativo se ha activado con aprobación expresa y guardado correctamente. Se añadió, con autorización expresa y respaldo, SetEnvIf Authorization para reenviar la cabecera a PHP. La prueba de Totus devuelve HTTP 200 y la conexión está activada. El resto del .htaccess se ha verificado idéntico al original.

## Verificación de esta entrega
- Pruebas unitarias: cuarta web, UUID exacto, URLs, caché, permisos, copia y encargos al asistente.
- Recorrido de creación en el servicio HTTP con una cuarta web simulada: preparar, confirmar y verificar; rechazo de conexión cruzada o desactivada antes de llamar al proveedor.
- PostgreSQL local: migraciones contrastadas con definiciones actuales, alta automática, renombrado, retirada, permisos y diarios de creación/edición.
- Playwright: cuatro webs, selección de producto y destino, directorios y configuración a 390, 969 y 1920 px. APIs simuladas; no equivalen a escrituras reales en tiendas.
- La autenticación real de Hortimatic 2.0 se ha verificado con HTTP 200. No se ha cambiado el control de Hortimatic antigua.

## Despliegue
Aplicar en orden 20261113153207_independent_websites y 20261113153222_dynamic_website_operations. Actualizar totus-connections, totus-assistant, totus-ai y totus-prestashop-alerts, conservando su autenticación actual. Publicar frontend solo después de las migraciones y servicios. Verificar los selectores y lecturas reales antes de cerrar la entrega.
