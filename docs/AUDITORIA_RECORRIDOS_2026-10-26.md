# Revisión de recorridos de Totus Central — 26/10/2026

## Alcance y conservación

Base de partida: `00d1204da6af5e2d78ad7e19f71a6957ae38990a`, rama de producción `totus-central`.
Se conservan módulos, organización y datos. Esta revisión corrige comportamientos; no sustituye Pricing ni simplifica los módulos existentes.
No se han creado gastos, cierres, facturas, usuarios ni tareas ficticios en producción. Las escrituras de prueba se realizan con `tests/app-mock.html` o adaptadores aislados. Las consultas de integridad sobre la base real son de lectura.

## Fallos encontrados y correcciones

| Caso | Antes | Corrección y comprobación |
|---|---|---|
| Rectificativa de proveedor negativa | Un abono de −12,62 € aparecía como 0 € mientras se rellenaba; se guardaba negativo. | El resumen conserva el signo. Se compara formulario, registro guardado, ficha reabierta y registro exportable. |
| Redondeo de líneas de gasto | El formulario redondeaba después de sumar; PostgreSQL calcula cada impuesto por línea. Dos bases de 0,03 € al 21 % daban 0,07 € en el formulario y 0,08 € en servidor. | Cálculo por línea y redondeo simétrico para abonos. El pago propuesto usa el mismo total que se guarda. |
| Simulación de retenciones | El adaptador de pruebas restaba retenciones al gasto contable y no reproducía los céntimos de PostgreSQL. | Se separan coste contable e importe a pagar. Ejemplo: base 100 €, IVA 21 €, retención 19 €: gasto 121 €, pago 102 €. |
| Historial de actividad truncado | Solo se conservaban los últimos 1.000 eventos en pantalla; buscar fechas anteriores y exportar no consultaba el resto. | Lectura paginada completa con límite de seguridad explícito, sin truncamiento silencioso. Pantalla de 100 resultados por página; CSV de todos los resultados filtrados. |
| Historiales separados | La pantalla general no consultaba la actividad guardada de chat y tareas ni las copias conservadas. | Se reúnen esos historiales bajo sus permisos existentes; no se crean permisos nuevos ni se inventan actores desconocidos. |
| Filtros del Log en edición | Actualizar podía borrar valores escritos todavía sin aplicar. | La actualización conserva valores, foco y selección. Escribir no aplica un filtro hasta pulsar Aplicar. |
| Duplicar plantillas con códigos largos | Un código de 50 caracteres provocaba un bucle al truncar también el sufijo de copia. | Se reserva espacio para el sufijo y se comprueba unicidad sin bucle ilimitado. Se mantienen estilo, contenido y originales predeterminados. |
| Numeración de series decimal | Año, dígitos y siguiente número se redondeaban silenciosamente. | Se exigen números enteros válidos antes de guardar, sin cambiar el valor elegido. |
| Posición y tamaño del logo | La posición guardada no se utilizaba al generar la factura; el tamaño se aproximaba en píxeles. | Centro y derecha se aplican a la cabecera; izquierda conserva la disposición junto al titular. El ancho se expresa en milímetros. |
| Tipografía de la plantilla | Clásica imponía Georgia aunque se eligiese otra fuente. | Los tres estilos respetan la fuente seleccionada. |
| Vista previa e impresión de plantilla | El ejemplo ofrecía imprimir una factura que no existía como registro: el botón no hacía nada. | Ejemplo independiente de los registros contables, imprimible y exportable a PDF sin guardar. La impresión usa los estilos de la versión actual. |
| Edición de colores y comprobación del diseño | Selectores casi invisibles; no había comprobación en vivo de los cambios sin guardar. | Colores visibles, vista previa con factura/proforma, todos los campos conservados y acciones completas visibles en cuatro tamaños. |
| Logo dañado | Se comprobaba tipo/tamaño, pero no que la imagen se pudiese leer. | Validación de imagen antes de subir. El logo local se previsualiza sin enviarlo al servidor y el PDF no depende de una URL temporal del editor. |
| Notas predeterminadas | Se guardaban sin aplicarse a las notas de una nueva factura. | Se identifican como internas y se trasladan a ese campo, conservando las notas personalizadas al cambiar de plantilla. Nunca se imprimen. |

## Recorridos revisados por módulo

| Módulo / configuración | Recorridos y comprobaciones |
|---|---|
| Acceso y sesión | Sesión guardada, sesión ausente y error de conexión; recuperación; rechazo de acceso y botones sin permiso; una única instancia del cliente; protección de borradores. |
| Inicio | Periodo, gráfica, ventas, gastos fiscalizables e internos separados, accesos rápidos, aperturas por caja, previsión y avisos; contraste con Informes. |
| Pricing | Alta, variantes y atributos, precios distintos, cálculo, guardado y reapertura, proveedores, marcas y familias, históricos, activar/desactivar y geometría móvil. |
| Cajas | Dos tiendas y las dos cajas de Hortimatic, apertura, efectivo dejado, tarjeta, retiradas, otros cobros, conciliación, estados, exportación y protección de periodos. |
| Gastos — registros | Alta y edición, pago, duplicados, rectificativas, retenciones, clasificación fiscal e interna, categorías de color, periodos protegidos, adjunto independiente y borrado con motivo. |
| Gastos — facturas | Búsqueda, fechas, documentos presentes/ausentes, vista previa, descarga, sustitución y asociación; coherencia de filtros con Excel. |
| Facturación — documentos | Borrador, proforma, conversión, externa con original, rectificativa y devolución parcial/total, validación numérica, emisión y bloqueo de documentos emitidos. |
| Facturación — clientes | Alta, edición, persistencia y uso en documentos. |
| Facturación — plantillas | Logo, formato, valores predeterminados, duplicación, limpieza de sustitución fallida y conservación del diseño de facturas emitidas. |
| Facturación — series | Alta, duplicados, identidad bloqueada al usar la serie, año y siguiente número enteros. |
| Recepciones | Proveedor existente/nuevo, ambos grupos de documentos, lectura del original, cotejo, equivalencias, búsqueda y fechas, descarga, retirada protegida de documentos y aislamiento contable. |
| Tareas | Alta, recurrencia, checklist, estado, edición de una fecha y futuras, responsables, filtros, vistas mensual/semanal/lista, historial, archivo y enlace al mensaje. |
| Chat | Canal y conversación, participantes, hilo, búsqueda y fechas, fijados, reacciones, tareas, borradores, adjuntos, reintentos y errores; desplazamiento y nueve tamaños de pantalla. |
| Documentos | Subida PDF/imagen/Excel/CSV/texto, vista previa, descarga, ZIP con nombres repetidos, archivo, sustitución, permisos y eliminación de un documento vinculado. |
| Fiscalidad | Periodos, ingresos conciliados, ajustes, internos fuera del gasto deducible, previsión propia, anticipos previos y reserva; consistencia con Inicio e Informes. |
| Informes | Meses y trimestres, filtros, vista previa y XLSX, colores por categoría/gasto, orden de bloques, tabla de gestoría, ZIP del periodo y anual con documentos originales y lista de faltantes. |
| Administración — usuarios | Alta/edición simuladas, rol, permisos individuales, visibilidad de contraseña y protección de administración. |
| Administración — roles | Crear, renombrar, configurar, asignar, restablecer y eliminar rol no utilizado; acceso permanente de administración. |
| Administración — negocio | Datos del titular sin alterar parámetros fiscales; alta/edición/desactivación de tiendas y cajas; rechazo de códigos repetidos. |
| Administración — fiscal | Parámetros válidos e inválidos, categorías y colores, aislamiento de datos del titular y cierre protegido del periodo. |
| Administración — almacenamiento | Medidas por servicio, documentos y base de datos separados, previsión y límites, error visible y reintento sin mostrar un falso cero. |
| Administración — copias | Programación y retención, selección de copia, componentes fraccionados, descarga, integridad, recuperación y cancelación. Las restauraciones de prueba utilizan adaptadores o bases desechables, nunca la contabilidad real. |
| Administración — Log | Historial superior a 1.000, fuentes por módulo, permisos, actor, fechas de Madrid, filtros combinados, actualización, detalle, paginación y CSV completo. |
| Cabecera y móvil | Reloj, calendario y avisos, navegación a tareas, control de borradores; geometría en escritorio, tableta y móvil. |

La comprobación visual por clic de las pestañas tradicionales cubre 76 estados en cuatro anchos; tareas, chat y recepciones tienen pruebas propias. No se equipara renderizar una pantalla con probar todas sus operaciones: las operaciones se comprueban en los programas de recorrido correspondientes.

## Comprobaciones de datos reales

- En 572 gastos con líneas: cero diferencias de coste entre cabecera y suma de líneas y cero diferencias de retenciones.
- Ningún gasto apunta a un documento inexistente.
- Se investigaron 43 enlaces inversos distintos: corresponden a 12 documentos compartidos. Los 12 apuntan a uno de sus gastos vinculados; no se han reasignado documentos para forzar una relación uno a uno.
- Las políticas de lectura de los historiales de chat, tareas y copias se conservan. El agregador no concede acceso a otros canales.

## Qué significa el registro de actividad

Las acciones de negocio que ya se registraban en servidor conservan su traza original. El visor suma historiales existentes, sin reconstruir ficticiamente acciones antiguas que nunca quedaron registradas.
Los eventos del chat que se pueden consultar dependen de los canales administrados por la cuenta; las tareas dependen de su visibilidad. La actividad de copias procede de sus índices históricos, incluidos intentos fallidos y copias retiradas: eso no significa que sus archivos sigan ocupando espacio. La programación real conserva diez copias completas y continúa activa a las 00:35. Cuando el servidor no registró el autor de una copia se indica expresamente, sin atribuirla al administrador actual. Si no existe fecha final, no se inventa.
Los cambios de código, autor, revisión y publicación se consultan en GitHub, no se presentan como si fuesen cambios contables.
El detalle conserva los códigos originales aunque la tabla use nombres más legibles.
La actualización automática consulta las novedades del historial general y de usuarios sin volver a descargar toda la historia. Chat y tareas se releen bajo sus permisos vigentes. Las copias se consultan sin descargar sus manifiestos completos. El botón Actualizar vuelve a leer todo el historial, por ejemplo después de una importación con fechas antiguas.

## Reproducción y protocolo de cambios

Las pruebas nuevas son `audit-register-qa`, `audit-loading-qa`, `audit-register-browser-qa`, `expense-totals-qa`, `expense-credit-browser-qa`, `expense-rounding-browser-qa`, `template-copy-qa`, `template-copy-browser-qa` y `configuration-journeys-browser-qa`, todas en `tests/` e incluidas en el flujo de revisión.
La revisión profunda del editor añade `template-render-qa` y `template-editor-browser-qa`: colores, tres estilos, fuentes, posiciones/tamaño del logo, imagen inválida, cabecera/pie con saltos, campos ocultos, notas internas, cambios sin guardar, factura/proforma, PDF real, guardado y reapertura. Se comprueban 1440, 768, 390 y 320 píxeles y que Guardar/Cancelar no queden recortados.
Ejecutar los recorridos y la batería `.github/workflows/qa.yml`, revisar sus resultados y los trabajos de base de datos desechable antes de publicar. No aceptar solo comprobaciones estáticas o un número de pruebas como prueba de ausencia absoluta de fallos.
Publicar mediante la rama de revisión y el control de calidad de GitHub. Releer el estado actual antes de editar; no sobrescribir cambios ajenos. Conservar los datos, fórmulas fiscales y funciones que no forman parte de la corrección. Si falla una comprobación, resolverla antes de dar el caso por cerrado.

Esta auditoría acredita los recorridos y comprobaciones descritos sobre una versión concreta; no garantiza ausencia absoluta de errores futuros ni sustituye el contraste de la documentación fiscal original.
