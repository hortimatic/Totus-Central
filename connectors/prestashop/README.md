# Capacidad nativa propia: preparación sin despliegue

TotusTPV conserva su interfaz, usuarios, permisos, tiendas y cajas dentro de Totus Central. La API clásica de PrestaShop 8.2.8 sigue siendo la vía de las operaciones que representa correctamente. Para cubrir cálculo completo de carritos, pagos mixtos y devoluciones se está preparando una capacidad propia, acotada a comandos nativos. No se propone actualizar PrestaShop a 9.

Este directorio contiene un paquete propio para PrestaShop 8.2.8 y su controlador Webservice. Está instalado exclusivamente en el laboratorio local desechable. No está instalado ni activado en una tienda remota. Su interfaz de venta permanece en Totus Central.

`node tools/package-totus-native.mjs` produce el ZIP y un manifiesto SHA-256 en `artifacts/totus-native/`. La instalación registra recursos Webservice y cinco tablas propias; no altera el núcleo ni crea automáticamente clientes, transportistas, estados o pedidos. La configuración de permisos exige un empleado nativo con edición de Webservice, selección de una cuenta existente y token de formulario. Conserva sus permisos anteriores y no muestra ni modifica la clave.

El comando explícito `setup.qa` crea una identidad ficticia de mostrador, estados propios y entrega privada. Sólo acepta el dominio HTTPS de preproducción acordado; el permiso de laboratorio requiere una constante que únicamente define el router local de pruebas, fuera del ZIP. La entrega privada devuelve indisponible en el checkout público. No enviar `setup.qa` a una tienda comercial ni adoptar la identidad ficticia como cliente real.

Recursos propios disponibles: perfil y recuperación por GET; preparación de carrito, cálculo, venta, devolución y recepción aditiva de stock por POST. El servidor conserva la identidad de cada operación; una respuesta incierta se consulta, no se reenvía. La retirada del paquete conserva sus recibos e historial financiero para permitir recuperación y reinstalación; no borra pedidos, pagos, facturas ni abonos.

Las lecturas acotadas incluyen catálogo con combinaciones, clientes y documentos
nativos ya existentes. Los descuentos por línea se limitan al carrito propio;
los descuentos generales y cupones utilizan el cálculo nativo. No cambian los
precios del catálogo. El transportista de recogida admite los grupos de clientes
existentes, incluidos invitados; su callback sigue rechazando el checkout web.
La creación y edición de clientes/direcciones reutiliza el escritor y registro
de publicación del directorio de Central. Los datos de autenticación del cliente
se conservan únicamente en el servidor al editar su ficha.

La compatibilidad PHP 8.2 acota los avisos de obsolescencia del núcleo y sus
dependencias a solicitudes autenticadas del conector. No oculta advertencias ni
errores reales ni cambia PHP globalmente. Para clientes/direcciones, la cabecera
explícita `X-Totus-Central-Compatibility: 1` sólo se acepta dentro del perfil QA
verificado. Los fallos de comandos registran identificador, código, clase y
ubicación; nunca mensajes SQL, claves ni datos del cliente.

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

El circuito `node tests/totustpv-native-http-qa.mjs` usa autenticación y ACL nativas, el paquete instalado y clases reales de PrestaShop/MariaDB. Comprueba efectivo, tarjeta, mixto, una factura por pedido, salida de stock atribuida al pedido, abonos y reposición opcional, recepción aditiva, repetición sin duplicados y recuperación GET. También inyecta un fallo tras el abono/reposición y verifica rollback de documentos, contadores, movimientos y stock, manteniendo la barrera de envío. El adaptador de Central envía y relee los pedidos en ese laboratorio. No prueba todavía el servicio Edge publicado, la sesión de usuario real de Central, el hardware ni concurrencia web bajo carga.

No publicar ni instalar estos archivos como solución operativa completa. Falta el circuito autenticado y persistente del puesto en Central y la batería comercial restante. Antes de cambiar la tienda remota debe existir autorización concreta de esa instalación. Los resultados locales no son una venta remota ni una certificación de cobertura completa.
