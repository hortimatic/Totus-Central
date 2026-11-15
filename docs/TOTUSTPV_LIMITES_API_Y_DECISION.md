# TotusTPV: decisión API nativa y límites comprobados

15/11/2026. Este documento evita prometer equivalencia completa con POSTPV sobre operaciones que el Webservice no representa del mismo modo. No autoriza instalar módulos, modificar PrestaShop ni habilitar cobros.

## Identidad de Hortimatic

La instalación PrestaShop 8.2.8 sirve ahora en `preproduccion.hortimatic.com` y será la futura `hortimatic.com`. La instalación 1.7 se retirará cuando la nueva esté lista. Son instalaciones distintas durante la transición, aunque pertenezcan al mismo negocio físico. El cambio de dominio de 8.2.8 debe conservar su identidad de conexión/instalación y sus referencias remotas; no debe copiar pedidos de 1.7 por coincidir sus IDs.

El cambio requiere revisar y verificar el endpoint y la identidad de web existentes de Central. No se debe resolver creando otra tienda con el mismo nombre y perdiendo las relaciones con usuarios, cajas y operaciones. Mientras se prueba, sus ventas no se incorporan a los totales comerciales de producción por defecto.

## 1. Reposición concurrente

El recurso `stock_availables` acepta actualización de cantidades; `stock_movements` es de lectura. El Webservice clásico no expone en esos recursos un comando de incremento de existencias con la misma semántica transaccional del gestor interno.

Ejemplo: se leen 50 unidades, entra una venta web de 3, y después se escribe 100 para añadir otras 50. El resultado correcto era 97. Releer justo antes reduce la ventana, pero no elimina la carrera entre lectura y escritura. Un bloqueo en Central no bloquea el checkout web de PrestaShop.

Por ello, un flujo de recepción que prometa seguridad ante ventas concurrentes necesita un incremento nativo o un control de concurrencia demostrado en la instalación. No se simulará sumando en JavaScript y sobrescribiendo el stock. La lectura del movimiento de una venta sí permite comprobar su descuento sin atribuirle otras ventas web; ese lector ya está implementado y probado localmente.

Fuentes primarias: [métodos del Webservice](https://devdocs.prestashop-project.org/8/webservice/reference/), [explicación oficial de diferencias frente a movimientos](https://devdocs.prestashop-project.org/8/faq/stock/).

## 2. Creación de pedido y pagos pendientes

En PrestaShop 8.2.8, `Order::addWs` obtiene el módulo de pago indicado y llama al circuito nativo de validación usando el estado configurado como `PS_OS_WS_PAYMENT`. No utiliza el estado enviado como una elección libre para cada nuevo pedido. `setWsCurrentState` actúa cuando el objeto ya tiene ID.

Si ese circuito valida como pagado, registra el importe recibido por el mecanismo nativo. Por tanto, el transporte actual se limita explícitamente al contrato de una venta íntegramente cobrada; enviar un texto «crédito» o una cifra de pago inicial no demuestra que se haya registrado una reserva o un saldo pendiente correctamente. Crédito, presupuestos y cobros parciales necesitan un recorrido nativo específico contrastado antes de habilitarse.

Fuente primaria: [Order.php 8.2.8](https://github.com/PrestaShop/PrestaShop/blob/8.2.8/classes/order/Order.php), [PaymentModule.php 8.2.8](https://github.com/PrestaShop/PrestaShop/blob/8.2.8/classes/PaymentModule.php).

## 3. Incidencia del pedido de prueba

El pedido 46542 se creó con pago y descuento de stock, pero el estado requirió recuperación manual. El diagnóstico previo había leído el estado configurado correctamente. No se ha demostrado que un estado mal configurado fuera la causa.

Se consultaron el registro nativo de PrestaShop, el extracto Apache de cPanel y `var/logs/20261115_exception.log` de la instalación 8.2.8. El último contiene tres errores de `payment_execution.tpl` a las 09:07; no corresponde al momento posterior de creación del pedido. No se presenta como explicación de esa incidencia. No se repitió el pedido para intentar reproducirla.

Antes de habilitar ventas ordinarias debe conservarse el error original del envío y completarse una prueba autorizada de todo el recorrido, sin corrección manual ni dependencia de POSTPV. Un procedimiento de recuperación es necesario, pero no sustituye descubrir la causa de una interrupción sistemática.

## Cálculo nativo de precios: capacidad y límite

El Webservice ofrece campos calculados de precio para productos y combinaciones mediante `price[alias][parámetro]`. Se ha incorporado una consulta acotada de vista previa con impuestos y sin impuestos, cantidad, variante, país, provincia, código postal, moneda, grupo y ecotasa explícitos. Conserva los seis decimales; no calcula el total multiplicando precios unitarios ya redondeados.

La implementación fijada de 8.2.8 lee el código postal bajo `county`, aunque el tutorial lo llama `postcode`. El transporte usa el nombre realmente leído por ese núcleo. No se aceptan parámetros arbitrarios ni claves o contexto de otra tienda.

Este cálculo no recibe ID de cliente ni carrito y no equivale a `Cart::getOrderTotal`. No demuestra descuentos individualizados, vales, promociones de carrito, portes ni sus reglas de redondeo. Por eso su respuesta indica `payableCartQuote:false`; no permite confirmar una venta por sí sola. La comprobación estructural del carrito tampoco asegura stock reservado frente a ventas posteriores.

Fuentes: [tutorial oficial de precios calculados](https://devdocs.prestashop-project.org/8/webservice/tutorials/advanced-use/specific-price/), [`specificPriceCalculation` de 8.2.8](https://github.com/PrestaShop/PrestaShop/blob/8.2.8/classes/webservice/WebserviceRequest.php).

## 4. Decisión de arquitectura

Decisión actual del responsable técnico, tras la delegación del propietario: desarrollar TotusTPV dentro de Totus Central sobre la API nativa autorizada de PrestaShop **8.2.8**, sin instalar conector. No se plantea actualizar a 9. La preferencia por no instalar componentes no permite declarar resueltas las limitaciones descritas en este documento.

Central conserva usuarios, permisos, tiendas físicas, cajas, sesiones y el registro durable de operaciones. PrestaShop conserva sus pedidos y sus referencias nativas. Cada envío queda ligado a una instalación, tienda nativa, carrito y operación únicos; una respuesta incierta se recupera mediante lectura, sin volver a cobrar ni crear otro pedido a ciegas.

El alcance inicial habilitable exige ventas completamente cobradas, cálculo contrastado y verificación de pedido, pago, estado y movimiento de stock. Las reposiciones concurrentes, crédito, anticipos y devoluciones no se anuncian disponibles hasta demostrar su circuito nativo. La incidencia del pedido 46542 sigue pendiente de explicación; la recuperación manual anterior no acredita que el checkout esté listo para explotación.

El código bajo `connectors/prestashop/` es exclusivamente una alternativa local de investigación. No tiene módulo instalable ni se importa desde Central. No forma parte de la solución elegida ni autoriza instalar nada. Si un requisito imprescindible resulta imposible con la API existente, debe documentarse la operación exacta y su evidencia antes de reconsiderar esa alternativa; no se traslada de nuevo al propietario una elección técnica abstracta.

La restricción vigente en `AGENTS.md` indica: «No instalar ni actualizar complementos propios ni de terceros en PrestaShop para cumplir objetivos de Totus» y «Si la API de la versión instalada no admite una operación, comprobarlo y explicarlo».

Hay dos alcances distintos:

1. Mantener estrictamente la API autorizada actual: se implementan y habilitan sólo recorridos cuya representación y recuperación se puedan demostrar. Las limitaciones anteriores permanecen visibles; no se declara equivalencia completa.
2. Autorizar expresamente una capacidad nativa adicional propia y acotada: permitiría estudiar comandos transaccionales concretos que hoy faltan, manteniendo toda la interfaz y operativa en Central. Eso cambia la restricción anterior y requiere una decisión del propietario antes de implementarlo en una tienda.

La segunda opción no es una propuesta de instalar POSTPV ni de basar Central en su código. Tampoco garantiza automáticamente compatibilidad: exigiría código propio auditable, versionado, permisos por comando, identidad estable de operación, verificación y recuperación, actualizaciones compatibles, instalación autónoma y pruebas con POSTPV ausente. No se ha construido ni instalado ese componente.

Se continúa con dominio, almacenamiento propio, autorización, lectura nativa, conciliación, interfaz compartida y preparación de carrito sobre la vía elegida. No se publican botones que aparenten completar operaciones no implementadas.

Actualización del propietario, 15/11: delega estudiar todas las alternativas y elegir la de menor dependencia y problemas futuros. Se puede preparar y comparar una alternativa propia; esta decisión no acredita pruebas ni instalación. Debe evitarse volver a trasladar al propietario la elección técnica.

Advertencia adicional del estudio del núcleo: el gestor de stock 8.2.8 carga una cantidad y después guarda el resultado de sumarle el delta. Invocar ese método dentro de un conector no acredita por sí solo aislamiento frente a todos los escritores. Una solución debe comprobar el protocolo completo de concurrencia de los checkouts nativos y la reposición, no limitarse a llamar a un método llamado `updateQuantity`.

Fuente primaria: [StockManager 8.2.8](https://github.com/PrestaShop/PrestaShop/blob/8.2.8/src/Core/Stock/StockManager.php). La alternativa con conector debe demostrar esta coordinación en pruebas reales antes de habilitar reposiciones concurrentes.
