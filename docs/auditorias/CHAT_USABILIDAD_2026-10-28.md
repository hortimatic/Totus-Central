# Chat · revisión de recorridos y organización · 28/10/2026

La conexión automática con ChatGPT queda aplazada por petición del usuario. Esta revisión no crea tareas programadas ni API ni cambia sus credenciales.

## Cambios y fallos corregidos
1. Herramientas de creación agrupadas en un bloque; bandeja de avisos separada de crear y organizar.
2. Filtros de conversaciones: todas, sin leer, favoritas y mensajes directos. No alteran miembros ni permisos.
3. Búsqueda de canales y secciones tolerante a acentos y mayúsculas. Mensaje claro cuando no hay coincidencias.
4. Recuento de conversaciones por sección, sin recortar los nombres ni alterar la lectura accesible del botón.
5. Formulario de canal dividido en identificación, organización y acceso; incluye tienda y explicaciones del acceso privado.
6. Corregido el guardado de la tienda al editar el canal. Un cliente antiguo que omite el campo o envía su valor vacío conserva la tienda; el cambio requiere intención explícita del formulario nuevo. Una referencia inexistente es rechazada por la base.
7. Protección del borrador al cerrar una ventana con cambios, mediante Cancelar, X o Escape.
8. Una sección personal vacía se puede eliminar sin borrar canales. Se impiden duplicados de nombre, incluso con distinta capitalización o acentos.
9. Cambiar filtros laterales y crear un canal no lo deja oculto por el filtro anterior.
10. Los filtros de mensajes escritos pero todavía no aplicados se conservan al llegar una actualización.
11. Al leer más de cincuenta mensajes se sigue comprobando si llegan nuevos; aparece un acceso al final sin saltar ni descartar el historial visible.
12. Los avisos incluyen autor y fecha. Un mensaje principal visible se abre en el canal y queda señalado; no se fuerza un hilo innecesario.
13. Los cuadros informativos tienen una sola acción de cierre al pie.
14. Acciones de retirada/eliminación alineadas con el permiso real; la configuración sigue funcionando para quien puede editar pero no eliminar.
15. Se conservan adjuntos originales, reintentos, mensajes directos, menciones, reacciones, fijados, tareas, edición, moderación, archivado y orden personal por arrastre.

## Verificación
- Batería previa íntegra de Chat: canales, mensajes, hilos, miembros, permisos, archivos, lectura, búsqueda, reacciones, tareas y recuperación.
- Recorridos adicionales de usabilidad: filtros laterales y acentos; filtro sin aplicar ante actualización; historial con mensaje entrante; selección y edición de tienda; permisos sin eliminación; cancelación protegida; secciones vacías y duplicadas; avisos; seis tamaños del formulario.
- Nueve anchuras del módulo: 320, 390, 700, 768, 900, 1024, 1280, 1440 y 1920 píxeles. Formularios abiertos entre 320 y 1920.
- PostgreSQL desechable: tienda al crear y editar, omisión compatible con clientes antiguos, referencia inválida y canal general.
- No se ejecutan escrituras ficticias sobre mensajes o contabilidad en producción. El único cambio de servidor afecta al guardado de la tienda del canal, sin añadir tablas ni columnas.
- La revisión de aceptación corresponde a estos recorridos y la versión publicada. No implica ausencia universal de errores.

## Pendiente futuro, fuera de esta revisión
Valorar un aviso limitado a ChatGPT solo después de definir un contador de costes, límite efectivo de gasto y mecanismo comprobado de activación. No activar recurrencias ni consumo adicional por interpretar este recordatorio como autorización.
