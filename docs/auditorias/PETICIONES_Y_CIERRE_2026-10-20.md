# Peticiones del titular y cierre de revisión
Actualizado: 20/10/2026. Solo staging. No contiene documentación fiscal ni credenciales privadas.

## Cómo usar este registro
Una petición no se cierra por haber escrito código. Anotar versión, prueba realizada, resultado y limitaciones. Los informes antiguos describen el estado en su fecha; no son el inventario actual. «Pendiente de verificar» no significa que la función esté ausente.

## Prioridad inmediata
| Petición | Estado comprobado | Trabajo pendiente |
|---|---|---|
| OneDrive sin depender de un ordenador | Autorización real completada; servidor ha escrito y vuelto a leer archivo sintético el 20/10/2026 | Copia documental por lotes en servidor activada, con verificación de cada archivo y reserva temporal. Pendiente completar inventario, lectura principal desde OneDrive, copias y recuperación; comprobar renovación de sesión |
| OneDrive dentro de Almacenamiento | Código y QA de integración aprobados en be717a8c | Publicación falló instalando dependencias por HTTP 403 externo; reintentada. Verificar web publicada |
| Carpetas ordenadas y claras | Carpetas privadas iniciales creadas | Unificar carpeta manual y carpeta autorizada de aplicación sin ampliar permisos; organizar año/tipo |
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

Ningún punto se considera terminado sin prueba asociada. No borrar originales para aparentar una migración.

1. **Pendiente: lectura principal de documentos desde OneDrive.** Vistas previas, descarga individual y conjunta, documentos asociados a gastos, informes y copias deben usar el proveedor correcto con los mismos permisos.
2. **Pendiente: limpieza de duplicados en Supabase.** Solo después del punto 1, comprobar tamaño y SHA-256 del destino, registrar ubicación, ensayar acceso y recuperación; retirar únicamente objetos verificados. Conservar base de datos, cuentas, permisos, enlaces, secretos y registros necesarios.
3. **Pendiente: copias nuevas estables.** La copia existente de OneDrive se ha leído y sus 38 tablas se han ensayado en tablas temporales con 57 relaciones. Generar una copia nueva todavía ha mostrado límites de CPU y HTTP 429. No anunciar estabilidad hasta resolverlos y repetir prueba real completa.
4. **Pendiente de cierre: recuperación independiente y renovación de conexión.** El ensayo temporal no reemplaza un restablecimiento completo aislado. Comprobar renovación automática sin dispositivo abierto.
5. **Pendiente de cierre: cinco copias y horario 00:35 Madrid.** Mantener rotación solo después de éxito y verificación. No añadir tareas periódicas duplicadas. Dejar botón de eliminación y estados comprensibles.
6. **Pendiente de nueva comprobación: capacidad.** Uso real Supabase/OneDrive, fuente y fecha, previsión en meses/años desde nueve meses; medir de nuevo tras migración. No prometer un año sin prueba.
7. **Pendiente de nueva comprobación: cajas.** Mostrar ventas, tarjeta, retiradas, apertura y cierre por cada cajón; Hortimatic tiene Vape y Head. Inicio debe mostrar efectivo para la próxima apertura con fecha.
8. **Pendiente de nueva comprobación: fiscalidad.** Nombres comprensibles, cálculo propio de reserva y modelos, acumulados 130, referencias gestoría separadas, internos sin deducir, nóminas/SS/autónomo sin duplicar.
9. **Pendiente de nueva comprobación: histórico 1T–3T.** Conservar cifras y aceptación del titular sin inventar reparto de retiradas ni ajustes. Octubre se introduce a mano por el titular.
10. **Pendiente de nueva comprobación: facturación.** Emisor único y numeración compartida, logos por tienda y vista previa encuadrada; emisión, rectificativas, adjuntos y descarga.
11. **Pendiente de nueva comprobación: gastos/proveedores/documentos.** Asociación inequívoca de factura, originales íntegros, filtros y búsquedas coherentes, altas/edición/borrado protegido.
12. **Pendiente de nueva comprobación: informes.** Vista previa única clara, columnas fieles a gestoría, exportaciones mensuales, número de factura junto a gastos, todo el rango de fechas incluido.
13. **Pendiente de nueva comprobación: interfaz completa.** Escritorio/tableta/móvil, modales, campos, textos sencillos, sin solapes ni datos importantes ocultos.
14. **Pendiente de cierre: seguridad y longevidad.** Permisos reales por rol, denegaciones, concurrencia, errores sin pérdida, integridad de adjuntos, auditoría, dependencias fijadas, código obsoleto demostrado antes de eliminar.
15. **Pendiente de cierre: informe/manual online.** Explicar trabajo diario, cierres, gastos, facturas, exportación, fiscalidad, copias, recuperación y conexión autorizada de ChatGPT. Código/manual en GitHub; documentación privada solo en servicios privados autorizados; sin materiales locales.

### Evidencia disponible
La última batería remota comprobó los recorridos simulados de altas, edición, adjuntos, facturación, roles, fiscalidad y descargas. La prueba visual de almacenamiento requiere abrir los detalles técnicos antes de medir sus controles. Es evidencia simulada; no sustituye la verificación real de servicios y datos.
