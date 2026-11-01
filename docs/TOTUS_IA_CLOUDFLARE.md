# Totus IA · Cloudflare Free

## Uso
En Configuración → APIs y conexiones se guarda la cuenta y el token privado de Workers AI. El token permanece en Vault y nunca se devuelve al formulario. Solo administración puede cambiar esta configuración. Primero guardar, probar y después activar. Workers Free debe seguir activo: el sistema no contrata planes ni cambia a proveedores de pago. El límite interno cuenta peticiones, no euros ni neuronas; Cloudflare aplica además su propia cuota gratuita.

Invitar a Totus IA al canal desde Miembros, o crear una conversación directa con su usuario. Enviar mediante «Enviar y pedir a Totus IA», pulsar «Pedir a Totus IA» sobre un mensaje existente o mencionarlo con el selector. En los directos con Totus IA, Enviar también solicita atención. La tarea aceptada se procesa en Supabase; no necesita mantener encendido el ordenador. La respuesta aparece en el canal, con referencias de los guardados que el servidor ha podido releer.

Para facturas indicar tienda, pago y datos que no figuren en el original. No se inventa la fecha de pago. Las altas quedan pendientes de revisión fiscal. Cajas requiere todos los cajones activos y cada importe explícito. Recepciones requiere los documentos completos de proveedor y PrestaShop, variantes, unidades y diferencias: una equivalencia concreta no se generaliza por su cuenta. Se pueden pedir simulaciones de gastos y cierres; usan el procedimiento real y revierten sus cambios.

## Límites y errores
Máximo cuatro originales por petición, 20 MB cada uno y 25 MB combinados. Se verifica tamaño y SHA-256 antes de su lectura. Si el original no se puede leer completo, no se da por contrastado. PDF, imágenes y Excel se convierten en Cloudflare; texto y CSV se leen directamente.

La IA no dispone de SQL libre, borrados, restauraciones ni cambios de usuarios o permisos. Usa su propia sesión, los permisos vigentes del solicitante y las validaciones normales. Si cambia el mensaje, los adjuntos, el acceso al canal o la configuración durante una tarea, se detiene. La cola acepta una sola tarea por mensaje. Un resultado incierto no se repite automáticamente: revisar la ficha antes de solicitar otro guardado.

## Mantenimiento
Código: supabase/functions/totus-ai; interfaz: src/cloudflare-connection.js y src/team-chat-ui.js; parche: supabase/review_patches/040_cloudflare_agent.sql. Las funciones privadas de configuración y cola son solo del servidor. No mostrar totus_ai_server_config ni el contenido de Vault en chats o informes.

Pruebas: workflow Cloudflare agent controls (motor, herramientas, identidad, PostgreSQL desechable, Deno y formulario móvil/escritorio). Las simulaciones no equivalen por sí solas a demostrar cada operación real con cada factura posible. Conservar esa distinción al entregar informes.
