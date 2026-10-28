# Cierre de revisión: Pricing y Cajas — 28/10/2026

## Última incidencia

Cambiar únicamente la variante del estudio de descuentos provocaba el aviso
«Cambios sin guardar», aunque esa selección no forma parte de la ficha que se
guarda. Se identifica ese selector como control de vista previa mediante el
mecanismo `data-draft-ignore` que ya utiliza la aplicación. No se modifica el
protector general de formularios, las variantes ni los cálculos.

La prueba nueva comprueba tanto la salida sin aviso después de elegir una
variante como el aviso obligatorio al editar el nombre del producto, la
cancelación sin perder lo escrito y la salida descartando cambios sin guardar
nada en la base. El caso forma parte de `pricing-integral-browser-qa.mjs`.

## Comprobaciones que definen el cierre

| Área | Criterio de aceptación |
|---|---|
| Pricing | Catálogo y filtros; producto simple y variantes; costes, IVA/RE, PVP y descuentos; proveedores y competencia; marcas y familias; consultas, conversión e historial |
| Protección de Pricing | Importes inválidos o desconocidos, permisos, reintentos sin duplicar, conservación de cambios reales y cancelación |
| Cajas | Tiendas y cajas separadas; borradores; cierre, reapertura, conciliación de importados; filtros, tarjeta, retiradas, efectivo final y apertura siguiente |
| Protección de Cajas | Ningún saldo desconocido se inventa como cero; comprobación de cada caja; descuadres, fechas, permisos, reintentos, edición simultánea y conservación del origen |
| Integración | Coherencia ficha/listado/Inicio/Informes/Fiscalidad y exclusión de borradores o ingresos ya cubiertos por referencias mensuales |
| Descarga | Excel legible, estados y cifras coincidentes con los registros y total coincidente con las filas |
| Presentación | Matrices automatizadas entre 320 y 2560 píxeles; lectura visual adicional en la sesión real, incluido móvil |
| Entrega | Batería común aprobada, publicación aprobada y comprobación del archivo corregido publicado |

Los informes `AUDITORIA_PRICING_2026-10-28.md` y
`AUDITORIA_CAJAS_2026-10-28.md` detallan las correcciones y los recorridos.
La confirmación de ejecución se vincula al resultado de GitHub Actions del
cambio y de su publicación; no basta con que existan archivos de pruebas.

## Comprobación adicional con la sesión real

La conexión del navegador se restableció reiniciando su controlador y vinculando
de nuevo la pestaña existente. Esto permitió comprobar catálogo, buscador,
variantes de nicotina, márgenes, selector del estudio, historial, directorios y
el formulario de alta con variantes sin guardar productos.

En Cajas se revisaron indicadores, filtros de fecha y tienda, un cierre manual,
un importado, las aperturas independientes propuestas para la siguiente jornada
y su coincidencia con Inicio. Se descargó el XLSX real y se contrastaron sus
filas, estados y totales. Se comprobó la correspondencia del ingreso fiscal,
separando el borrador existente y los otros ingresos. No se aceptó ese borrador
ni se cambió ningún registro para conseguir coincidencias.

El informe privado en OneDrive conserva el resultado concreto de esa sesión.
Las pruebas de escritura, eliminación, reintento y reapertura utilizan datos
ficticios y PostgreSQL aislado: no se modifica la contabilidad real para ensayar.

## Significado de la aceptación

«100 % de comprobaciones superadas» significa que todos los criterios de esta
matriz y las pruebas asociadas han pasado para la versión entregada. No significa
que todo software futuro, navegador o situación no contemplada esté garantizado
sin fallos. Se conserva la estructura, los datos y las funciones existentes.
No se avanza al siguiente módulo sin indicación del titular.
