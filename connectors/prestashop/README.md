# Capacidad nativa propia: preparación sin despliegue

TotusTPV conserva su interfaz, usuarios, permisos, tiendas y cajas dentro de Totus Central. La API clásica de PrestaShop 8.2.8 sigue siendo la vía de las operaciones que representa correctamente. Para cubrir cálculo completo de carritos, pagos mixtos y devoluciones se está preparando una capacidad propia, acotada a comandos nativos. No se propone actualizar PrestaShop a 9.

Este directorio contiene el protocolo, registro durable y cálculo nativo de carritos propios. `JournalSchema.php` genera DDL para la tabla propia sin ejecutarlo. No contiene todavía un módulo instalable ni un controlador HTTP; no hay activación en ninguna tienda. El transporte preparado de Central puede solicitar un cálculo solamente con un perfil explícitamente verificado; ese endpoint aún no está publicado.

Verificación separada:

| Prueba | Evidencia | Lo que no acredita |
|---|---|---|
| PHP del protocolo | Autenticación, alcance y reclamación con dependencias simuladas | Endpoint nativo instalado |
| Registro SQLite | Reinicio, unicidad y recuperación | Comportamiento de MySQL |
| `tests/native-lab/journal.php` | Dos conexiones MariaDB/InnoDB reales, reclamación persistida, alcance por usuario/tienda y pedido único | Atomicidad de todos los efectos del núcleo |
| `tests/native-lab/cart-quote.php` | Cálculo real de PrestaShop 8.2.8, impuestos y precisión | Proveedor persistente de propiedad del carrito |
| Pruebas locales de tarjeta/mixto/devolución | Pedido, pagos, factura, abonos y stock mediante clases/comandos nativos | Integración HTTP de Central, cobro bancario o certificación comercial |
| `tests/native-lab/native-effect.php` | Rollback real de pedido/pago/factura/stock, barrera durable separada y recibo de otra transacción confirmada | Terminación abrupta de proceso, correo/hooks externos o concurrencia web |

`PdoNativeEffect` usa el PDO nativo para el efecto y su recibo, mientras `PdoJournal` conserva la reclamación en una conexión independiente. `NativeEffectHandler` exige relectura idéntica del resultado inmutable antes de recuperar una respuesta perdida. No incorpora existencias globales variables ni marcas de tiempo en esos recibos. Si un hook interrumpe la transacción, no se declara éxito ni se permite otro envío. Esto no convierte en transaccionales un correo ya enviado o una llamada externa.

Los datos del laboratorio son ficticios. Sus clases de pago y proveedores de propiedad son fixtures, no componentes comerciales instalados. Véase `tests/native-lab/README.md`.

No publicar ni instalar estos archivos como solución operativa. Falta completar el paquete, autenticar los comandos a través del Webservice, verificar configuración y recuperación de efectos y resolver las pruebas de concurrencia. Antes de cambiar una tienda debe existir un paquete revisable y autorización concreta de esa instalación. Un método nativo de stock por sí solo no demuestra coordinación con ventas web.
