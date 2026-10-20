# Comprobación de copias y OneDrive

La carpeta activa es Apps / TotusCentral Staging, creada mediante el permiso de carpeta de aplicación. La antigua TotusCentral manual estaba vacía y se envió a la papelera tras comprobar sus cuatro subcarpetas. No se vació la papelera.

Los documentos se han replicado y se ha completado la réplica de un archivo completo de copia con comprobación de lectura. Los originales siguen en Supabase; replicarlos no libera su espacio.

## Pendientes que impiden dar las copias por terminadas

- La generación completa volvió a superar el límite de CPU del servidor tras reducir compresión. No está estabilizada y no debe anunciarse como comprobada.
- La verificación desde OneDrive y el ensayo de recuperación del archivo completo están pendientes de resultado. El ensayo con los datos actuales sí superó la comprobación en tablas temporales; no equivale a restaurar un entorno independiente.
- La interfaz de almacenamiento tiene un ajuste de la prueba de diseño pendiente de pasar CI.

La tarea nocturna conserva su horario de las 00:35. La réplica se solicita después de una creación correcta, sin añadir una nueva tarea cada dos minutos para copias.

ChatGPT online requiere una conexión autorizada y herramientas compatibles. La autorización de TotusCentral no concede automáticamente acceso a cualquier chat.
