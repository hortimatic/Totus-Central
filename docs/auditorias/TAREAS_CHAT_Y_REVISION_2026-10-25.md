# Tareas, chat y revisión general — 25/10/2026

## Resultado de la revisión previa a publicación
Los cuatro bloques de [QA 40224188950](https://github.com/hortimatic/Totus-Central/actions/runs/40224188950) han terminado correctamente. Incluyen 121 programas de comprobación y 30 invocaciones SQL para instalar esquemas, comprobar permisos y probar recuperación en PostgreSQL desechable.

## Tareas
Calendario mensual/semanal, lista, filtros por tienda/persona/estado/texto, resumen del día en Inicio, prioridad, responsable y pasos de comprobación. Fechas civiles de Madrid; repetición diaria/semanal/mensual por intervalo y fin opcional. Último día de mes y años bisiestos comprobados.
Cada ocasión conserva su estado. Las ediciones futuras separan la serie y mantienen la titularidad; no sobrescriben ocasiones ya guardadas. Las tareas archivadas se recuperan. Las definiciones sustituidas no se reactivan para evitar duplicar series.
Permisos comprobados en servidor: usuario activo, creador/responsable/Gerencia, pertenencia al canal privado de origen, anónimo denegado, imposibilidad de que una cuenta web elija una identidad delegada. Control de versiones y reintentos idempotentes.
Auditoría con actor, fecha, origen y campos modificados antes/después, evitando repetir descripciones largas en cada cambio de estado.
El navegador se ha probado para alta, finalización, checklist, edición por alcance, protección de notas, archivo, filtros, semana/lista y geometría de escritorio/móvil.

## Chat
Corregida la ubicación de canales existentes en secciones personales, incluido devolver el último canal a una sección que queda vacía. No se cambian grupos compartidos ni permisos. Corregido un repintado innecesario del historial y la búsqueda sin tildes. Se mantienen hilos, mensajes fijados, menciones, tareas, avisos, ficheros, borradores y lectura anterior.
La batería existente verifica esos recorridos, reintentos, aislamiento contable y nueve anchuras de pantalla.

## ChatGPT convencional
[Prueba real documentada](https://github.com/hortimatic/Totus-Central/pull/22#issuecomment-6401830749): alta, reintento sin duplicado, consulta, primer día completado y segundo pendiente, historial delegado y ROLLBACK; consulta independiente posterior con cero tareas/eventos ficticios.
No se modifican JWT ni se habilita una API de IA de pago. Las operaciones se inician desde la cuenta de ChatGPT con las conexiones autorizadas y el alcance indicado directamente por el usuario. No hay un bot permanente añadido por este módulo.

## Resto de la herramienta
Se ha ejecutado la batería de Inicio, Pricing/variantes, cajas, gastos, colores de Excel, fiscalidad, facturación, documentos, informes, recepciones, usuarios/roles, OneDrive, integridad de archivos, copias, formularios, navegación y geometría.
Además, se han recorrido las pantallas reales de los módulos principales sin incidencias de carga ni desbordamientos en el escritorio comprobado. Las comprobaciones reales no han modificado los 486 cierres, 584 gastos y 483 documentos existentes. Las pruebas contables de escritura utilizan los datos simulados de CI.
Los avisos de seguridad anteriores permanecen sin cambios; no se han añadido hallazgos de Tareas en el asesor de seguridad.

## Copias y nube
Nueva recuperación de 52 tablas (49 previas más definiciones, ocasiones e historial de tareas), con compatibilidad exacta para las copias previas de 38/42/49 tablas. Se ha probado la restauración real únicamente en bases desechables, sin restaurar sobre contabilidad viva.
La ampliación se activa al publicar el cliente compatible. Los tres servicios de nube que incluyen el lector de copias conservan sus archivos y autorizaciones anteriores; solo se actualiza ese lector compartido.
Se conservan la programación de 00:35 Madrid y diez copias. La última copia anterior a esta ampliación, del 25/10 a las 00:35, está guardada en OneDrive con 486 archivos; se han confirmado 483 originales documentales verificados. El resultado de la nueva copia ampliada y la publicación está en el cierre del [PR #22](https://github.com/hortimatic/Totus-Central/pull/22).

## Alcance práctico
Las verificaciones descritas acreditan los recorridos probados; no constituyen una promesa de ausencia de cualquier fallo futuro. No se han cambiado cálculos fiscales, importes ni clasificaciones contables para esta ampliación.
Los documentos y adjuntos siguen en OneDrive; el código y manuales en GitHub; datos, permisos y programación en Supabase. No se ha creado una copia de trabajo local del proyecto.
