# Tareas, chat y auditoría — 25/10/2026
## Alcance autorizado
1. Calendario mensual/semanal y lista; días amplios, filtros tienda/persona/estado, hoy, navegación.
2. Alta/edición de tareas, prioridad, responsable, tienda, descripción y lista de comprobación.
3. Repetición diaria/semanal/mensual con intervalo, fin opcional; estado por ocasión independiente. Edición de una ocasión o futuras sin modificar pasadas.
4. Conexión con mensajes existentes y enlace a conversación; respetar acceso a canales privados.
5. Seguridad servidor, conflictos concurrentes, historial y copias completas compatibles con las anteriores.
6. Revisar organizador del chat, filtros, historial, desplazamiento, permisos y adjuntos.
7. Batería general: caja, gastos, fiscalidad, facturación, informes, Pricing, recepciones, documentos, usuarios, nube y recuperación.
8. Manuales y cierre con evidencia y límites reales.
## Protección de producción
Cambios preparados en feature/tareas-calendario; no cambiar contabilidad ni importar datos ficticios en módulos contables. Probar base de datos desechable en CI antes de aplicar migración. No restaurar una copia sobre datos reales para probar. Sin relojes ni control horario.
## Estado
En implementación. Este documento es un registro del alcance, no una certificación de pruebas terminadas.
