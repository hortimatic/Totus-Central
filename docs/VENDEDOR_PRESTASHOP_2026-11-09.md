# Empleado que registró el pedido

Se han consultado únicamente metadatos y lecturas SELECT en phpMyAdmin de Hortimatic. No se han modificado tablas, módulos, configuración ni permisos.

Las tablas `psog_posp_movimientos` y `psog_posp_cajas` existen en la base de producción. Los campos de relación de movimientos son BLOB de 16 bytes no interpretables como IDs en texto. No se intenta descifrar sus valores ni deducir empleados por horarios.

La alternativa nativa comprobada es `psog_order_history.id_employee`, relacionado mediante `id_order` con el pedido y con `psog_employee.id_employee`. En la muestra de doce pedidos 46459–46470 del 9 de noviembre, creados por `tpvtienda`, la primera entrada corresponde al segundo de creación del pedido y al empleado 1. La cuenta Webservice «Totus central Hortimatic» tiene GET activo en `order_histories` y `employees`.

Totus consulta el historial completo de los pedidos seleccionados y conserva el empleado del registro inicial, no el autor del último cambio de estado. Si no consta, no coincide con la creación o hay empleados contradictorios en ese instante, no asigna un vendedor. El nombre se obtiene del empleado por ID, solicitando únicamente ID, nombre y apellidos, nunca contraseña, correo u otros campos de acceso. Las cuentas compartidas identifican la cuenta utilizada, no garantizan quién era la persona física.

La caché de nombres se separa por tienda, conexión y revisión y se retira al cambiar de usuario. Cambiar de tienda o cerrar la sesión descarta respuestas tardías. Un error de lectura conserva el resto del pedido y explica que no hay vendedor vinculado.

Comprobaciones: contratos de API con selección obligatoria por pedido, historial paginado, rechazo de datos de otra tienda o pedido, empleado inicial frente a ediciones posteriores y prueba de tabla con Playwright. La prueba real de lectura del servicio debe anotarse tras su despliegue; la comprobación SQL no equivale a una lectura de la API ya desplegada.


## Lectura real verificada con Totus v41
La cuenta Codex consultó el historial nativo y el empleado en ambas tiendas:
- Hortimatic 46470 → historial 46957 → empleado 1, Davinia Hortimatic.
- NewOldSmok 15162/15163 → historiales 15328/15329 → empleado 1, Diego Sequera.
No se usan coincidencias de caja/hora para atribuir personas. La interfaz exige que el primer historial tenga la misma fecha de creación del pedido y un empleado único.

La consulta de empleado pide dos plazas para un filtro de ID exacto: la paginación genérica marca una página llena como posiblemente incompleta. Se comprueba un único resultado, su ID y ausencia de más páginas. Pedir una sola plaza hacía que la lectura correcta pareciera incompleta; el contrato de pruebas reproduce ese caso.
