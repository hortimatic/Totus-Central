# Pricing · trabajo con productos y variantes

## Datos y alcance
Pricing estudia precios y márgenes comerciales; no crea gastos, facturas, cajas ni modifica las existencias de PrestaShop.
Las marcas contienen familias y las familias productos. Un producto puede ser simple o tener variantes con referencias independientes.
La recuperación se ha contrastado con Totus Pricing V5 y el relevo del 27/08/2026. No se han restaurado sus conexiones antiguas.

## Producto simple
1. Crea nombre y referencia única; elige familia y tipo Simple.
2. Añade proveedores con coste sin IVA ni recargo, descuento comercial y envío por unidad. Selecciona el proveedor usado para el estudio.
3. Indica PVP actual y, si estás estudiando un cambio, PVP propuesto. El propuesto tiene prioridad para la simulación.
4. El descuento de venta reduce lo que cobras. La competencia es una referencia, no un coste.
5. Guarda. El historial conserva la ficha guardada; si falla su registro, la herramienta lo avisa sin afirmar que no se guardó el producto.

## Producto con variantes
1. Elige Con variantes y guarda el producto.
2. Añade una variante por presentación: referencia única, nombre, coste de compra y PVP propios.
3. Atributos: escribe por ejemplo “Resistencia: 0,8 Ω; Color: Negro” o “Nicotina: 10 mg; Volumen: 10 ml”.
4. Nicotina y volumen también tienen campos numéricos específicos. Deben describir la misma presentación; no son el número de unidades del paquete.
5. Cada fila muestra compra, coste con IVA/RE, PVP, beneficio por unidad y margen. El resumen presenta un intervalo de las variantes activas; no utiliza un precio ficticio del producto principal.
6. Una variante inactiva sigue visible y puede editarse y reactivarse. No es necesario borrarla.
7. El descuento guardado en el producto se aplica al beneficio de todas sus variantes. Guarda el cambio de descuento para actualizar el resumen de variantes.
8. Guardar una variante, proveedor o competencia conserva el borrador de la ficha principal y actualiza sus listas.

No confundir nicotina, resistencia o tamaño. La equivalencia excepcional 11 mg = 10 mg de un pedido no se aplica automáticamente a otros productos.

## Cálculo
Coste con IVA/RE = (coste de compra menos descuento de proveedor + envío por unidad) × (1 + IVA/100 + RE/100).
Para variantes, su coste de compra propio sustituye al coste del proveedor principal.
Venta final = PVP × (1 − descuento de venta/100).
Beneficio por unidad = venta final − coste con IVA/RE.
Margen % = beneficio / venta final × 100.
Los tipos salen de la configuración de Totus Central. Un coste desconocido se muestra con un guion, no como coste cero. Un cero introducido expresamente sí es un valor.
En compras nacionales, el impuesto especial incluido por el proveedor ya forma parte del coste: los campos informativos no se vuelven a sumar.

## Consultas
Guardar consulta crea un estudio independiente. Reutilizar carga sus importes y actualiza inmediatamente los resultados; Guardar cambios actualiza esa consulta. Guardar como nueva conserva la consulta anterior y crea otra con los datos cargados. Nueva consulta limpia el formulario para crear otra. Convertir a producto utiliza el flujo existente con su familia y proveedor.

## Ejemplos recuperados
Se recuperaron seis productos y tres variantes de los apuntes disponibles: XROS 4 Mini, XLIM y cartuchos de 0,6/0,8/1,2 Ω, y Sales Demo de 0/10/20 mg.
Los importes documentados son 3,20/5,70 € para 0 y 10 mg y 3,70/6,30 € para 20 mg. Son datos de demostración, no una tarifa vigente. Los campos no documentados se dejaron vacíos; las referencias provisionales llevan DEMO-RECUP y constan en notas.

La comparación de competencia usa precios con descuento y envío y excluye los marcados sin stock. Muestra mínimo, media y máximo. Si no se escribe una referencia manual, el producto simple se compara con el mínimo disponible. La estimación mensual del producto simple multiplica su beneficio unitario por las unidades/mes indicadas; no es un ingreso contable ni una predicción de demanda.

## Alta completa y recuperación funcional · revisión del 24/10/2026

Al elegir **Con variantes**, el editor aparece antes de guardar el producto. Añade cada referencia con nombre, atributos (por ejemplo «Nicotina: 10 mg; Volumen: 10 ml» o «Resistencia: 0,8 Ω»), compra sin IVA/RE y su PVP. Los precios pueden ser distintos para cada nivel de nicotina. Se pueden quitar filas nuevas sin eliminar variantes ya guardadas. Cambiar de tipo conserva los campos del borrador; solo se guardan variantes cuando el tipo final es «Con variantes».

En un producto simple puedes indicar también el proveedor inicial, el coste, el descuento de compra y el envío por unidad. El proveedor admite un nombre existente o uno nuevo. Es opcional, pero sin coste no hay margen calculable. Los costes nacionales no añaden de nuevo impuestos especiales ya incluidos en la compra.

**Guardar** usa una transacción: producto, variantes nuevas, coste inicial e historial se guardan juntos o se revierten juntos. Ante un error se conserva el formulario para corregirlo. La referencia de una variante no puede repetirse cambiando mayúsculas o espacios. Si otra persona modifica el producto, se rechaza el guardado antiguo en lugar de sobrescribirlo. No borres variantes existentes para recrear el producto.

**Descuentos y rentabilidad** compara promociones del 0 al 50 %, de cinco en cinco. Si hay varias variantes, elige cuál comparar. Cada fila indica precio final, beneficio por unidad y margen. La clasificación original usa pérdida, crítico (menos del 18 %), ajustado (menos del 25 %), sano y muy sano (objetivo de familia, 35 % si no se definió). Estas simulaciones no cambian precios guardados.

**Guardar y siguiente** guarda primero y abre el siguiente producto de la misma familia; si no hay otro, vuelve a la lista. Guardar y Cancelar siguen disponibles.

Las consultas guardadas ya no se limitan visualmente a las veinte primeras: tienen búsqueda y un área con desplazamiento. **Historial** muestra su uso y sus precios anteriores. Convertir una consulta crea un producto **Pendiente** con su coste y deja trazabilidad en la misma transacción; no utiliza el estado incorrecto «ACTIVO».
