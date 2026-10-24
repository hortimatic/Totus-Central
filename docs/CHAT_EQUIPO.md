# Chat del equipo — implementación en revisión

## Estado y límites de esta entrega

Esta rama contiene el núcleo de canales y conversaciones. **No está publicado ni instalado en la base de datos de producción.** No importa ni modifica Google Chat. No envía nada a OpenAI ni usa una API de IA.

### Incluido en el código candidato

- Menú Chat del equipo, con la estética existente y CSS limitado a este módulo.
- Canales agrupados libremente (Equipo, Hortimatic, NewOldSmok, Totuscode y otros).
- Canales abiertos con incorporación voluntaria y privados por invitación.
- Responsables y miembros, siempre vinculados al equipo activo de Totus.
- Crear, renombrar, archivar, reactivar y retirar canales.
- Mensajes de texto, edición y eliminación propios; control de edición simultánea.
- Respuestas en conversaciones, reacciones y mensajes fijados por responsables.
- Búsqueda en el historial por texto, fechas de Madrid, fijados y tareas.
- Paginación de 50 mensajes y envío con identificador estable para reintentar sin duplicar.
- Borradores durante la sesión; aviso antes de abandonar o cerrar con mensajes pendientes.
- No leídos, marcado manual como leído y silencio de canales en el contador global del chat.
- Tareas con estado y resultado obligatorio al terminarlas.
- Instrucción copiable para trabajar desde ChatGPT convencional.
- Registro servidor de operaciones; permisos de canal comprobados en el servidor.
- Actualización cada 15 segundos, solo con el módulo visible. Sin conexión persistente ni dependencia de un equipo encendido.

### Condiciones obligatorias antes de publicar

1. Incorporar las cinco tablas al contrato de copia, exportación y restauración. Ensayar la recuperación completa en tablas temporales, compatibilidad de las diez copias anteriores y archivos vinculados. No instalar tablas nuevas sin resolver antes este punto.
2. Completar subida privada de adjuntos a OneDrive con comprobación de bytes/huella, acceso por canal, reintentos, bajas autorizadas y recuperación. No reutilizar una URL pública ni conceder acceso a documentos privados de otros módulos.
3. Preparar listado de tareas/contexto y devolución de resultados desde ChatGPT con identidad autorizada y herramientas acotadas. No suplantar a un administrador pasando su correo como identidad. El botón actual prepara una instrucción; no acredita todavía que ChatGPT pueda leer estas tablas o responder en ellas con los permisos normales.
4. Probar con dos usuarios reales separados en un entorno aislado y comprobar acceso denegado tras retirar un miembro o desactivar una cuenta.
5. Añadir preferencias y entrega de avisos. El ajuste de silencio ya se guarda por miembro y excluye ese canal del contador global del chat; esta entrega no envía notificaciones de sistema, correos ni avisos con la web cerrada.
6. Completar adjuntos, menciones con avisos y mensajes directos con su propio control de participantes; no confundir canales privados con una bandeja de conversaciones personales ya terminada.
7. Revisar capacidad/volumen, retención y exportación del historial; los mensajes no se borran por antigüedad.
8. Revisar diseño con datos ficticios en ordenador y móvil, ejecutar batería de la herramienta y revisar errores de consola.
9. Generar la migración desde el entorno de desarrollo validado; `supabase/chat.sql` es un instalador candidato para pruebas aisladas, no una migración aplicada.

No hay controles de adjuntar o contabilizar que aparenten funcionar sin esas comprobaciones.

## Organización observada en Google Chat

Se consultó la interfaz, sin enviar mensajes ni alterar canales, el 24/10/2026:

- Hortimatic: Cierre de cajas H, Pedidos clientes H, Pedidos proveedor H, Productos hortimatic.
- Newoldsmok: Cierre de cajas N, Pedidos cliente N, Productos newoldsmok, Pedidos Proveedor N.
- Totuscode: leads, facturación y Enlaces comerciales.
- Otras agrupaciones: Redes sociales, Trabajo diario, Aplicaciones y Sectores.
- Existen mensajes directos y conversaciones por respuesta.
- Los cierres de Hortimatic distinguen saldo Vape, saldo Head, tarjeta, salidas y notas de incidencias. En mensajes recientes también se indican ventas por caja.

Esto orienta los nombres iniciales, pero no autoriza importar conversaciones, teléfonos, documentos o datos contables del historial. No se han copiado mensajes privados a este repositorio.

## Uso propuesto

1. Crear un canal y elegir grupo y acceso. El creador queda como responsable.
2. Miembros permite invitar a usuarios activos; no crea cuentas nuevas ni cambia sus permisos contables.
3. En un canal abierto otros usuarios activos pueden unirse. En uno privado necesitan invitación.
4. Escribir y pulsar Enviar, o Ctrl+Enter. Enter crea una línea.
5. Responder abre una conversación; volver conserva el borrador.
6. Buscar consulta todo el historial del canal, no solo la página cargada. Las fechas se interpretan en Europe/Madrid.
7. Fijar destaca mensajes importantes. Crear tarea no crea un gasto ni un cierre.
8. Una tarea terminada exige resultado. Ese resultado debe incluir referencias verificables si se efectuó una operación.
9. Preparar para ChatGPT muestra una instrucción para copiar. No presenta un bot automático ficticio.
10. Archivar mantiene consulta y bloquea escritura. Eliminar retira el canal de la interfaz, conserva su historial y no borra información contable.

La conexión existente de ChatGPT con GitHub, Supabase y OneDrive sigue siendo independiente del chat humano. Ninguna suscripción se modifica.

## Seguridad del candidato

Cinco tablas con RLS: canales, miembros, mensajes, reacciones y eventos. El cliente tiene SELECT limitado; no INSERT/UPDATE/DELETE directo. Las escrituras pasan por RPC pública de invocador y una función privada que verifica auth.uid(), usuario real y miembro activo del equipo. Las políticas no confían en metadatos editables por el usuario. El miembro expulsado pierde acceso inmediatamente; no depende de renovar una caché de roles.

Un responsable solo gestiona canales de los que es responsable. Ser administrador contable no da acceso implícito a todas las conversaciones privadas. No puede retirarse el último responsable. Cada envío usa un UUID de cliente, ligado al autor; un reintento con otro contenido se rechaza.

No se guardan credenciales, archivos ni borradores en localStorage. Los borradores en memoria se pierden al recargar o cerrar sesión; por ello se avisa antes de salir. No se promete sincronización de borradores entre equipos.

## Pruebas de esta rama

- `tests/team-chat-qa.mjs`: reglas puras, validación, fechas, agrupación e instrucciones.
- `tests/chat-db-fixture.sql` y `tests/chat-db-qa.sql`: PostgreSQL aislado, identidades separadas, RLS, denegaciones, reintentos, hilos, búsqueda, tareas, archivo y suspensión.
- `tests/team-chat-browser-qa.mjs`: interfaz con servidor simulado, operaciones del chat, borradores, recuperación de un envío con respuesta perdida, prevención de ejecución de HTML y nueve tamaños de pantalla.
- La batería existente se ejecuta en el mismo PR para detectar regresiones.

Estas pruebas no equivalen a haber probado la subida de archivos, notificaciones con la web cerrada ni un registro contable desde el chat. Esas operaciones siguen bloqueadas por los puntos anteriores.
