# TotusTPV · manual del puesto

Este manual corresponde al módulo integrado ampliado. El estado de publicación y aceptación real se registra en `TOTUSTPV_ACTIVACION_QA_20261116.md`. Mientras el puesto indique preproducción, los pedidos y cambios de existencias son de prueba y no se mezclan con los cierres comerciales.

## Dónde funciona

Se accede dentro de Totus Central, en **TotusTPV** (`/tpv`), con la cuenta habitual. No hay que abrir localhost, arrancar programas, mantener una base de datos en el ordenador ni iniciar una sesión paralela. Los permisos, establecimiento, caja y operador se comprueban en el servidor. No se comparten claves de PrestaShop con el navegador.

## Preparar el puesto una vez

1. Un administrador entra en **Configurar puesto de pruebas**.
2. Comprueba que el origen es `https://preproduccion.hortimatic.com`, selecciona el establecimiento físico, su caja y el operador ya registrados en Central.
3. Comprueba la tienda nativa indicada. Efectivo y tarjeta están incluidos; activa Bizum o transferencia únicamente si se utilizan.
4. Lee y marca la autorización de preparación y pulsa **Preparar y asignar puesto**. Se reutilizan los datos auxiliares nativos existentes; si faltan, se crean exclusivamente en QA.
5. El operador entra en **Abrir puesto de preproducción**, selecciona su tienda/caja, introduce el efectivo inicial y abre la caja. Una caja física sólo puede tener una sesión abierta en ese entorno.

Una asignación nueva no desactiva medios de cobro previamente configurados para otros operadores. La retirada de un medio requiere una futura operación de configuración explícita; no se simula quitando una casilla de alta.

## Vender

1. Busca por nombre o referencia. Selecciona la variante concreta cuando corresponda; la cantidad y disponibilidad se verifican de nuevo al preparar el cobro.
2. Para la pistola, enfoca el buscador, escanea y termina con Enter. Sólo una coincidencia exacta y única se añade automáticamente. Si hay varias, elige el artículo.
3. Elige cliente y dirección si los necesitas; por defecto se usa el cliente de mostrador. Puedes crear o editar la ficha con permisos. Corregir una dirección crea una nueva y conserva la usada por pedidos anteriores.
4. Ajusta cantidades y, si procede, descuento de línea, descuento general o cupón. Son condiciones de ese ticket, no modificaciones del precio del catálogo.
5. Prepara el cobro. El total y los impuestos proceden del cálculo nativo de PrestaShop. Revisa el resultado antes de aceptar.
6. En efectivo, introduce lo entregado o pulsa el billete correspondiente. Se muestra el cambio; no permite confirmar si falta dinero. En tarjeta, realiza el cobro en el datáfono independiente y confirma después su recepción. Bizum y transferencia también necesitan confirmación de recepción; un pago pendiente no es un cobro.
7. En mixto, indica la parte de efectivo y el segundo medio. Comprueba ambos importes y el cambio.
8. Confirma una vez. La confirmación exige releer pedido, pagos, estado y evidencia de stock. Ante respuesta incierta, conserva la solicitud y utiliza recuperación; no crees otro ticket para repetir el mismo cobro.

## Aparcar y recuperar

Con el ticket sin cobrar, pulsa **Aparcar ticket**. Se guarda en el servidor con versión y responsable. Recuperarlo en otro acceso recalcula precios y disponibilidad; no conserva un precio antiguo como autorización de cobro. Un ticket vendido no puede volver a convertirse en otra venta. Cancela o termina una devolución antes de trabajar con otro ticket.

## Documentos

Desde una venta verificada puedes imprimir ticket o regalo y descargar factura/albarán nativos ya existentes. Reimprimir no cobra ni crea otro número de factura. El perfil de impresión utiliza papel de 58 mm y contenido de 48 mm; configura el controlador de la Bisofice a 58 mm, escala 100 %, sin cabeceras ni pies del navegador. La apertura automática del cajón y la impresión física todavía requieren aceptación en el puesto real; no hay un agente local instalado.

## Devolver

Busca el pedido en el historial del establecimiento, elige las líneas/cantidades, indica el motivo y si el artículo vuelve a existencias. Puedes respetar el reparto original o elegir un medio original con saldo suficiente. Revisa el abono y confirma el reintegro externo cuando corresponda. TotusTPV registra el reintegro; no opera el datáfono ni la cuenta bancaria. La recuperación de una respuesta incierta consulta la misma operación. El abono PDF se descarga del documento nativo existente.

## Caja e inventario

Los ingresos y retiradas de efectivo requieren importe y motivo. Antes de cerrar, termina, aparca o descarta el ticket pendiente y recupera operaciones inciertas. Introduce el efectivo realmente contado y revisa la diferencia. Un informe de caja cerrada puede consultarse sin abrir otra sesión; muestra operador, cobros por medio, devoluciones, movimientos y diferencia. La recepción de stock es aditiva, por producto/variante y con motivo: no es una sustitución arbitraria de la cantidad global.

## Límites que impiden declarar explotación completa

Quedan pendientes crédito/anticipos/cobros posteriores, presupuestos/reservas, vales/saldo, traslados e inventarios generales, stock avanzado/compartido/paquetes/virtuales, apertura directa del cajón y aceptación física, además de concurrencia web y numeración de facturas. No se debe sustituir todavía la operativa comercial de producción ni cambiar el dominio.
