# Gestor de APIs y usuarios de conexión

## Uso
1. Configuración → APIs → Nueva conexión. Indica nombre y protocolo; una API genérica necesita su destino HTTPS y autenticación.
2. Asigna un usuario activo. Para que una IA trabaje automáticamente, usa «Crear usuario de conexión» o la identidad técnica de Totus IA ya preparada. Elige su rol y ajusta sus permisos en Administración → Usuarios. No usa la contraseña de una persona.
3. Guarda la clave en el campo privado. Vacío conserva la existente. La clave se cifra en Vault y nunca se devuelve al navegador. No la escribas en mensajes, URLs, GitHub ni fuentes del proyecto.
4. Confirma la cuota gratuita o incluida que hayas comprobado. Totus no contrata planes ni cambia de proveedor cuando falla uno. Esta confirmación no sustituye comprobar las condiciones de cada proveedor.
5. «Probar» hace una lectura HTTP o envía exclusivamente el mensaje ficticio esperado. La prueba consume una petición del límite local; no crea contabilidad.
6. «Activar» habilita el perfil probado. «Usar en Chat» selecciona expresamente el proveedor y su usuario para Totus IA. El usuario necesita pertenecer al canal y tener los permisos de la operación; también se comprueban los permisos de quien la solicita.
7. PDF e imágenes requieren el lector Cloudflare verificado. Si la IA principal usa otro proveedor, configura y autoriza explícitamente ese lector; no hay envío secundario implícito.

## Gestión
- Configurar exige la revisión actual. Cambiar parámetros o clave exige repetir la prueba; no conserva una verificación falsa.
- Duplicar crea un perfil desactivado y sin clave, sin trasladar autorizaciones de datos.
- Desactivar detiene su uso. Eliminar retira el perfil y su clave; conserva la cuenta técnica, documentos y datos contables. La cuenta se administra por separado.
- Si se interrumpe la creación de la cuenta, «Completar creación» reanuda la misma solicitud. No reinicies creando cuentas repetidas.
- Los límites de peticiones son locales, diarios UTC, e incluyen intentos y pruebas. Los tokens se muestran solo cuando la respuesta los facilita. No se inventa un porcentaje de cuota del proveedor.

## Alcance real
HTTP, PrestaShop y GitHub permiten comprobar la conexión. No incorporan automáticamente operaciones de esos servicios: cada operación necesita su adaptador autorizado. Cloudflare, Chat Completions y Anthropic tienen adaptadores de herramientas de IA; las pruebas de protocolos usan respuestas ficticias. Cada conexión real necesita su prueba con la clave y modelo seleccionados. Gemini sigue limitado a mensajes ficticios.

Las acciones contables usan las funciones normales, identidad propia, permisos, comprobación de importes y relectura. No hay SQL arbitrario ni modificación de código desde el modelo. El mantenimiento de código continúa mediante rama y revisión, no mediante una clave de IA.

## Despliegue y mantenimiento
Orden probado: 044_api_connections.sql → 045_api_agent_selection.sql → 046_api_technical_users.sql; después totus-connections y totus-ai, y finalmente la interfaz. No se alteran filas contables. 045 conserva la conexión existente Cloudflare y sus llamadas del día; las credenciales permanecen dentro de Vault.

Verificación dirigida: workflow api-manager.yml, pruebas PostgreSQL de ciclo de vida, importación existente, usuarios técnicos y permisos; pruebas de transporte, servicio y adaptadores; Playwright de la pantalla móvil y PC. No dar por publicado un commit de rama.

Las tablas privadas de conexiones y credenciales no forman parte del volcado contable actual. Una recuperación de contabilidad no recrea las claves externas ni usuarios de Auth: deben conservarse en su servicio seguro y revisarse/reconectarse después de una recuperación. No exportar Vault ni contraseñas a GitHub o fuentes.
