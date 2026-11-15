# TotusTPV: límites comprobados de la API y decisiones pendientes

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

## 4. Decisión de arquitectura

La restricción vigente en `AGENTS.md` indica: «No instalar ni actualizar complementos propios ni de terceros en PrestaShop para cumplir objetivos de Totus» y «Si la API de la versión instalada no admite una operación, comprobarlo y explicarlo».

Hay dos alcances distintos:

1. Mantener estrictamente la API autorizada actual: se implementan y habilitan sólo recorridos cuya representación y recuperación se puedan demostrar. Las limitaciones anteriores permanecen visibles; no se declara equivalencia completa.
2. Autorizar expresamente una capacidad nativa adicional propia y acotada: permitiría estudiar comandos transaccionales concretos que hoy faltan, manteniendo toda la interfaz y operativa en Central. Eso cambia la restricción anterior y requiere una decisión del propietario antes de implementarlo en una tienda.

La segunda opción no es una propuesta de instalar POSTPV ni de basar Central en su código. Tampoco garantiza automáticamente compatibilidad: exigiría código propio auditable, versionado, permisos por comando, identidad estable de operación, verificación y recuperación, actualizaciones compatibles, instalación autónoma y pruebas con POSTPV ausente. No se ha construido ni instalado ese componente.

Hasta que se decida el alcance se continúa con lo independiente: dominio, almacenamiento propio, autorización, lectura nativa, conciliación, interfaz compartida y evidencia. No se publican botones que aparenten completar operaciones no implementadas.

Actualización del propietario, 15/11: delega estudiar todas las alternativas y elegir la de menor dependencia y problemas futuros. Se puede preparar y comparar una alternativa propia; esta decisión no acredita pruebas ni instalación. Debe evitarse volver a trasladar al propietario la elección técnica.

Advertencia adicional del estudio del núcleo: el gestor de stock 8.2.8 carga una cantidad y después guarda el resultado de sumarle el delta. Invocar ese método dentro de un conector no acredita por sí solo aislamiento frente a todos los escritores. Una solución debe comprobar el protocolo completo de concurrencia de los checkouts nativos y la reposición, no limitarse a llamar a un método llamado `updateQuantity`.

Fuente primaria: [StockManager 8.2.8](https://github.com/PrestaShop/PrestaShop/blob/8.2.8/src/Core/Stock/StockManager.php). La alternativa con conector debe demostrar esta coordinación en pruebas reales antes de habilitar reposiciones concurrentes.
