# Revisión de Chat · 29/10/2026

## Alcance y resultado
Revisión del controlador, estilos, persistencia, carga inicial, recuperación de adjuntos, permisos y circuito de solicitudes de ChatGPT. Se preservan canales, secciones, orden personal, conversaciones directas, hilos, edición, borrado lógico, reacciones, búsqueda, avisos, tareas y documentos. No se modifica contabilidad, esquema, credenciales ni permisos de producción. La entrega se valida con pruebas aisladas, ensayo autorizado del ChatGPT convencional y publicación condicionada a CI.

## Fallos corregidos
- El repintado al cambiar de canal podía guardar el borrador anterior bajo el canal nuevo. Cada editor conserva ahora su clave de conversación; se comprueba ida y vuelta entre dos canales.
- Las actualizaciones reconstruían el editor. Se conserva su nodo y selección; se suspende el repintado durante composición IME y se impide enviar con un Enter de composición.
- La preservación de historial solo se activaba con más de 50 mensajes. También se aplica cuando se está leyendo por encima del final con menos mensajes.
- Una apertura asíncrona antigua podía instalar su suscripción sobre una apertura más reciente. Se valida la generación y sesión antes de suscribir.
- El contador de avisos tomaba la longitud de la vista previa, limitada a 100 mensajes. Usa ahora la suma de no leídos de los canales, respetando pertenencia, silencios, archivados y solo menciones.
- El móvil apilaba canales y conversación, obligando a recorrer demasiada página. Navegación propia entre lista y conversación cuando falta espacio, detectando también el ancho real del módulo junto a la barra lateral general. Los ordenadores con espacio suficiente conservan ambas columnas.
- El arranque descargaba todos los manifiestos de copias: muestra medida de 4.465.193 bytes frente a 37.446 bytes de metadatos, aproximadamente 99,2 % menos para esa consulta. No es una medición del tiempo total de arranque. Se conservan indicadores de formato, estado, huellas y rutas; la restauración obtiene los conjuntos originales verificados.

## Mejoras de trabajo
- Citar un mensaje en la conversación principal, manteniendo el borrador y validando longitud. Responder en hilo sigue disponible.
- Enviar y pedir a ChatGPT en un paso: mensaje → originales verificados → solicitud. Un fallo de solicitud informa de que el mensaje ya está guardado.
- Orientación concreta si falta invitar a ChatGPT a un canal privado, sin unirse automáticamente ni ampliar permisos.
- Ayuda de atajos, navegación de teclado y controles flexibles sin desbordamientos horizontales.

## Prueba con ChatGPT convencional
Autorizada por Diego, con texto ficticio en canal de ensayo creado mediante la aplicación. El chat «Recepción y Gastos» ejecutó lectura, reserva y respuesta y releyó el resultado. Otra consulta independiente confirmó estado completado, autor técnico ChatGPT, respuesta única y `parent_id` nulo. Sin gastos, cajas, documentos reales ni permisos modificados. No se activó API de pago ni despertador automático. El canal queda archivado, conservando trazabilidad.

## Matriz de comprobaciones
- Mensajes: creación, edición, borrado lógico, reintento sin duplicados, búsqueda por texto/fechas, fijados, menciones, hilos y citas.
- Navegación: filtros de canales, secciones personales, arrastre, favoritos, ocultos, archivados, pertenencia y cambios de usuario.
- Editor: borradores aislados, pérdida de conexión, composición, selección, actualización en vivo y aviso al salir.
- Archivos: PDF y TXT ficticios, selección, retirada, reintentos, hash, subida y descarga, respuesta perdida, acceso privado, no reenvío de credenciales y asociación recuperable.
- Lectura y avisos: reconocimiento automático solo del contenido visible al final, pestaña oculta, filtros, permisos de escritorio denegados y activación/desactivación.
- ChatGPT: identidad propia, destinatario válido, canal privado, idempotencia, solicitud y adjuntos; ensayo convencional real descrito arriba.
- Interfaz: 320–1920 px en baterías existentes; seis combinaciones adicionales de anchura/altura con historial largo, formularios y navegación móvil.
- Copias: carga de metadatos, estado de conjuntos fraccionados, compatibilidad histórica y recuperación en bases aisladas de CI.

Las pruebas nuevas son `tests/chat-integral-browser-qa.mjs` y `tests/backup-bootstrap-qa.mjs`; la batería existente conserva sus verificaciones y distingue los dos botones de envío.

## Seguridad y límites
Se revisaron avisos de seguridad/rendimiento y estructura del puente existente. No se desactivan RLS, validaciones, reservas ni comprobaciones de contexto. No se eliminan índices por aparecer como poco usados. Los avisos preexistentes de plataforma no equivalen a fallos demostrados de este módulo y no se declaran resueltos por estos cambios. La protección de contraseñas filtradas y la revisión general de funciones privilegiadas son controles de infraestructura independientes, no una garantía de seguridad absoluta de esta entrega.

Los avisos de escritorio necesitan permiso del navegador y Totus abierto. El ChatGPT convencional empieza cuando el equipo se lo pide; no recibe ejecución automática al publicar un mensaje. Las reservas protegen el contenido leído y los reintentos evitan duplicar respuestas. Los controles externos de OpenAI pueden bloquear una llamada y no deben eludirse.

## Referencias estudiadas
- Zulip, atajos y composición: https://zulip.com/help/keyboard-shortcuts y https://zulip.com/help/open-the-compose-box . Aplicación: citas y ayuda de teclado, sin sustituir el modelo de mensajes existente.
- Mattermost, barra lateral: https://docs.mattermost.com/end-user-guide/preferences/customize-your-channel-sidebar . Aplicación: navegación centrada en la conversación y conservación de organización personal.
- Documentación oficial Supabase sobre Realtime y control de acceso. Se mantiene la suscripción actual con limpieza y validación de sesión; no se introduce una arquitectura paralela.

## Mantenimiento
Código y pruebas quedan en GitHub; guía operativa en `docs/CHATGPT_CHAT_INTERNO.md`. La entrega completa se actualiza en OneDrive después de integrar y comprobar la publicación. No se conservan dependencias, informes privados ni servicios de trabajo en el portátil. Una auditoría ofrece evidencia de los recorridos comprobados, no puede prometer ausencia de cualquier fallo futuro.
