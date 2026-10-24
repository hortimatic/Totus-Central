# Equipo: conversaciones de Totus Central

## Organización
Canales por tienda o tema, abiertos o privados. Los canales abiertos permiten incorporarse; los privados requieren invitación. Los mensajes directos son entre dos personas y no permiten añadir terceros. El administrador puede gestionar canales según los permisos del módulo; pertenecer a administración no abre automáticamente conversaciones privadas ajenas.

Se pueden buscar mensajes por texto y fechas, abrir respuestas en hilo, mencionar miembros, fijar mensajes y marcar tareas. Los canales archivados conservan el historial sin permitir nuevas escrituras. Retirar un canal no elimina físicamente sus originales ni el historial necesario para una copia completa.

## Documentos
Adjuntar con el selector, arrastrar archivos o pegar imágenes. Máximo diez archivos por mensaje y veinte MiB por archivo. Se admiten PDF, imágenes y formatos de oficina y texto indicados por el selector. Las subidas se guardan en OneDrive dentro de «04 Chat», organizadas por grupo y canal. Supabase conserva miembros, mensajes, permisos y referencias; el navegador mantiene temporalmente el borrador y los bytes seleccionados mientras se completa la subida.

El archivo solo aparece listo después de comprobar tamaño, tipo y huella SHA-256. Si se interrumpe, reintentar desde el mismo mensaje. El proceso de mantenimiento puede reconciliar subidas terminadas cuya confirmación se perdió. Retirar un adjunto impide usarlo en la conversación, pero su original se conserva para recuperación. No mover ni borrar originales manualmente en OneDrive.

## Avisos
Configurar todos los mensajes, solo menciones o ninguno por conversación; también favoritos y orden. Los avisos de escritorio requieren permiso del navegador y la web abierta. No son notificaciones push con todos los navegadores cerrados. La aplicación usa actualización en directo y consulta periódica de respaldo.

## Asistente de Totus
Es una bandeja de solicitudes para vuestro ChatGPT convencional. No es un usuario con contraseña ni un motor automático. Los estados indican pendiente, en curso, respondida o cancelada. Pedid a ChatGPT que consulte las solicitudes siguiendo docs/CHATGPT_CHAT_INTERNO.md. Puede responder y proponer; no se convierten automáticamente mensajes o adjuntos en apuntes contables.

## Copias y recuperación
El formato completo incorpora las siete tablas de conversaciones y sus originales privados, incluidos adjuntos retirados del canal. Las copias anteriores de 38 y 42 tablas siguen siendo compatibles, con las validaciones de inventario correspondientes. Restaurar una copia antigua no puede recuperar conversaciones que todavía no existían en aquella fecha. Las copias completas administradas contienen conversaciones privadas: limitar su descarga a responsables autorizados.

## Pruebas y publicación
El desarrollo se realiza en feature/equipo-chat y PR #18. Las comprobaciones automáticas abarcan permisos reales en PostgreSQL, mensajería, adjuntos, reintentos, bandeja del asistente y compatibilidad de recuperación. Este documento describe el módulo candidato; su presencia en GitHub no acredita que ya esté publicado o desplegado.
