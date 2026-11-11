# PrestaShop · columna Caja (11/11/2026)
## Petición y límites
La tabla Pedidos y ventas incorpora **Caja** como columna opcional configurable, ordenable, exportable y guardable en vistas personales. No altera las columnas seleccionadas existentes, margen, vendedor, ventas ni contabilidad. Admite cualquier nombre futuro de caja en cualquier tienda.

## Evidencia exigida
El valor procede exclusivamente de un objeto de atribución de origen `cash_box`: `{verified:true,store,order_id,drawer_id,name}`, validado contra tienda y pedido. Si falta o no coincide, muestra **Sin identificar**. Ni la forma de pago, ni el empleado, ni el horario, ni el propio `id_shop` prueban una caja.

**Pendiente**: la API estándar de pedidos de PrestaShop actualmente no expone `cash_box`. Para mostrar nombres reales hace falta un adaptador de lectura del módulo TPV instalado que acredite la relación pedido-caja y obtenga el nombre del catálogo de cajas de la tienda. No habilitar ni publicar como tarea terminada mientras esa relación no esté probada por tienda. Las tablas `psog_posp_cajas` y `psog_posp_movimientos` están documentadas, pero su enlace con el ID del pedido no está verificado. No modificar permisos ni alterar el esquema para ocultar esa ausencia.

## Pruebas
El QA de tabla usa únicamente datos ficticios y comprueba inclusión de la columna, un nuevo nombre de caja y rechazo de otra tienda, otro pedido o atribución sin verificar. No es una prueba contra la instalación de TPV real.
