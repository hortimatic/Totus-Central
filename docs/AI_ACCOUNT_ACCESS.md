# Acceso común de cuentas de IA

## Preparación desde la interfaz

1. Crear o elegir una cuenta propia de la IA en Administración → Usuarios. Asignar el rol y los permisos necesarios; no usar la cuenta personal de un empleado.
2. Editar esa cuenta y abrir **Acceso de IA**. Las cuentas técnicas creadas por APIs pueden reutilizar el acceso existente dejando la contraseña vacía. Para una cuenta manual, el administrador introduce la contraseña actual únicamente en este campo privado.
3. Pulsar **Verificar y vincular cuenta**. Se comprueba una sesión real y su identificador de Auth. No se cambia la contraseña, el rol ni los permisos. Las credenciales quedan cifradas en el servidor, no en el navegador ni en los chats.
4. Para el conector ChatGPT anterior, marcar explícitamente su casilla de compatibilidad. Las demás cuentas no sustituyen a ChatGPT ni a Totus IA.
5. En Configuración → APIs, asignar esa cuenta a su conexión. Cada proveedor conserva su propia identidad. Verificar conexión y después probar una operación con relectura; el ping no certifica el trabajo completo.

## Asistentes externos con conector administrativo autorizado

Comprobar la sesión propia mediante `private.totus_agent_submit(p_actor_email, 'session_check', '{}'::jsonb)` y recoger el identificador devuelto con `private.totus_assistant_result(job_id)`. No consultar ni copiar Vault, contraseñas o tickets. El resultado no contiene credenciales.

Para conocer las operaciones: enviar acción `operation` con `{"operation":"catalogue"}`. Para ejecutar, utilizar el nombre y argumentos exactos del catálogo con `{"operation":"rpc","name":"...","args":{...}}`. La sesión aporta su propia identidad. No introducir un correo ajeno en `p_actor_email`.

Cada solicitud utiliza un trabajo independiente y un ticket efímero de un solo uso, consumido exclusivamente por el servidor. No repetir una escritura con resultado incierto: consultar primero su estado y releer el registro. Conservar request_id y revisión de la ficha cuando el contrato los exige.

El acceso al envío de trabajos está reservado al conector administrativo ya autorizado; no se expone a visitantes ni al navegador anónimo. No todos los productos de IA incluyen ese conector: configurarlo es independiente de crear una cuenta en Totus.

## IA conectadas por API

El servidor usa la cuenta asignada a esa conexión, verifica su UUID y aplica los mismos procedimientos de negocio. Las herramientas especializadas conservan validación de importes, originales, cobertura de cotejos y relectura. La herramienta común `operacion` amplía el acceso al catálogo compartido de módulos. Una operación que aún exige relectura nunca debe presentarse como comprobada.

Para entregar una factura: localizar el documento real, comprobar acceso y bytes del original, incorporarlo a la cola de entrega y publicar el adjunto en el mismo chat y con la cuenta que recibió la petición. No sustituir proveedor o identidad silenciosamente.

## Revocación y diagnóstico

Retirar una cuenta impide sus operaciones normales. Su borrado definitivo elimina su vinculación cifrada y, si correspondía, el alias del conector anterior, conservando historia y documentos. Si cambia su contraseña, volver a verificar y vincular la cuenta.

Distinguir: cuenta no vinculada, permiso de negocio denegado, autenticación del proveedor, cuota agotada, formato de herramientas incompatible y resultado de escritura incierto. No solucionar uno suplantando otra cuenta. Este sistema no aumenta cuotas externas, no incorpora protocolos de proveedor desconocidos automáticamente ni concede acceso a GitHub o OneDrive sin sus conexiones autorizadas.
