# Recorrido de stock de TotusTPV

Referencia funcional: capturas aportadas por Diego el 16/11/2026. No se copia código de otro proveedor.

## Entrada por lector
Campo de código con foco mantenido. Cada lectura exacta añade una unidad a una línea identificada por conexión, producto y combinación. Repetir código incrementa unidades. Las coincidencias ambiguas piden elegir; no se decide por nombre ni se mezclan variantes. Lectura y filtro no modifican existencias. Mostrar foto, nombre, referencia, EAN, stock actual y unidades recibidas. Permitir corregir o retirar una línea antes de confirmar.

La confirmación crea una solicitud durable por línea dentro del lote. Leer el resultado nativo antes de marcarla recibida. Una respuesta incierta conserva su identificador y bloquea reenvíos; el resumen distingue pendiente, verificada y rechazada. Reabrir desde otro ordenador recupera el lote y su estado. No repetir entradas verificadas.

## Catálogo y columnas
Tabla común de Central con fotos. Reutilizar column-settings.js; mismo panel, orden, tamaños, visibilidad y Guardar distribución. Guardado por usuario y contexto, disponible desde otros ordenadores. Ordenación ascendente/descendente por texto y número sobre el conjunto filtrado, no únicamente los 20 artículos de la página. Buscar código, nombre y referencia; categorías jerárquicas con orden alfabético. Incluir deshabilitados es un filtro propio de stock, no permite venderlos.

## Alta rápida
Acceso desde el espacio de stock. Usar el contrato de creación existente de Productos: nombre, referencia/EAN, coste, PVP/impuestos, categoría, marca, proveedor, imagen y variantes. Crear únicamente en la conexión seleccionada, releer la ficha y añadirla al lote sin duplicar la entrada inicial. Conservar el lote al volver del alta. No informar de guardado hasta confirmar el identificador remoto.

## Traspaso
Origen y destino distintos y autorizados; identificación explícita de producto y combinación de cada catálogo. No equiparar IDs entre bases de datos. Comprobar correspondencia y cantidades antes de reservar salida. Registrar salida, tránsito y recepción como etapas persistentes de una misma solicitud; no presentar ambos stocks actualizados si solo terminó una etapa. Recuperación por identificador y auditoría del operador. Un fallo entre webs nunca provoca un segundo descuento ni una recepción duplicada. Las pruebas remotas requieren dos destinos QA: las webs en producción están excluidas.

## Aceptación pendiente
Escaneo repetido, código inexistente/ambiguo, variante, producto deshabilitado, entrada parcial, respuesta perdida, recarga y otro ordenador, permiso denegado, cambio de tienda, alta rápida y traspaso con fallo intermedio. Verificar stock nativo e historial de movimientos. Esta especificación no certifica que esos recorridos estén implementados o publicados.

## Mostrador y configuración complementarios

Diego solicita además selector de operador, selector de caja, estado de caja abierta y menú de acciones compacto. La identidad del cajero debe ser una sesión autenticada de Central; seleccionar un nombre no concede permisos ni permite imputar ventas a otra cuenta. Cambiar caja conserva los tickets aparcados y los permisos; una caja abierta no se cierra por navegar.

Acciones: ofertas, descuentos por línea y ticket, cliente (buscar/crear/editar), tickets aparcados, presupuestos, devoluciones, pedidos, pagos y configuración del ticket. Usar diálogos compactos con título, cancelar y guardar/confirmar coherentes. Conservar la configuración de impresora de 58mm, datos fiscales y numeración; reimpresión no duplica pedido ni pago. Las capturas de configuración que enviará Diego completarán la comparación funcional. Las primeras dos capturas de su último lote corresponden visualmente al selector de categorías, no muestran usuario/caja; sus requisitos textuales se conservan.
