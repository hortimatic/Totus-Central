# Inicio y categorías: funcionamiento y comprobaciones

## Fecha y periodo

En el resumen de tienda y en pedidos de Inicio, **Día**, **Semana** y **Mes** seleccionan el periodo actual. Al volver a cargar el panel, siguen la fecha actual de Madrid. **Anterior**, **Siguiente** o elegir una fecha fijan el periodo consultado. La leyenda indica «Periodo actual» o «Fecha elegida». **Personalizado** conserva Desde y Hasta. Pulsar de nuevo Día/Semana/Mes vuelve al periodo actual. Los filtros de cada widget y tienda permanecen independientes.

## Reloj

El texto del reloj y su fecha utilizan **Configuración → Interfaz → Textos por elemento → Texto de cabecera**. No hay que ajustar un color de botón distinto para leer la hora. Esta entrega no añade aún los controles independientes solicitados para formato, tamaño y funciones del reloj/calendario: están registrados como trabajo pendiente.

## Margen de pedidos y resumen

Inicio reutiliza `approximateOrderMargin`, el cálculo usado por Pedidos y ventas. Lee las líneas del pedido y sus costes actuales en el catálogo de la tienda correspondiente. En combinaciones con coste positivo, utiliza el de la combinación; en otro caso, sigue la regla actual del producto base. Si no puede obtener ese coste, utiliza el coste de compra registrado en la línea cuando está disponible. Un dato ausente nunca significa coste cero; un cero informado sí se conserva.

**Margen comercial sin IVA = total pagado sin IVA − envío sin IVA − embalaje sin IVA − suma(coste unitario sin IVA × unidades).**

No es beneficio neto: no descuenta alquileres, nóminas, comisiones ni otros gastos generales. Tampoco equivale a la diferencia entre PVP con IVA y coste con IVA/recargo de la tabla de Productos. Ambos indicadores deben conservar su nombre y base de cálculo. No se mezclan EUR con otras monedas.

El resumen suma pedidos válidos. Si falta coste o detalle, informa de cobertura parcial; no presenta como total de ganancia una suma incompleta. El coste actual no reconstruye necesariamente el coste histórico de compra. El usuario ha autorizado trabajar con los costes de PrestaShop, sin exigir su validación manual previa.

## Atendido por

Se reutiliza el lector del registro inicial nativo de pedidos. Solo muestra un empleado si la relación es inequívoca y coincide con el registro original. Si una cuenta de TPV se comparte, no garantiza qué persona física atendió. No se infiere vendedor por turno, sesión abierta o cambios posteriores. La relación exacta con el cajón y los movimientos POSTPV sigue pendiente; esta entrega no cierra el PR #181.

## Más vendidos y calidad

El ranking conserva cada combinación y añade foto de catálogo, referencia y unidades. Las imágenes proceden del ID de imagen de la tienda correspondiente, sin instalar complementos. Si no se conoce una imagen, no se sustituye por la de otra tienda. El botón **Consultar calidad** permite leer el catálogo para obtener su recuento de incidencias; no cambia productos.

Los medios de pago de Inicio proceden de los pedidos leídos. Bizum, transferencia y nombres personalizados aparecerán si existen en ese periodo y tienda; no se convierten en Tarjeta por una clasificación fija.

## Categorías de producto

1. Abrir el producto y entrar en **Organización**.
2. Activar la edición de categorías, marca, proveedor e impuestos.
3. Desplegar las madres para ver sus hijas. La búsqueda cubre todo el árbol y muestra los padres de cada coincidencia.
4. Marcar las categorías asociadas y elegir una **Principal**. Una principal también debe estar asociada.
5. Guardar/publicar desde la ficha utilizando el recorrido ya existente. Elegir categorías no crea ni modifica categorías del maestro de PrestaShop.

Los plegados se conservan durante la edición de esa ficha. La persistencia entre sesiones del árbol no forma parte de esta entrega. Un ciclo o categoría huérfana en origen no debe ocultar la categoría ni bloquear la selección.

## Recorrido para ChatGPT

Usar su propia cuenta de Totus autorizada. Identificar siempre la tienda. Leer producto y asociaciones antes de editar, cambiar únicamente los campos pedidos y publicar desde la ficha. Verificar por relectura de la misma tienda y producto, comparando las categorías asociadas y principal. Ante respuesta incierta, consultar el registro antes de repetir una escritura. No instalar módulos ni utilizar credenciales ajenas.

## Pruebas de esta entrega

- Playwright Inicio: tiendas independientes, ventas, margen de pedidos/resumen, medios de pago reales de la respuesta, fotos, empleado acreditado, filtros, paginación, redimensionado y persistencia del diseño. Datos simulados, no ventas reales.
- Playwright categorías: selección/principal y creación/edición de características, valores e imágenes de variaciones a 390, 969 y 1920 px. Escritura simulada con relectura del fixture; no afirma escrituras reales en tiendas.
- Paleta de Interfaz: cascada CSS real para reloj y fecha a 390, 768, 1017, 1440 y 1920 px.
- Lógica: coste de combinación, consulta única por producto/variante repetida, respuesta de otra tienda rechazada, cancelación, falta de coste, margen cero y cobertura parcial.

La publicación y la comprobación real en producción se registrarán por separado. El resto de peticiones del 12/11 figura en `PLAN_MEJORAS_2026-11-12.md`; no se consideran terminadas por existir este manual.
