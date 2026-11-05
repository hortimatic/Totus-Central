# Cotejo documental: lectura completa de originales

## Cambio verificable

El editor sin IA relee los PDF originales asociados a la recepción. Usa las coordenadas del texto para mantener las columnas, nombres multilínea y continuaciones entre páginas. Conserva el lector anterior para formatos no reconocidos. No altera originales, textos de origen, contabilidad ni existencias. El resultado solo se guarda por acción explícita y con revisión de los documentos.

Descuentos y servicios se muestran aparte con su motivo de exclusión. La lectura conserva cantidades documentales; no supone que una caja o un pack equivalga a una unidad.

Cuando el usuario tiene acceso a PrestaShop, consulta referencias exactas de productos y combinaciones en la conexión de la misma tienda. Recorre todas las páginas y rechaza respuestas ajenas, repetidas o incompletas. Solo incorpora un EAN unívoco, conserva su procedencia y no reemplaza el impreso en el documento. Las claves permanecen en el servidor. Si la consulta falla, el editor sigue disponible y explica que el catálogo no se verificó.

## Pruebas y alcance

- Playwright a 390, 1017 y 1440 píxeles: documentos revisados, diferencias de cantidad, fallo de guardado, reintento, una sola revisión e historial. El recorrido intermedio sustituye un texto guardado incompleto por dos PDF ficticios leídos por PDF.js y verifica que las fuentes no se modifican.
- Seis PDF reales ya autorizados se leyeron localmente con el lector del navegador, sin escribir resultados: las entradas tienen 29, 65 y 39 movimientos respectivamente; todas sus páginas se procesan. Los originales y sus datos no se incluyen en el repositorio.
- Pruebas de columnas, continuaciones de página, cantidades frente a importes, servicios, EAN ambiguos, respuestas fuera de la selección, paginación repetida y cambio de sesión.

## Lo que esta corrección no permite afirmar

Leer el documento completo no demuestra que todos sus productos estén emparejados correctamente. El contraste con las revisiones existentes sigue mostrando correspondencias pendientes, especialmente cuando proveedor y tienda usan nombres distintos o formatos de venta diferentes. Un mismo EAN con variantes de nicotina contradictorias permanece pendiente. Las equivalencias confirmadas deben resolver esas ambigüedades: no se fuerza una coincidencia ni se reutiliza un cotejo anterior como prueba independiente de exactitud.

Este cambio no resuelve el lector de cierres POS TPV ni la separación del módulo general de automatizaciones. Ambos siguen siendo frentes distintos.
