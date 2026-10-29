# Limpiar el historial del Log

Solo Administración puede usar **Administración → Log → Limpiar historial**.

1. Para borrar por antigüedad, deja **Desde** vacío e indica **Hasta (incluido)**.
2. Para un intervalo concreto, completa ambas fechas. Se interpretan como días completos de Madrid, incluidos los cambios de horario.
3. Pulsa **Calcular registros**. El recuento distingue actividad general, usuarios, chat y tareas.
4. Pulsa **Eliminar registros** y confirma el número y el rango. Cambiar fechas invalida el recuento. Si aparecen eventos nuevos dentro del rango, vuelve a calcular.

El borrado es definitivo desde el Log. No altera gastos, cajas, mensajes, tareas, documentos, archivos, copias ni versiones de recepciones. El historial de copias y recepciones sigue apareciendo porque pertenece a esos módulos. Se conserva una constancia de cada limpieza y no se elimina mediante esta opción. Las otras sesiones actualizan su caché al detectar esa constancia.

La base puede reutilizar el espacio de las filas eliminadas; su tamaño total no tiene por qué bajar inmediatamente. No se ejecuta una compactación que bloquee la herramienta. Para evitar operaciones largas, cada rango admite hasta 50.000 eventos.

No se ha programado un borrado automático ni eliminado historial real al instalar la función.
