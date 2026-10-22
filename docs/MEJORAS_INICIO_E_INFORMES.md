# Inicio, control interno e informes
Actualización de operativa: 22 de octubre de 2026.

## Inicio
La gráfica y los cuatro indicadores utilizan el mismo rango de fechas, tienda y búsqueda. Selecciona Desde y Hasta y pulsa Aplicar. Este mes recupera el mes actual. Se muestran ventas e ingresos, gastos fiscalizables registrados y gastos internos por separado. Más de 93 días se agrupan por meses. Las referencias históricas mensuales aparecen en su fecha registrada: no se distribuyen artificialmente entre días.
Ingresos menos gastos descuenta los gastos fiscalizables registrados; no descuenta control interno ni representa el saldo bancario o el resultado definitivo del IRPF.
Los pendientes de cobro siguen disponibles en Facturación y cobros, sin ocupar el cuarto indicador superior.

## Control interno
Tipo de documento Control interno en un gasto activa Solo información interna y excluye el registro del cálculo fiscal. Se completa con conceptos, importe, fecha, forma de pago y justificante como los demás gastos. No duplica impuestos: los modelos mantienen el registro único ya utilizado en Fiscalidad. No convertir nóminas, Seguridad Social o RETA en internos sin justificar su tratamiento.
La clasificación documental Control interno usa el tipo compatible Otro y la categoría control_interno. No cambia las restricciones de los datos históricos.
Al seleccionar control interno, los campos de deducción de cada línea quedan desactivados y a cero. Inicio, Informes y el resumen del paquete muestran ingresos menos gastos fiscalizables, sin descontar control interno.
Los gastos internos generales y los impuestos pagados se presentan juntos en el bloque Control interno, con acceso a sus fichas y documentos.

## Gestoría
El selector de año, mes y trimestre aplica el periodo a los filtros de Informes. Comprueba siempre el rango, tienda y búsqueda mostrados antes de descargar.
La descarga Paquete del periodo incluye:
- tabla Excel de gestoría con las columnas existentes y gastos fiscales revisados;
- ingresos detallados y diarios mensuales del periodo;
- documentos vinculados a los gastos y a las facturas de cliente emitidas, incluso cuando sus ingresos ya están incluidos en caja;
- justificantes de impuestos pagados y listado de registros sin adjunto.
Se selecciona el documento por el vínculo con su gasto o factura, no únicamente por la fecha del archivo. Los originales pasan la verificación de tamaño y huella antes de generar el ZIP. Si falta un original vinculado o no se puede leer, la descarga falla; no se presenta un paquete incompleto como verificado.
Los registros todavía sin adjunto se relacionan explícitamente. Descargar no concilia ni modifica registros.
Las descargas anuales complementarias se conservan en su apartado.

## Orden de los bloques
Usa Subir o Bajar. El orden se guarda por usuario en Supabase y se carga al iniciar sesión desde cualquier dispositivo. Restablecer orden recupera la distribución inicial. No se guarda información contable en el navegador.
La preferencia es opcional y está incluida en las copias nuevas, como parte de profiles. Una copia anterior puede restaurar esa preferencia a vacío; las comprobaciones de compatibilidad contable no cambian por esta columna de presentación.

## Explicaciones de ingresos
Cada fila tiene un botón de información. La variación del dinero que queda en caja es cierre menos apertura: abrir con100€ y dejar120€ produce+20€, que no es un nuevo gasto ni se suma dos veces a las ventas. Se conserva el desglose completo.
