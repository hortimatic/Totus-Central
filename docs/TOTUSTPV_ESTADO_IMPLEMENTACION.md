# Estado de implementación de TotusTPV

15/11/2026. Código local dentro del repositorio de Totus Central. No desplegado y sin nuevas ventas en las tiendas remotas. Las ventas nativas nuevas descritas abajo pertenecen únicamente al laboratorio local desechable.

| Componente | Implementado y comprobado | Límite actual |
|---|---|---|
| `model.js` | Céntimos, efectivo, cambio, mixtos, cheque, saldo a crédito, límites de devolución y verificación del pedido | Reglas propias; no proveedor bancario ni devolución ejecutable |
| `context.js` | Identidades explícitas de conexión, revisión, tienda, usuario, caja y sesión | Espera registros obtenidos por un servidor autenticado |
| `checkout-service.js` | Preparado → envío reclamado → lectura → confirmación o conciliación; nunca reenvía por un timeout | Espera preparación de carrito, liquidación y autorización reales |
| `postgres-journal.js` | Adaptador del registro al RPC de Central | La migración todavía no se ha aplicado en remoto |
| Migración del registro | Asignaciones, sesiones, operaciones y pagos; permisos de servidor; unicidad por carrito/pedido; confirmación y pagos atómicos | Sin habilitaciones ni asignaciones comerciales por defecto; no sustituye los cierres actuales |
| `native-transport.js` | URL verificada, clave sólo en servidor, tienda nativa explícita, respuestas acotadas y POST único sin reintentos | Creación deshabilitada por defecto; no controlador HTTP publicado |
| `native-adapter.js` | Lectura nativa de pedido, detalles, estado, moneda y pagos, con filtros comprobados | Evidencia de PrestaShop simulada en sus pruebas locales |
| `cart-preflight.js` | Relectura obligatoria del carrito antes del adaptador de precios; identidades, líneas, variantes, stock, mínimos y ausencia de pedido | Sólo comprobación estructural; no reserva existencias ni sustituye cálculo de totales |
| Precio nativo por producto | Parámetros explícitos de tienda, variante, cantidad, grupo, dirección fiscal, moneda y ecotasa; conserva seis decimales | Es una vista previa, no el total pagable de carrito ni descuentos por cliente/carrito |
| `inventory-evidence.js` | Movimientos negativos vinculados al pedido y registro de stock, resistentes a cambios concurrentes de cantidad global | Requiere acceso nativo a movimientos; stock avanzado/compartido necesita perfil propio |
| `operator-payments.js` | Confirmación explícita del cajero, nueva autorización, revisión de configuración y reparto efectivo/tarjeta | No cobra ni reintegra dinero en un banco; datáfono independiente |
| `payment-readback.js` | Contrasta cada forma e importe contra los pagos nativos; un total correcto con métodos intercambiados falla | Necesita lecturas autenticadas de la instalación seleccionada |
| `quote-contract.js` y `quote-verifier.js` | Consume cálculo nativo de carrito propio, verifica alcance, caducidad, seis decimales, totales y cambios antes de enviar | Proveedores persistentes y endpoint todavía sin publicar |
| Interfaz de trabajo | Venta, caja, historial, pagos, recuperación y devoluciones en un recorrido de práctica aislado, con móvil y escritorio | No hay ruta de TPV habilitada en Central ni adaptador HTTP de venta real |
| Capacidad nativa propia | Protocolo, reclamación durable y cálculo de carrito; registro comprobado también en MariaDB | Sin paquete instalable, controlador HTTP ni activación remota |
| `PdoNativeEffect` y `NativeEffectHandler` | Exigen reclamación previa, guardan recibo y efectos SQL en el mismo PDO nativo, y recuperan sólo tras relectura coincidente | No vuelven transaccionales el correo ni efectos externos de hooks; todavía sin endpoint |

## Verificación

- Reglas del modelo: pruebas locales pasadas.
- Controlador de venta: 13 casos simulados pasados.
- Transporte: 10 casos con respuestas simuladas pasados.
- Carrito: 8 casos con respuestas simuladas pasados, incluyendo su integración obligatoria en el adaptador de venta.
- Adaptador nativo: 8 casos con respuestas simuladas pasados.
- Evidencia de existencias: 3 casos con respuestas simuladas pasados.
- Registro PostgreSQL: 54 comprobaciones pasadas en PGlite, incluyendo conexión del controlador con el RPC SQL real, rollback de confirmación/pagos y permisos denegados.
- El circuito de estabilidad ejecuta estas pruebas y conserva los controles existentes. PGlite es una dependencia de desarrollo fijada, no una dependencia de producción de Central ni de PrestaShop.

También han pasado confirmación de pagos (5 casos), reparto nativo (2), contrato de cálculo (5), práctica (9) y el recorrido Playwright de venta/caja/devolución/recuperación en cuatro anchuras. Son pruebas simuladas de la aplicación, no ventas remotas.

En un laboratorio con PrestaShop **8.2.8**, PHP **8.2.35** y MariaDB **10.11.16**, se han ejecutado clases y comandos reales del núcleo:

- Carrito de 8,01 €, precio unitario de seis decimales y stock intacto al consultar.
- Pedido con un pago `Tarjeta`, una factura y stock de cinco a cuatro, sin duplicar el pago al finalizar el estado.
- Pedido de 16,02 € repartido en 5,00 € de efectivo y 11,02 € de tarjeta; una factura y exactamente dos pagos.
- Dos abonos parciales de 8,01 €: unidad defectuosa sin reposición y unidad revendible con reposición. Una devolución adicional se rechaza sin generar otro abono.
- Registro propio en MariaDB con dos conexiones: no se recupera un permiso de envío por timeout, no se cambia de cajero/tienda y un pedido no se asigna a dos ventas.
- Fallo inyectado después de crear pedido, pago y factura nativos: se revierten esos registros y el stock, pero persiste la barrera de envío en otra conexión. Una segunda transacción con carrito distinto conserva sus efectos y su recibo; una respuesta perdida se recupera sin nuevo envío.

Los abonos nativos no confirman un reintegro externo ni descuentan efectivo de una caja de Central. Los proveedores de propiedad y clases de pago del laboratorio son fixtures. La prueba transaccional usa una excepción controlada; no valida aún terminaciones abruptas del proceso, todos los efectos externos de hooks ni stock concurrente con checkout web. El correo está desactivado en el laboratorio. El pedido remoto 46542 conserva su historial de recuperación manual y su causa original sin resolver.

El coordinador transaccional tiene además 21 comprobaciones SQLite con manejador de negocio simulado: exige una reclamación válida, rechaza relecturas que cambien referencia o importe, bloquea reenvío después de rollback y mantiene incertidumbre si un hook interrumpe la transacción. Estas pruebas no sustituyen la ejecución nativa anterior.

## Diagnóstico sin atribuciones falsas

El log `var/logs/20261115_exception.log` de 8.2.8 muestra un fallo de plantilla a las 09:07. No corresponde al momento de creación del pedido 46542. El registro general de cPanel contiene errores de la instalación antigua; no se utilizan para culpar al TPV de 8.2.8. El error original de creación continúa sin evidencia concluyente.

Se descartó crear un archivo temporal de credenciales cuando la revisión automática lo rechazó. No se creó ese archivo y se eliminaron las copias de diagnóstico de la memoria de trabajo. Las verificaciones remotas deben ejecutarse mediante la conexión ya existente en el servidor y su gestor de secretos.

## Siguiente entrega

Completar los proveedores persistentes de carrito/perfil, autorización HTTP normal de Central, configuración por tienda/caja/usuario, integración real de la interfaz y recuperación de todos los efectos. La API clásica se mantiene para las operaciones representables; se prepara una capacidad propia para los comandos nativos que faltan. No se ha instalado nada en una web ni se plantea actualizar a 9. La instalación 1.7 no debe retirarse antes de validar la sustitución completa. No se anuncia el TPV como comercialmente operativo.
