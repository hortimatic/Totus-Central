# Entrada de mercancía por escáner y lotes

16/11/2026. Implementación en revisión. Este documento no acredita publicación ni escritura real en la tienda.

El mostrador acumula unidades cuando se repite un código exacto y conserva una cola de lecturas durante la consulta anterior. Las coincidencias ambiguas requieren elegir artículo y variante. Se pueden recibir artículos sin existencias; el stock disponible no limita la cantidad recibida. Cada lote admite hasta 200 artículos distintos y 10.000 unidades por línea.

El usuario añade artículos, corrige cantidades y escribe el albarán o motivo. «Guardar entrada para revisar» persiste un manifiesto inmutable en Central, sin modificar la tienda. «Confirmar y registrar mercancía» ejecuta las líneas. Antes de empezar puede cancelarse la entrada. Una entrada iniciada conserva sus resultados y no se puede borrar para ocultar una reposición parcial.

`stock-intake.js` controla la presentación y el borrador aún no guardado. `central-adapter.js` utiliza la sesión normal del usuario. `stock-receipt-service.js` procesa una línea por petición y consulta resultados inciertos; el identificador de cada línea lo genera PostgreSQL una sola vez. La modificación de existencias usa el diario y comando nativo `stock.receive` existentes. No requiere otro complemento ni cambia el núcleo de la tienda.

La tabla privada `totus_tpv_stock_receipts` guarda el manifiesto y sus identificadores. El resultado de cada línea se deriva del diario nativo con correspondencia exacta de ámbito y contenido. Los estados del lote son preparada, en curso, verificada y cancelada. La transición a en curso bloquea una cancelación concurrente antes del primer envío. La caja no puede cerrarse con un lote pendiente. Las lecturas y escrituras requieren las asignaciones vigentes y permiso de edición de Productos; el navegador no tiene acceso directo a la tabla ni a la RPC privilegiada.

Cambiar de ordenador recupera las entradas guardadas desde la misma cuenta, caja y sesión. El borrador anterior al guardado requiere confirmación antes de salir. Se muestran hasta 100 entradas, con pendientes primero; se limita la creación cuando ya existen 20 lotes pendientes. Un resultado incierto se recupera con el mismo identificador y no vuelve a enviar el comando.

Validación aislada: diario PostgreSQL con 202 aserciones, incluidas recuperación sin segundo envío, cancelación, bloqueo de cierre, datos inválidos, ámbito ajeno y denegación de acceso directo. Navegador: escaneos rápidos repetidos, acumulación, guardado sin escritura, reconstrucción de vista, recuperación parcial y anchos 1440/768/390. Los resultados de tienda en estas pruebas son simulados.

Pendiente para cerrar este requisito: publicación, migración y servicio remoto verificados, prueba de entrada y lectura del movimiento en preproducción, y comprobación con el lector físico. Este circuito mantiene la sesión de caja existente; la recepción independiente de una sesión de caja requiere un ámbito de almacén propio. Traspasos, inventario y alta rápida de producto son requisitos distintos y siguen abiertos.
