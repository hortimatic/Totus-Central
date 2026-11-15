# Estado de implementación de TotusTPV

15/11/2026. Código local dentro del repositorio de Totus Central. No desplegado y sin nuevas ventas reales.

| Componente | Implementado y comprobado | Límite actual |
|---|---|---|
| `model.js` | Céntimos, efectivo, cambio, mixtos, cheque, saldo a crédito, límites de devolución y verificación del pedido | Reglas propias; no proveedor bancario ni devolución ejecutable |
| `context.js` | Identidades explícitas de conexión, revisión, tienda, usuario, caja y sesión | Espera registros obtenidos por un servidor autenticado |
| `checkout-service.js` | Preparado → envío reclamado → lectura → confirmación o conciliación; nunca reenvía por un timeout | Espera preparación de carrito, liquidación y autorización reales |
| `postgres-journal.js` | Adaptador del registro al RPC de Central | La migración todavía no se ha aplicado en remoto |
| Migración del registro | Asignaciones, sesiones, operaciones y pagos; permisos de servidor; unicidad por carrito/pedido; confirmación y pagos atómicos | Sin habilitaciones ni asignaciones comerciales por defecto; no sustituye los cierres actuales |
| `native-transport.js` | URL verificada, clave sólo en servidor, tienda nativa explícita, respuestas acotadas y POST único sin reintentos | Creación deshabilitada por defecto; no controlador HTTP publicado |
| `native-adapter.js` | Lectura nativa de pedido, detalles, estado, moneda y pagos, con filtros comprobados | Evidencia de PrestaShop simulada en sus pruebas locales |
| `inventory-evidence.js` | Movimientos negativos vinculados al pedido y registro de stock, resistentes a cambios concurrentes de cantidad global | Requiere acceso nativo a movimientos; stock avanzado/compartido necesita perfil propio |
| Interfaz y configuración autónoma | Especificadas en la memoria y alcance | Todavía no implementadas como módulo de venta dentro de Central |

## Verificación

- Reglas del modelo: pruebas locales pasadas.
- Controlador de venta: 11 casos simulados pasados.
- Transporte: 6 casos con respuestas simuladas pasados.
- Adaptador nativo: 5 casos con respuestas simuladas pasados.
- Evidencia de existencias: 3 casos con respuestas simuladas pasados.
- Registro PostgreSQL: 54 comprobaciones pasadas en PGlite, incluyendo conexión del controlador con el RPC SQL real, rollback de confirmación/pagos y permisos denegados.
- El circuito de estabilidad ejecuta estas pruebas y conserva los controles existentes. PGlite es una dependencia de desarrollo fijada, no una dependencia de producción de Central ni de PrestaShop.

Estas pruebas no acreditan un cobro comercial completo ni que el componente esté publicado. La única prueba nativa anterior sigue siendo la del pedido 46542, que necesitó recuperación manual del estado.

## Diagnóstico sin atribuciones falsas

El log `var/logs/20261115_exception.log` de 8.2.8 muestra un fallo de plantilla a las 09:07. No corresponde al momento de creación del pedido 46542. El registro general de cPanel contiene errores de la instalación antigua; no se utilizan para culpar al TPV de 8.2.8. El error original de creación continúa sin evidencia concluyente.

Se descartó crear un archivo temporal de credenciales cuando la revisión automática lo rechazó. No se creó ese archivo y se eliminaron las copias de diagnóstico de la memoria de trabajo. Las verificaciones remotas deben ejecutarse mediante la conexión ya existente en el servidor y su gestor de secretos.

## Siguiente entrega

Resolver la elección del adaptador nativo contrastando las alternativas de API y conector mínimo. Completar preparación/cálculo nativos, autorización HTTP normal de Central, interfaz, configuración y una venta de prueba autorizada sin reparación manual. No retirar POSTPV ni la instalación 1.7 hasta validar todos los recorridos acordados.
