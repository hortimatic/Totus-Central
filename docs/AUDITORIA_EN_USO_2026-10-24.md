# Auditoría de uso · Totus Central · 24/10/2026

Esta revisión se abre por fallos reales comunicados por Diego después de la entrega anterior. La instalación está en uso. Se conservan datos, estructura y funciones; las correcciones se preparan en una rama independiente.

## Criterio de cierre
Cada caso requiere recorrido de usuario, persistencia/reapertura cuando proceda, estado de error, permisos y presentación. Pasar pruebas de cálculo o comparar nombres de botones no demuestra que el recorrido sea utilizable. No se da por cerrado un caso sin evidencia.

## Registro de trabajo
| Caso | Situación encontrada | Trabajo | Estado |
|---|---|---|---|
| P01 | Nuevo producto: elegir Con variantes no muestra editor | Editar variantes desde el alta; guardar producto y variantes juntos; preservar borradores | Corregido en rama; recorrido inicial y reversión probados |
| P02 | Secciones relacionadas ocultas hasta guardar el producto | Alta con coste/proveedor y opciones visibles según tipo | Corregido en rama; coste/proveedor inicial opcional |
| P03 | Tabla original de descuentos ausente | Recuperar simulación con selección de variante y rentabilidad | Recuperado en rama; validación final en curso |
| P04 | Rentabilidad y contexto de marca/familia incompletos | Recuperar umbrales, identificación y metadatos sin perder campos | Recuperado en rama; validación final en curso |
| P05 | Histórico reducido; formatos originales no mostrados completos | Mostrar coste, venta, margen, autor y fecha, incluidos registros antiguos | Recuperado en rama; validación final en curso |
| P06 | Guardar y continuar al siguiente producto ausente | Recuperar opción conservando Guardar y volver/lista | Recuperado en rama; validación final en curso |
| P07 | Selección de proveedor puede desmarcar otros antes de fallar el guardado | Validación y operación atómica, con error sin cambios parciales | SQL aislado: fallo no pierde selección anterior |
| P08 | Historial depende de permiso Crear incluso al editar | Revisar guardas y trazabilidad de un editor sin permiso de alta | SQL aislado: editor guarda historial sin permiso de alta |
| P09 | Convertir consulta usaba estado ACTIVO y guardados separados | Usar estado válido y transacción con proveedor e historial | Detectado en código; prueba añadida |
| R01 | Volver a recepciones utiliza botón secundario diferente del resto | Usar el patrón de navegación de las fichas existentes | Corregido; prueba del enlace añadida |
| R02 | Alta, subida/reintento, documentos, cotejo, biblioteca, filtros, descargas | Recorrer cada transición y sus errores, conservando originales | Pendiente |
| G01 | Gastos, cajas, facturación, fiscalidad e informes en uso | Probar recorridos y consistencia; no introducir asientos ficticios | Pendiente |
| G02 | Administración, permisos, conexiones, copias y recuperación | Verificar con identidad legítima; recuperar solo en pruebas aisladas | Pendiente |
| V01 | Alineación, ventanas, textos, navegación y móvil | Revisar estados vacíos/con datos/errores, no solo pantalla inicial | Pendiente |
| O01 | OneDrive: lectura no demuestra edición ni transferencia binaria | Comprobar acceso, copia/subida, reemplazo y formatos; distinguir transporte y edición interna | Pendiente |
| E01 | Entrega anterior no cubría todos los recorridos | Manuales y evidencia actualizados con los resultados reales y límites | En curso |

## Referencia funcional de Pricing
Se consulta Totus Pricing V5 original conservado en OneDrive, sin reutilizar sus claves o base antigua. Capacidades: consultas y conversión; catálogo marca/familia; productos simples/variantes; atributos genéricos; costes IVA+RE; proveedores y selección; competencia disponible con descuentos/envío; promociones 0–50%; rentabilidad; histórico; notas/unidades estimadas; guardar y continuar.
Las partes ya presentes se conservan. Una mejora visual no sustituye a recuperar una función perdida.

## Evidencia adicional y comprobaciones en curso
- P01/P02: editor inicial de variantes y coste/proveedor inicial preparados; pruebas de pantalla crean, guardan, reabren y preservan borradores ante error.
- P03: escenarios 0–50 % restaurados con selector de variante; no cambia precios por simular.
- P05/P06: detalle de histórico, formato antiguo y guardar/siguiente recuperados; historial captura tipos IVA/RE del momento.
- P07/P08: PostgreSQL aislado confirma reversión de selección de proveedor y escritura de historial de un editor sin permiso de alta.
- P09: comprobado products_status_check de producción: solo PENDIENTE/ACEPTADO. La conversión anterior usaba ACTIVO. Se sustituye por la transacción de alta con estado válido y trazabilidad de conversión.
- Consultas: eliminada limitación visual a veinte resultados; búsqueda y detalle de actividad.
- R01: vuelta con patrón btn link, cubierto por comprobación de interfaz.
- R02: recorrido automatizado conserva subida de ambos documentos, proveedor rápido sin perder archivos, reintento sin duplicado, desvinculación conservando original, rangos inclusivos y exportaciones HTML/XLSX reabiertas.
- Datos en uso: comprobación de solo lectura sin documentos de gastos inexistentes ni originales retirados sin índice verificado. Las referencias distintas en PDF compartidos corresponden a documentos que contienen varias facturas; no se reasignan por una comparación simple de texto. Un documento de cuota común tiene etiqueta de una tienda: no se cambia su imputación por esa etiqueta.
- Navegación real: Inicio, Cajas, Gastos, Facturación, Documentos, Fiscalidad, Informes y Administración cargan con sesión de administración, sin guardar asientos.
- Inicio: etiquetas de almacenamiento aclaran que ese resumen mide Supabase; no se presenta como el total de OneDrive. Campos de consulta rápida tienen nombre accesible.
- O01: transferencia XLSX real y reemplazo de copia técnica comprobados por tamaño, huellas y lectura posterior. Véase ONEDRIVE_FORMATOS_Y_PRUEBAS.md. La ampliación independiente en ChatGPT convencional sigue pendiente de evidencia; enviarle instrucciones no equivale a verificar su ejecución.

Las pruebas anteriores no convierten esta auditoría en garantía de ausencia absoluta de fallos. El cierre exige que termine correctamente la batería de la revisión que se publique, la comprobación visual posterior y una copia completa comprobada. No hay que marcar todos los casos como terminados por heredar una entrega anterior.
