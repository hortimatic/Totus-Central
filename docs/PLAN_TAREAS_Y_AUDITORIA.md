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
Implementación y pruebas terminadas. Los cuatro bloques de la revisión 40224188950 han finalizado correctamente: 121 programas de comprobación y 30 ejecuciones SQL de instalación/prueba, con PostgreSQL desechable para permisos y restauración. La publicación repite la batería antes de servir la nueva versión.
Prueba real desde ChatGPT convencional, con escritura revertida y comprobación posterior sin residuos: https://github.com/hortimatic/Totus-Central/pull/22#issuecomment-6401830749.
Informe de revisión: docs/auditorias/TAREAS_CHAT_Y_REVISION_2026-10-25.md.
La verificación final del despliegue y la copia ampliada se registra en el cierre del PR #22.
