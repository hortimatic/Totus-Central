# Peticiones del titular y cierre de revisión
Actualizado: 20/10/2026. Solo staging. No contiene documentación fiscal ni credenciales privadas.

## Cómo usar este registro
Una petición no se cierra por haber escrito código. Anotar versión, prueba realizada, resultado y limitaciones. Los informes antiguos describen el estado en su fecha; no son el inventario actual. «Pendiente de verificar» no significa que la función esté ausente.

## Estado de los trabajos de nube
| Petición | Estado comprobado | Trabajo pendiente |
|---|---|---|
| OneDrive sin depender de un ordenador | Autorización y lectura real; 452 originales verificados en OneDrive | Recuperación SQL con reversión y conexión de servidor comprobadas; cada operador debe iniciar su propia sesión |
| OneDrive dentro de Almacenamiento | Integración publicada y probada; OneDrive dentro de Almacenamiento | Medición física comprobada después de la limpieza; controlar también transferencia mensual |
| Carpetas ordenadas y claras | Ruta única Apps → TotusCentral Staging; carpeta manual vacía retirada a papelera | Mantener estructura de año/tipo/mes y archivo recuperable de retirados |
| Cinco copias completas, todas las noches a las 00:35 Madrid | Máximo cinco, tarea nocturna y recorrido completo comprobados | Reconstruir toda la infraestructura de otro proyecto es un procedimiento distinto |
| No dejar materiales de trabajo en portátil | Desarrollo y entrega remotos; sin nuevas carpetas ni descargas locales | Mantener código/manual en GitHub y material privado en las nubes autorizadas |
| Informe y manual detallado para ChatGPT online | Manual, relevo, registro e informe publicados; cuatro archivos verificados en OneDrive | Mantenerlos al cambiar la herramienta |

## Peticiones de contabilidad e interfaz: criterios de aceptación
| Petición recuperada del chat | Criterio de aceptación |
|---|---|
| Cajas Hortimatic Vape y Head, NewOldSmok separada | Apertura y efectivo para mañana por cada caja; ventas del día, tarjeta y retiradas visibles sin desplegable |
| Inicio facilita apertura diaria | Mostrar último cierre de cada cajón con su fecha; distinguir dato anterior de apertura efectivamente confirmada |
| Histórico y Excel | Tarjeta histórica corresponde al abono bancario del día siguiente; no mezclar tiendas ni inventar reparto de retiradas |
| Primeros tres trimestres aceptados | Conservar aceptación de gastos y cajas; comprobar estados verdes sin inventar pagos ni modificar cifras |
| Fiscalidad comprensible | Explicar beneficio fiscal, previsión propia, declaración presentada, pagos y reserva con nombres cotidianos; previsión calculada desde operaciones |
| Gastos internos | Mostrar aparte y no descontar del beneficio fiscal; nóminas, Seguridad Social y autónomos con tratamiento correcto, evitando duplicados |
| Modelos fiscales | Revisar acumulados y pagos anteriores del 130, retenciones del 111 y alquiler de Azuqueca en 115; referencias de gestoría solo contraste |
| Facturas de ambas tiendas | Un único emisor autónomo, numeración correlativa, logo por tienda, domicilio fiscal configurado; vista previa en vivo encuadrada |
| Gastos y documentos | Original asociado al gasto correcto; vista previa, sustitución y descarga funcionan sin pérdida silenciosa del original |
| Proveedores | Listado editable accesible desde Gastos y coherente con facturas |
| Informes de gestoría | Una vista previa clara; columnas fieles; exportación mensual; número de factura a la derecha de gastos; filtros cubren todos los meses del rango |
| Buscadores y filtros | Buscar, aplicar, limpiar y exportar muestran el mismo conjunto; validar fechas, tienda, texto y ausencia de resultados |
| Log | Mutaciones registradas con autor/fecha; Aplicar y Limpiar juntos al final, uno encima del otro |
| Documentos | Organización clara; carga, vista previa, descarga y vínculos revisados |
| Toda la interfaz | Sin datos pisados, recortes ni cajas innecesarias; comprobar escritorio/tableta/móvil, formularios y ventanas |

## Almacenamiento
- Separar cuota de base de datos, archivos y consumos mensuales; los contenedores no tienen cada uno un gigabyte exclusivo.
- Mostrar años/meses de duración estimada desde nueve meses de actividad y sus supuestos, no una promesa.
- GitHub contiene código y web; introducir contabilidad no aumenta el repositorio.
- Mostrar uso real y fuente/fecha de cada medición. No presentar un inventario instantáneo como promedio de facturación.
- Informar qué se puede descargar y qué elimina espacio. Descargar no libera espacio.
- No borrar documentos vinculados ni historiales útiles para forzar un año de capacidad.
- OneDrive debe reducir el uso de archivos en Supabase solo tras migración verificada y soporte completo de restauración.
- Mantener plan gratuito, sin contratación automática.

## Criterios de seguridad, código y pruebas
- Revisar funciones y llamadas del servidor, permisos reales de administrador/gerencia/encargado y denegaciones.
- Revisar avisos de seguridad uno por uno; no suprimir controles para quitar advertencias.
- Retirar código obsoleto solo con referencias y pruebas que demuestren que no tiene uso.
- Evitar que la contraseña/credencial nueva aparezca en borradores, logs, navegador persistente o documentación.
- Comprobar exportaciones reales y geometría visual además de pruebas simuladas.
- Mantener el cambio de producción fuera de alcance hasta autorización.
- Registrar diferencias contables explicadas; nunca ajustar importes para aparentar coincidencia.
- No importar octubre: lo introducirá el titular manualmente.

## Lista numerada de seguimiento — 20/10/2026

Cada estado distingue pruebas automáticas, comprobaciones reales y criterios aún abiertos.

1. **Verificado: lectura principal desde OneDrive.** API sujeta a las políticas del usuario, tamaño y SHA-256; pruebas de sesión, rol, archivo sustituido y errores. PDFs reales de ambas tiendas visibles, incluido un original cuyo duplicado ya había desaparecido de Supabase. Las descargas y exportaciones comparten el lector; no se guardaron descargas en este portátil.
2. **Completado: duplicados documentales de Supabase.** 452 de 452 retirados después de comprobar original, destino y copia completa. Cero objetos restantes en business-documents; 547 gastos y 449 cierres conservados. La retirada de fragmentos de copias de seguridad es un trabajo distinto y exige otra comprobación.
3. **Verificado: copias completas y traslado.** En el circuito nuevo, subida directa a OneDrive con relectura de cada fragmento: 454 archivos y 4.873 registros, cero partes nuevas en Supabase.  Copias reales anteriores leídas desde OneDrive y ensayo temporal de 38 tablas/57 relaciones. Nuevo guardado secuencial publica el índice al final; simulación real de 112 MiB creada y leída por separado, con integridad comprobada y 16 objetos temporales retirados. La copia anterior de comprobación contiene 454 archivos y 4.870 registros y se verificó desde OneDrive antes de retirar los fragmentos.
4. **Verificado en aplicación: recuperación con reversión.** Se corrigió la exigencia antigua de originales físicos en Supabase y se conserva el índice de OneDrive al recuperar. El primer ensayo agotó la conexión por una validación repetida; se corrigió con una comprobación por conjuntos. La matriz negativa y el ensayo completo con reversión y límite de ocho segundos pasaron, conservando las 452 ubicaciones y sin datos de prueba. Reconstruir otro proyecto e identidades sigue siendo un procedimiento distinto.
5. **Verificado: horario y máximo de cinco copias.** Horario servidor y copia nocturna reales anteriores comprobados. Conservar guardas de última copia y puntos protegidos. El recorrido completo se comprobó con la copia real nueva; continúa desde la tarea de mantenimiento existente. Cuatro copias modernas verificadas: tres anteriores y la prueba del nuevo circuito directo, sin necesidad de fabricar otras para llenar el máximo.
6. **Implementado y medido: capacidad.** La previsión distingue volumen lógico de originales y ocupación física; las copias en OneDrive no se cuentan como archivos pesados de Supabase. Hay límite de recuperación de 120 MiB/128 MiB expandidos; la prueba de 112 MiB no permite prometer capacidad ilimitada.
7. **QA aprobada: cajas.** Ventas, tarjeta, retiradas, apertura y efectivo final por cajón. Hortimatic Vape/Head y NewOldSmok separadas; no inventar reparto histórico. Conservar comprobación diaria de Inicio y fecha de la última apertura disponible.
8. **QA aprobada: fiscalidad.** Previsión propia, reserva, referencias de gestoría separadas, acumulados del 130 e internos sin deducir. Las diferencias contables se documentan sin alterar importes para coincidir.
9. **Conservado: histórico 1T–3T.** No se cambiaron cifras ni aceptación del titular durante la migración. Octubre lo introduce el titular a mano.
10. **QA aprobada: facturación.** Emisor único, numeración compartida, logos por tienda, vista previa, emisión, rectificativas y adjuntos. Mantener prueba real de la versión utilizada antes de entregar documentos.
11. **QA y lectura real: gastos, proveedores y documentos.** Pruebas de asociación, originales, filtros y protección ante errores; dos originales reales abiertos desde OneDrive. No cruzar libros de tiendas al importar.
12. **QA aprobada: informes.** Columnas y formato de gestoría, libros mensuales, número de factura y rangos de fechas. Contrastar las exportaciones del periodo real antes de enviarlas.
13. **QA visual aprobada.** Batería remota de vistas, geometría, modales, campos y recorridos; no equivale a una revisión humana de cada pantalla con datos reales en cada dispositivo.
14. **Revisión y denegaciones comprobadas: estabilidad y seguridad.** Reservas para limpiezas simultáneas, denegaciones por rol, integridad, errores de transferencia y recuperación simulada comprobados. El bloqueo se corrigió y el ensayo posterior pasó; se comprobaron los asesores y la denegación de las 17 funciones privilegiadas a una identidad sin membresía. Las limitaciones de formato, plan e infraestructura figuran en el informe.
15. **Entregables: manual e informe online.** Manual operativo en GitHub, registro de peticiones y relevo. Sin archivos de trabajo locales. El manual, relevo, registro e informe se sincronizan con lectura de comprobación en OneDrive.

### Evidencia
La batería completa aprobó la revisión b25d6116, incluyendo guardado de 112 MiB, recuperación simulada, filtros, informes, facturación y geometría visual. La revisión 307d48f9 aprobó también la batería completa, incluidas sesiones directas, fallos de transferencia y pruebas visuales. La copia directa real superó después la lectura íntegra y el ensayo temporal de 38 tablas y 57 relaciones. Consultar GitHub Actions para la publicación posterior; no asumir éxito porque exista código.

## Petición posterior: organización y diez copias
- Conservar toda la información y agrupar Almacenamiento por Supabase, OneDrive y GitHub.
- Mostrar las cifras principales y ordenar conexión, limpieza y diagnóstico en secciones desplegables.
- Mantener abiertas esas secciones cuando se actualizan las cifras.
- Permitir elegir y guardar de 1 a 10 copias; usar ese mismo valor en ambas conservaciones del servidor y en la pantalla.
- Probar guardado de diez y otros valores, rechazo de valores inválidos, protección de recuperaciones y ausencia de cambios contables.


## Corrección solicitada: presentación compacta, pendiente de aceptación visual
Rehacer la pantalla con filas por servicio y cifras alineadas. Conservar toda la información y funciones en apartados de detalle. Separar claramente el límite de formato de copia de la capacidad de almacenamiento. Mostrar el resumen de copias sin repetir tarjetas ni párrafos principales. La aprobación de pruebas no implica aceptación del diseño por el titular.
