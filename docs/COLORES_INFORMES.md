# Colores del diario mensual
## Uso
En Administración → Configuración fiscal → Categorías de gastos → Editar, seleccionar «Color y grupo en el Excel mensual».
- Automático: conserva el color original de los pagos importados. Sin color original, utiliza la categoría.
- Otros: verde.
- SS y nóminas: naranja.
- Pedidos: azul.
- Gastos fijos: amarillo.
- IRPF / impuestos pagados: verde claro.
La elección se guarda en Supabase y se conserva al cambiar de equipo. Solo administración puede modificarla.
Una selección explícita sustituye el color automático de esa categoría en los informes que se generen después, incluidos periodos anteriores. Para recuperar el criterio original, seleccionar Automático.
## Alcance
El color de cada concepto y el grupo de su subtotal se resuelven juntos. Un alquiler con retención 115 sigue siendo alquiler; no es un pago del modelo. Indemnizaciones se agrupan con nóminas.
Los colores no deciden si un gasto es fiscalizable, su importe o su conciliación.
La vista previa del diario y el Excel descargado utilizan el mismo libro. La tabla de gestoría conserva su formato propio y bandas de lectura; no se convierte en el diario mensual.
Los Excel ya descargados no se modifican automáticamente: deben generarse de nuevo.
## Auditoría 24/10/2026
Se detectó: uso del modelo de retención para colorear alquileres como IRPF; colores conservados en source_ref.source.color que se ignoraban; colores ARGB rechazados; posible discrepancia entre el color original y el subtotal; indemnizaciones fuera del grupo de personal.
Se unifica la regla en src/expense-colors.js. Se conservan importes, fórmulas, columnas, fuentes originales y clasificación fiscal.
Prueba específica: tests/expense-colors-qa.mjs; comprueba también los estilos del archivo XLSX escrito y reabierto.

## Copias de seguridad
La preferencia opcional report_group se guarda con las categorías. Se excluye únicamente esta columna de presentación y su restricción del identificador de estructura, como ya se hacía con ui_preferences. Las copias antiguas conservan su compatibilidad y restauran Automático; las nuevas preservan la elección. La validación de valores y el resto de controles de recuperación se mantienen.
Verificado en producción que el identificador vuelve a 557e56cd01a94a52e443ddd1184b3088089c1864fddeaab91bf44ae6e2a2e1fd, el mismo de las últimas copias verificadas. No se ejecuta restauración sobre la contabilidad en uso. Prueba aislada: tests/expense-report-db-qa.sql.

## Cambiar un gasto ya registrado
En Gastos, abre la ficha del gasto y busca «Categoría del pago en el Excel».
Elige Otros, SS y nóminas, Pedidos, Gastos fijos o IRPF / impuestos pagados.
- «Guardar solo categoría del Excel» aplica únicamente esa elección, también en periodos cerrados. No exige volver a introducir el desglose del gasto importado.
- Los demás campos que hayas editado permanecen en pantalla pendientes de guardar; no se guardan ni se descartan con ese botón.
- En un gasto nuevo, la elección se guarda junto con el gasto al pulsar Guardar.
- Genera otra vez la vista previa o descarga: un archivo Excel descargado anteriormente no puede actualizarse solo.
Prioridad: elección del gasto → elección de la categoría general → color original → categoría automática.
En un diario histórico reconstruido desde el Excel original, la elección del pago vinculado se conserva; tiene prioridad sobre la elección de la factura si ambos registros están asociados.
Automático elimina solo la elección individual y recupera las reglas generales/originales.
Esta es una categoría de presentación del pago. La categoría fiscal sigue en Conceptos y conserva sus reglas de deducción y protección de periodos.
La elección se almacena en source_ref.report_display.group, sin borrar el resto del origen. Se incluye en las copias existentes sin cambiar la estructura ni su identificador.
ChatGPT puede guardar esta preferencia mediante totus_set_expense_report_group(p_id,p_group,p_expected_group), con permisos de edición de Gastos y la elección actual como control de cambios simultáneos. No debe actualizar el JSON completo ni cambiar datos fiscales para modificar un color.
