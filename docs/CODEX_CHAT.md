# Codex: identidad propia en el chat

Esta revisión amplía el puente existente. No instala un modelo ni un servicio permanente y no activa una API de IA de pago.

## Operación autorizada
La conexión administrativa autorizada puede llamar `private.totus_codex_submit(action,payload)` y consultar `private.totus_assistant_result(job_id)`. Acciones: setup, session_check, chat_read, chat_send y chat_direct. Las credenciales se generan en Vault y nunca se devuelven al chat. Cada ticket es de un uso y caduca en dos minutos.

Codex usa `codex@totuscentral.invalid`, nombre Codex, rol admin solicitado expresamente por Diego. El puente solo admite operaciones de chat; no añade rutas contables. No suplantar a ChatGPT, compartir su contraseña, desactivar RLS o cambiar permisos para resolver errores. No tomar posesión ni reactivar automáticamente cuentas existentes. Los canales privados requieren pertenencia.

Para `chat_read`: channel_id opcional y before/query opcionales. Para `chat_direct`: target_email de un usuario activo. Para `chat_send`: channel_id, client_id UUID estable, body y target_email solo en directos. Releer el resultado y comprobar message_id/canal/autor/cuerpo. Reintentar con el mismo client_id tras respuesta perdida, nunca duplicar mensajes.

## Instalación
Aplicar el parche025 después de probarlo y desplegar los tres archivos existentes de totus-assistant (index, assistant-chat, assistant-attachments) sin cambiar las dependencias. El endpoint valida su propio ticket y conserva los permisos de sus funciones públicas. Ejecutar setup una vez, verificar sesión propia, canal y mensaje antes de afirmar conexión.

## SDK y activación automática
El SDK/app-server oficial requiere un proceso de ejecución y autenticación admitida. Este puente permite a una ejecución Codex activa operar el chat; NO despierta este chat de ChatGPT ni otro chat convencional automáticamente, NO despliega un proceso en la nube, y NO constituye una integración SDK terminada. No copiar sesiones o tokens de dispositivos ni activar servidores/costes sin autorización. Hasta verificar ese circuito, el inicio sigue siendo explícito desde una conversación con conectores autorizados.

Pruebas dirigidas: node --test tests/assistant-chat.mjs tests/assistant-own-auth.mjs tests/codex-chat.mjs tests/codex-own-auth.mjs
