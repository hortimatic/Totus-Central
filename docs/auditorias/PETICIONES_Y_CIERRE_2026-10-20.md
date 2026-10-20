# Peticiones del titular y cierre de revisión
Actualizado: 20/10/2026. Solo staging. No contiene documentación fiscal ni credenciales privadas.

## Cómo usar este registro
Una petición no se cierra por haber escrito código. Anotar versión, prueba realizada, resultado y limitaciones. Los informes antiguos describen el estado en su fecha; no son el inventario actual. «Pendiente de verificar» no significa que la función esté ausente.

## Prioridad inmediata
| Petición | Estado comprobado | Trabajo pendiente |
|---|---|---|
| OneDrive sin depender de un ordenador | Autorización y lectura real; 452 originales verificados en OneDrive | Cerrar recuperación integral y comprobar renovación de sesión |
| OneDrive dentro de Almacenamiento | Integración publicada y probada; OneDrive dentro de Almacenamiento | Revalidar las cifras tras terminar la limpieza de copias |
| Carpetas ordenadas y claras | Ruta única Apps → TotusCentral Staging; carpeta manual vacía retirada a papelera | Mantener estructura de año/tipo/mes y archivo recuperable de retirados |
| Cinco copias completas, todas las noches a las 00:35 Madrid | Conservación cinco y tarea servidor existentes; creación nocturna verificada | Ensayar recuperación integral aislada, verificar todos los datos/archivos y migración de destino antes de retirar originales |
| No dejar materiales de trabajo en portátil | Copias de trabajo previas retiradas; desarrollo actual remoto | Mantener código/manual en GitHub; datos y secretos privados en servicios autorizados |
| Informe y manual detallado para ChatGPT online | Existe RELEVO_CHATGPT_ONLINE.md | Completar manual operativo paso a paso, recuperación, errores, permisos y evidencias finales |

## Contabilidad e interfaz: volver a comprobar con datos reales
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

## Seguridad, código y pruebas pendientes de cierre
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
3. **Verificado parcialmente: copias completas.** Copias reales anteriores leídas desde OneDrive y ensayo temporal de 38 tablas/57 relaciones. Nuevo guardado secuencial publica el índice al final; simulación real de 112 MiB creada y leída por separado, con integridad comprobada y 16 objetos temporales retirados. Pendiente cerrar una copia nueva de los datos reales después de la migración.
4. **Abierto crítico: recuperación integral.** Se corrigió la exigencia antigua de originales físicos en Supabase y se conserva el índice de OneDrive al recuperar. El ensayo SQL con reversión agotó el tiempo de conexión; requiere investigación y comprobación posterior del estado. No es prueba aprobada ni certificación de producción.
5. **Verificado parcialmente: cinco copias y 00:35 Madrid.** Horario servidor y copia nocturna reales anteriores comprobados. Conservar guardas de última copia y puntos protegidos. El recorrido nuevo de traslado y retirada de fragmentos debe probarse completo, sin añadir otra tarea periódica.
6. **En comprobación: capacidad.** La previsión distingue volumen lógico de originales y ocupación física; las copias en OneDrive no se cuentan como archivos pesados de Supabase. Hay límite de recuperación de 120 MiB/128 MiB expandidos; la prueba de 112 MiB no permite prometer capacidad ilimitada.
7. **QA aprobada: cajas.** Ventas, tarjeta, retiradas, apertura y efectivo final por cajón. Hortimatic Vape/Head y NewOldSmok separadas; no inventar reparto histórico. Conservar comprobación diaria de Inicio y fecha de la última apertura disponible.
8. **QA aprobada: fiscalidad.** Previsión propia, reserva, referencias de gestoría separadas, acumulados del 130 e internos sin deducir. Las diferencias contables se documentan sin alterar importes para coincidir.
9. **Conservado: histórico 1T–3T.** No se cambiaron cifras ni aceptación del titular durante la migración. Octubre lo introduce el titular a mano.
10. **QA aprobada: facturación.** Emisor único, numeración compartida, logos por tienda, vista previa, emisión, rectificativas y adjuntos. Mantener prueba real de la versión utilizada antes de entregar documentos.
11. **QA y lectura real: gastos, proveedores y documentos.** Pruebas de asociación, originales, filtros y protección ante errores; dos originales reales abiertos desde OneDrive. No cruzar libros de tiendas al importar.
12. **QA aprobada: informes.** Columnas y formato de gestoría, libros mensuales, número de factura y rangos de fechas. Contrastar las exportaciones del periodo real antes de enviarlas.
13. **QA visual aprobada.** Batería remota de vistas, geometría, modales, campos y recorridos; no equivale a una revisión humana de cada pantalla con datos reales en cada dispositivo.
14. **Abierto: cierre de estabilidad y seguridad.** Reservas para limpiezas simultáneas, denegaciones por rol, integridad, errores de transferencia y recuperación simulada comprobados. Investigar el bloqueo del ensayo SQL y verificar permisos/asesores después de las migraciones antes de declarar producción.
15. **En actualización: manual e informe online.** Manual operativo en GitHub, registro de peticiones y relevo. Sin archivos de trabajo locales. Publicar documentación final verificada en OneDrive al cerrar los puntos críticos.

### Evidencia
La batería completa aprobó las revisiones hasta b285ba95, incluyendo guardado de 112 MiB, recuperación simulada, filtros, informes, facturación y geometría visual. Las ejecuciones de publicación posteriores y las comprobaciones reales se anotarán con su resultado; no asumir éxito porque exista código.
