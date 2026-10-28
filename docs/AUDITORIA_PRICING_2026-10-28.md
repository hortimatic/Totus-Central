# Auditoría de Pricing — 28 de octubre de 2026

Primera entrega de la revisión por módulos solicitada por el titular. No autoriza avanzar al siguiente módulo. Se conserva la estructura, las funciones y los productos existentes. Los ejemplos y archivos de prueba son ficticios.

## Defectos reproducidos y correcciones

1. **Coste vacío de proveedor:** se guardaba como cero. Se exige un importe explícito; el cero escrito sigue siendo válido.
2. **Precio vacío de competencia:** se guardaba como cero. Se exige un precio explícito.
3. **Resumen al cambiar a variantes:** podía conservar el beneficio mensual del producto simple. Se vacían los resultados que no pueden atribuirse al conjunto de variantes.
4. **Entradas inválidas en estudios:** el conversor tolerante podía representar texto inválido como coste cero. Las vistas previas distinguen importe desconocido, cero y decimal español válido.
5. **Respuesta interrumpida de coste de proveedor:** al reintentar podía crearse otra oferta. El formulario conserva un identificador de operación; el servidor devuelve el alta original para la misma petición y rechaza reutilizarla con otros datos. Se conservan los permisos normales y las llamadas anteriores.
6. **Objetivo de margen cero:** se reemplazaba por el objetivo por defecto al comparar descuentos. Se conserva el cero configurado.
7. **Consultas en móvil:** las acciones se partían por palabras y el buscador tenía formato distinto. Se ajustan las acciones en filas y se aplica el formato de campo de la herramienta.
8. **Anchuras intermedias y contenedor de descuentos:** podían desbordar el ancho de Pricing. La cabecera permite cambio de fila y las tablas conservan su desplazamiento dentro del contenedor.
9. **Cambio rápido de anchura:** la navegación animaba su altura y podía cubrir temporalmente la página. Se anima únicamente su desplazamiento lateral; no se cambia la organización de navegación.
10. **Ayudas de campos:** se explican PVP actual/propuesto, unidades mensuales, descuentos, coste del proveedor, familia, estado e impuesto especial dentro del contexto de Pricing.

## Inventario de recorridos comprobados

| Zona | Comprobaciones |
|---|---|
| Catálogo | Búsqueda de texto/referencia/estado, acentos, indicadores, apertura y retorno |
| Producto simple | Alta, edición, relectura, PVP actual/propuesto, descuento, cantidades y guardado |
| Variantes | Alta junto al producto y posterior, referencia, atributos, nicotina, volumen, coste y PVP independientes |
| Estado de variante | Desactivar/reactivar, excluir inactivas de intervalos, conservar las otras variantes |
| Rentabilidad | Coste con IVA/RE, beneficio unitario, margen y simulación de descuentos |
| Proveedores | Alta/edición/borrado del directorio; costes, descuento, transporte, selección y referencias protegidas |
| Competencia | Alta/edición/borrado, descuento, envío y disponibilidad |
| Marcas y familias | Alta/edición/borrado, duplicados, relaciones protegidas y objetivo de margen |
| Consultas | Guardar, reutilizar, actualizar, guardar copia, buscar e historial |
| Conversión | Consulta a producto con proveedor, preservando la consulta y su estudio |
| Historial | Datos guardados, usuario, importes y contexto de impuestos de la instantánea |
| Seguridad de datos | Duplicados, cancelación, permisos del procedimiento, reintentos y rechazo de entradas inválidas |
| Integración | Coherencia ficha/listado/resumen/historial; estudiar precios no crea gastos, cajas ni facturas |

La configuración de IVA y recargo alimenta los estudios. El impuesto especial informativo no se suma otra vez al coste. Los estudios no publican precios en PrestaShop ni son movimientos contables.

## Pruebas reproducibles

- `tests/pricing-variants-qa.mjs`: cálculos, rangos, entradas inválidas, cero, atributos y decimales españoles.
- `tests/pricing-directory-browser-qa.mjs`: directorios, relaciones protegidas, ofertas y competencia.
- `tests/pricing-variants-browser-qa.mjs`: crear/guardar/reabrir, variantes, consultas, fallos de guardado y conservación de borradores.
- `tests/pricing-taxonomy-layout-qa.mjs`: columnas, nombres largos, botones y nueve anchuras.
- `tests/pricing-integral-browser-qa.mjs`: diez recorridos adicionales, incluidos respuesta interrumpida, coherencia completa y matriz de pantallas.
- `tests/pricing-db-qa.sql`: transacciones del producto, variantes, permisos y conversión en PostgreSQL aislado.
- `tests/pricing-provider-retries-db-qa.sql`: repetición sin duplicados, historial único, petición alterada y permiso denegado en PostgreSQL aislado.

La matriz ampliada usa 320, 360, 375, 390, 414, 600, 700, 768, 800, 900, 1024, 1280, 1366, 1440, 1536, 1920 y 2560 píxeles, en catálogo, ficha y cuadros asociados. Son tamaños concretos comprobados, no una promesa sobre todos los dispositivos o escalas posibles. Las tablas anchas mantienen desplazamiento horizontal dentro de su propia zona.

Las capturas deben corresponder a la pantalla que se revisa, sin confundir un diálogo de cambios sin guardar con la ficha del producto. Los artefactos de GitHub incluyen las capturas de prueba y el resultado `pricing-integral.json`.

## Alcance y límites

Se ha consultado en producción la definición de los procedimientos y la protección de las diez tablas de Pricing. Las escrituras de prueba se ejecutan con datos ficticios en entornos aislados; no se crean productos ficticios en la contabilidad real.

El control interactivo de la sesión real del titular quedó bloqueado por el navegador al no poder verificar su dirección con seguridad. No se ha eludido esa protección. Esta circunstancia se comunica en la entrega: las pruebas aisladas y la publicación no se presentan como una aceptación visual realizada en esa sesión.

La batería de GitHub y la publicación son requisitos de entrega. Su resultado definitivo debe consultarse en las comprobaciones del PR y en el flujo de publicación correspondiente. Esta auditoría cubre Pricing; los demás módulos necesitan su propia entrega y autorización para continuar.
