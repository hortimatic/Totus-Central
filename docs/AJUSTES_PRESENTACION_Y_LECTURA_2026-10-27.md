# Gastos, informes, ayudas y lectura del chat — 27/10/2026

## Alcance
Corrección de presentación y uso sobre la versión 03b43c15. No cambia fórmulas, permisos, esquemas, importes ni estados contables. No importa conversaciones de Google ni introduce servicios de IA.

## Cambios
- Control interno usa la misma definición de columnas y botones que el registro de gastos, también en Informes. Conserva su bloque, tratamiento no deducible y adjuntos. Los pagos de modelos continúan siendo un único registro canónico en Fiscalidad; no se copian como un segundo gasto.
- Se conservan las diferencias y referencias de los apuntes bancarios vinculados a facturas. No se convierten en gastos internos ordinarios ni se deducen dos veces.
- Cada una de las 14 filas del cálculo fiscal tiene una explicación específica. Distingue acumulado anual, trimestre, componentes ya incluidos, anticipos y retenciones. La explicación del anticipo previo está en su icono, no en un párrafo suelto. No se ha modificado el algoritmo tributario.
- Las ayudas de campos conocidos se mantienen; se contextualizan fecha de gasto, cierre, archivo, ajuste, ingreso y tipo de producto. Se corrige la explicación de categoría y margen. Los campos sin explicación específica ya no muestran un icono con una frase genérica vacía.
- Gestoría conserva todos sus controles: año, trimestre y mes se agrupan y alinean. Las descargas auxiliares se llaman Excel de consulta y describen su contenido. Se mantienen el paquete ZIP, tabla, PDF, descargas anuales y orden de bloques guardado en la cuenta.
- El chat actualiza la lectura al mostrar mensajes en el extremo reciente de la conversación. No lo hace en segundo plano, con filtros, durante un diálogo ni mientras se lee más arriba. Guarda solo hasta la secuencia mostrada, en el canal y usuario correspondientes; un fallo no borra avisos ni afirma éxito. Se conservan borrador, cursor y desplazamiento. La actualización periódica puede recibir mensajes mientras se escribe en el compositor.

## Comprobaciones
Pruebas con datos ficticios: columnas idénticas, ficha de impuesto, ayudas de las 14 cifras, filtros y paquete ZIP con originales, orden persistente, controles y geometría en escritorio/tableta/móvil. Pruebas del chat: apertura, segundo plano, filtros, fallo y reintento, borrador, historial y cambio de canal. La batería general de CI se ejecuta antes de publicar.

La inspección de Google Chat se limitó a navegación y opciones visibles de organización. No se enviaron mensajes ni se modificaron preferencias. Esta entrega no pretende reproducir todas sus prestaciones.

## Protocolo de mantenimiento
Reutilizar `expenseTableColumns` en vez de crear una tercera tabla. Las ayudas deben describir el dato real y su efecto; no añadir textos genéricos por defecto. Probar el marcado automático sin operaciones contables. Mantener el control de contexto de usuario y canal en cualquier operación asíncrona.
