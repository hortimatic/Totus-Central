# Auditoría de uso · Totus Central · 24/10/2026

Esta revisión se abre por fallos reales comunicados por Diego después de la entrega anterior. La instalación está en uso. Se conservan datos, estructura y funciones; las correcciones se preparan en una rama independiente.

## Criterio de cierre
Cada caso requiere recorrido de usuario, persistencia/reapertura cuando proceda, estado de error, permisos y presentación. Pasar pruebas de cálculo o comparar nombres de botones no demuestra que el recorrido sea utilizable. No se da por cerrado un caso sin evidencia.

## Registro de trabajo
| Caso | Situación encontrada | Trabajo | Estado |
|---|---|---|---|
| P01 | Nuevo producto: elegir Con variantes no muestra editor | Editar variantes desde el alta; guardar producto y variantes juntos; preservar borradores | Reproducido en producción sin guardar |
| P02 | Secciones relacionadas ocultas hasta guardar el producto | Alta con coste/proveedor y opciones visibles según tipo | Confirmado en código |
| P03 | Tabla original de descuentos ausente | Recuperar simulación con selección de variante y rentabilidad | Original contrastado |
| P04 | Rentabilidad y contexto de marca/familia incompletos | Recuperar umbrales, identificación y metadatos sin perder campos | Original contrastado |
| P05 | Histórico reducido; formatos originales no mostrados completos | Mostrar coste, venta, margen, autor y fecha, incluidos registros antiguos | Original contrastado |
| P06 | Guardar y continuar al siguiente producto ausente | Recuperar opción conservando Guardar y volver/lista | Original contrastado |
| P07 | Selección de proveedor puede desmarcar otros antes de fallar el guardado | Validación y operación atómica, con error sin cambios parciales | Confirmado en código; pendiente de prueba |
| P08 | Historial depende de permiso Crear incluso al editar | Revisar guardas y trazabilidad de un editor sin permiso de alta | Pendiente de prueba |
| P09 | Convertir consulta usaba estado ACTIVO y guardados separados | Usar estado válido y transacción con proveedor e historial | Detectado en código; prueba añadida |
| R01 | Volver a recepciones utiliza botón secundario diferente del resto | Usar el patrón de navegación de las fichas existentes | Reproducido |
| R02 | Alta, subida/reintento, documentos, cotejo, biblioteca, filtros, descargas | Recorrer cada transición y sus errores, conservando originales | Pendiente |
| G01 | Gastos, cajas, facturación, fiscalidad e informes en uso | Probar recorridos y consistencia; no introducir asientos ficticios | Pendiente |
| G02 | Administración, permisos, conexiones, copias y recuperación | Verificar con identidad legítima; recuperar solo en pruebas aisladas | Pendiente |
| V01 | Alineación, ventanas, textos, navegación y móvil | Revisar estados vacíos/con datos/errores, no solo pantalla inicial | Pendiente |
| O01 | OneDrive: lectura no demuestra edición ni transferencia binaria | Comprobar acceso, copia/subida, reemplazo y formatos; distinguir transporte y edición interna | Pendiente |
| E01 | Entrega anterior no cubría todos los recorridos | Manuales y evidencia actualizados con los resultados reales y límites | En curso |

## Referencia funcional de Pricing
Se consulta Totus Pricing V5 original conservado en OneDrive, sin reutilizar sus claves o base antigua. Capacidades: consultas y conversión; catálogo marca/familia; productos simples/variantes; atributos genéricos; costes IVA+RE; proveedores y selección; competencia disponible con descuentos/envío; promociones 0–50%; rentabilidad; histórico; notas/unidades estimadas; guardar y continuar.
Las partes ya presentes se conservan. Una mejora visual no sustituye a recuperar una función perdida.
