# Revisión transversal y limpieza — 29/10/2026

Base revisada: `5b8e7dbf02c055a6c9392f032b9cc73f7d06e7ed`.

## Alcance y evidencia

- Código: inventario del repositorio, contratos y pruebas de lógica; revisión del cambio de carga diferida de Excel/ZIP y del circuito de lectura del Log.
- Producción: navegación de los doce módulos y de las siete secciones de Administración con sesión legítima. Sin crear, editar ni borrar registros contables.
- Simulación local: 79 pruebas de lógica/contratos; 13 recorridos transversales de Pricing, Cajas, Gastos, Facturación, Recepciones, Tareas, Chat, configuración, plantillas, recuperación, móvil, subpestañas y presentación informativa.
- Cinco recorridos específicos de carga diferida: Log, almacenamiento, primera descarga Excel/ZIP, vistas previas/importación/paquete de gestoría y errores/reintentos/concurrencia/cambio de sesión.
- GitHub: verificados los siete trabajos de la publicación de la base, todos terminados correctamente. Ramas de los PR 58–63 retiradas después de comprobar su integración; se conserva el historial de esos PR y sus commits.
- Supabase y OneDrive: comprobaciones de integridad de vínculos, protección de tablas, estados de las transferencias, programación y número de respaldos. Los resultados operativos privados se conservan fuera de este repositorio público.

## Correcciones

1. El primer acceso a Log mostraba «0 eventos», «Sin eventos» y una página vacía mientras la consulta seguía pendiente. Se muestran ahora «Cargando historial» y ausencia de recuento confirmado. Un error inicial tampoco se presenta como historial vacío. Las lecturas terminadas conservan filtros, paginación y CSV completo; una actualización fallida conserva la lectura anterior.
2. La comprobación del ensamblado publicado no aceptaba los finales de línea de Windows y dependía de la codificación local de Python. La prueba normaliza CRLF, permite seleccionar Python con `PYTHON` y activa UTF-8. No cambia el proceso de publicación ni el código de negocio.

## Limpieza y criterios de conservación

- No eliminar migraciones, parches históricos ni registros de auditoría por su antigüedad: forman parte del mantenimiento y de la trazabilidad.
- No eliminar índices solo porque el asesor no haya observado uso: una muestra reciente no demuestra que sean innecesarios.
- No eliminar los índices pequeños de las copias alojadas en OneDrive; la aplicación los necesita para identificarlas y recuperarlas.
- Las carpetas de documentos y chat mantienen sus identificadores y organización, para no romper referencias.
- Retirados de OneDrive únicamente ensayos ficticios sin referencias documentales ni del chat, usando papelera recuperable.
- Conservar diez respaldos completados y su rotación; no purgar el historial de intentos fallidos como si fueran archivos de copia.

## Límites de la evidencia

Los recorridos de escritura se prueban con datos ficticios en simulación; no se ha restaurado una copia encima de la contabilidad real ni alterado permisos para conseguir un resultado favorable. La navegación en producción no sustituye esas pruebas ni acredita todas las combinaciones futuras de datos. Esta revisión no certifica ausencia absoluta de defectos, exactitud fiscal de cada factura ni disponibilidad permanente de proveedores externos.

La identidad propia y el acceso manual de ChatGPT/Codex no constituyen un servicio que se active automáticamente con el ordenador apagado. No presentar ese automatismo como instalado.
