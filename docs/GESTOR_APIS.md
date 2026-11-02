# Gestor de APIs y usuarios de conexión

## Uso
1. Configuración → APIs → Nueva conexión. Indica nombre y protocolo; una API genérica necesita su destino HTTPS y autenticación.
2. Asigna un usuario activo. Para que una IA trabaje automáticamente, usa «Crear usuario de conexión» o la identidad técnica de Totus IA ya preparada. Elige su rol y ajusta sus permisos en Administración → Usuarios. No usa la contraseña de una persona.
3. Guarda la clave en el campo privado. Vacío conserva la existente. La clave se cifra en Vault y nunca se devuelve al navegador. No la escribas en mensajes, URLs, GitHub ni fuentes del proyecto.
4. Confirma la cuota gratuita o incluida que hayas comprobado. Totus no contrata planes ni cambia de proveedor cuando falla uno. Esta confirmación no sustituye comprobar las condiciones de cada proveedor.
5. «Probar» hace una lectura HTTP o envía exclusivamente el mensaje ficticio esperado. La prueba consume una petición del límite local; no crea contabilidad.
6. «Activar» habilita el perfil probado. «Usar por defecto» selecciona expresamente el proveedor y su usuario para Totus IA. El usuario necesita pertenecer al canal y tener los permisos de la operación; también se comprueban los permisos de quien la solicita.
7. PDF e imágenes requieren el lector Cloudflare verificado. Si la IA principal usa otro proveedor, configura y autoriza explícitamente ese lector; no hay envío secundario implícito.

## Gestión
- Configurar exige la revisión actual. Cambiar parámetros o clave exige repetir la prueba; no conserva una verificación falsa.
- Duplicar crea un perfil desactivado y sin clave, sin trasladar autorizaciones de datos.
- Desactivar detiene su uso. Eliminar retira el perfil y su clave; conserva la cuenta técnica, documentos y datos contables. La cuenta se administra por separado.
- Si se interrumpe la creación de la cuenta, «Completar creación» reanuda la misma solicitud. No reinicies creando cuentas repetidas.
- Los límites de peticiones son locales, diarios UTC, e incluyen intentos y pruebas. Los tokens se muestran solo cuando la respuesta los facilita. No se inventa un porcentaje de cuota del proveedor.

## Alcance real
HTTP, PrestaShop y GitHub permiten comprobar la conexión. No incorporan automáticamente operaciones de esos servicios: cada operación necesita su adaptador autorizado. Cloudflare, Chat Completions y Anthropic tienen adaptadores de herramientas de IA; las pruebas de protocolos usan respuestas ficticias. Cada conexión real necesita su prueba con la clave y modelo seleccionados. La configuración antigua de Gemini ya no aparece como un panel independiente.

Las acciones contables usan las funciones normales, identidad propia, permisos, comprobación de importes y relectura. No hay SQL arbitrario ni modificación de código desde el modelo. El mantenimiento de código continúa mediante rama y revisión, no mediante una clave de IA.

## Despliegue y mantenimiento
Orden probado: 044_api_connections.sql → 045_api_agent_selection.sql → 046_api_technical_users.sql; después totus-connections y totus-ai, y finalmente la interfaz. No se alteran filas contables. 045 conserva la conexión existente Cloudflare y sus llamadas del día; las credenciales permanecen dentro de Vault.

Verificación dirigida: workflow api-manager.yml, pruebas PostgreSQL de ciclo de vida, importación existente, usuarios técnicos y permisos; pruebas de transporte, servicio y adaptadores; Playwright de la pantalla móvil y PC. No dar por publicado un commit de rama.

Las tablas privadas de conexiones y credenciales no forman parte del volcado contable actual. Una recuperación de contabilidad no recrea las claves externas ni usuarios de Auth: deben conservarse en su servicio seguro y revisarse/reconectarse después de una recuperación. No exportar Vault ni contraseñas a GitHub o fuentes.

## Direcciones y comprobación real
- La página donde se crea una clave no es la API. Para Groq y Mistral, «Aplicar datos del proveedor» propone el destino y un modelo editable; no guarda cambios ni sustituye la clave por sí solo. Revisa las condiciones y disponibilidad de tu cuenta antes de activar.
- Referencias oficiales: https://console.groq.com/docs/models y https://docs.mistral.ai/api .
- Las consolas de gestión se rechazan antes de enviar la clave. Una página HTML de inicio de sesión no acredita una API funcional.
- Si falla una nueva comprobación, desaparece la verificación anterior y la conexión queda desactivada. Una prueba posterior correcta permite volver a activarla expresamente; no la activa sola.
- Las identidades técnicas originales y las nuevas cuentas de conexión usan la misma validación normal de gastos y cajas. Se mantienen el rol de gerencia/administración y los permisos de cada operación. Esta compatibilidad no añade operaciones que un adaptador aún no implemente.
- Continuación del despliegue: 047_api_verification_failure.sql y 048_api_identity_validation.sql; después actualizar totus-connections y publicar la interfaz. Ninguno modifica registros contables.

## Conversaciones con cada IA y archivos
Una conversación directa con la cuenta técnica o una mención a esa cuenta dirige la solicitud a su propia conexión, aunque Cloudflare siga como proveedor por defecto. Invita al usuario al canal. No se atienden mensajes de otras IA automáticamente. Activar comprueba también que exista una identidad técnica preparada.

Para pedir un original: indica proveedor, factura o fechas; la IA consulta documentos, verifica el original y lo adjunta a su respuesta. Para recibir un informe descargable: pide expresamente el archivo y el periodo; puede entregar un CSV con las cifras completas de Informes. Los adjuntos se comprueban antes y después de subirlos. No equivale a un ZIP de gestoría completo.

Los originales de una recepción existente pueden leerse con el lector autorizado y contrastarse antes de guardar el cotejo. La revisión fiscal de nuevas facturas no se aprueba automáticamente.

## GitHub y alcance de las conexiones externas
La IA no hereda sesiones ni claves de los conectores de Codex o ChatGPT. Crea una conexión GitHub con destino https://api.github.com/repos/organizacion/repositorio, una clave de alcance limitado al repositorio y el mismo usuario técnico de la IA. Prueba y activa la conexión. El adaptador entregado permite leer código de ese repositorio mediante github_archivo, conservando la clave en el servidor. No publica cambios ni concede acceso arbitrario a SQL/Vault. Los cambios de código siguen requiriendo una rama revisable y el proceso de publicación.

Despliegue siguiente: 049_api_chat_routing.sql y 050_api_actor_readiness.sql, totus-ai y totus-connections, y pantalla. Las conexiones nuevas siguen dependiendo de la disponibilidad y cuota real del proveedor; HTTP401 y HTTP429 no se corrigen aumentando el límite local.

## Evidencia de reparación 02/11/2026
Pruebas reales desde la identidad propia de Codex, sin altas contables: Groq contestó por su cuenta técnica; Cloudflare entregó un original existente con un adjunto verificado; Groq generó y entregó un CSV de un periodo futuro ficticio. Ambas entregas finalizaron con expected_files=1 y un archivo ready/verificado, cada una firmada por su usuario diferente. No se compartieron claves ni se intercambiaron los proveedores. Mistral continúa sujeto a la prueba y cuota de su propia cuenta.

Una comprobación simple de clave no acredita todos los recorridos de trabajo. Estas verificaciones añadieron conversación y entrega real de archivos a las pruebas aisladas de seguridad, permisos y fallos.

## Alta reutilizable de nuevas IA
Nueva conexión exige elegir un usuario. Puedes seleccionar una cuenta técnica existente o «Crear usuario propio automáticamente», con rol Administración por defecto y posibilidad de elegir otro rol. No se asigna Totus IA de forma implícita. Al guardar se prepara una identidad técnica individual, sin utilizar contraseñas humanas. Si reintentas tras un fallo se reutiliza la misma preparación. Revisa tipo, dirección, modelo y clave; la prueba exige una llamada ficticia de herramienta, no únicamente una respuesta de texto. Activa y pulsa «Abrir chat». Cada conversación directa y mención usa su propia identidad y conexión; «Usar por defecto» solo cambia el destinatario genérico.

Protocolos de IA implementados: Chat Completions compatible, Anthropic y Cloudflare. Una web HTTP genérica no equivale a un adaptador de IA. Los modelos deben ofrecer llamadas a herramientas y su cuenta debe tener cuota disponible. No se contratan pagos ni se cambian proveedores al fallar.

## Retirada y recuperación de usuarios
«Eliminar usuario» retira el acceso, bloquea su cuenta de autenticación y conserva una identidad histórica para no romper facturas, mensajes ni tareas. Desactiva sus conexiones y cancela solicitudes pendientes. En Usuarios eliminados se puede recuperar expresamente; las conexiones no se reactivan solas. No se puede eliminar la propia sesión ni dejar el sistema sin administradores. Si falla el bloqueo de autenticación, se informa como pendiente y se permite completar la retirada. No borrar filas de Auth ni borrar autorías históricas para evitar restricciones de referencias.

## Continuidad y descargas de la conversación

- El contexto incorpora hasta 24 mensajes anteriores del mismo solicitante y canal, con un límite de tamaño. La petición actual se coloca después de los datos de referencia para que una aclaración breve no quede desplazada por el catálogo.
- `diario_mensual` resuelve el nombre real de tienda y entrega el mismo XLSX mensual de Informes, usando el constructor compartido, colores, fórmulas, facturas y referencias históricas. No reemplazarlo por un CSV cuando se solicita Excel.
- `buscar_documentos` y `enviar_documento` buscan y adjuntan el original autorizado. La entrega se confirma después de comprobar la subida y la huella; preparar un archivo no es entregarlo.
- Groq utiliza un presupuesto de salida de 1024 tokens por turno operativo y el catálogo completo se solicita solo cuando hace falta. Un HTTP 429 del proveedor sigue siendo un límite real; no activar pagos, sustituir identidades o prometer saldo ilimitado.
- Un HTTP 401 de Mistral requiere que el titular corrija la clave privada. La cuenta y las herramientas de Totus no pueden convertir una clave rechazada en una conexión válida.

## Alta autónoma de una IA compatible

1. Crea una conexión y elige el proveedor preparado, o el protocolo compatible y su dirección oficial. Se admite la dirección base y la ruta completa de Chat Completions, sin duplicarla.
2. Introduce el identificador del modelo y la clave privada. Elige una cuenta técnica propia o su creación automática; una cuenta manual de una persona no reutiliza su contraseña para actuar como bot.
3. Configura por separado las peticiones diarias y el máximo de tokens de salida por respuesta (64–32768, según el modelo). La prueba y el trabajo real utilizan el mismo máximo de tokens. Los tokens consumidos son un dato observado, no un saldo que se escribe.
4. Guarda y prueba. La verificación exige una llamada real a la herramienta ficticia; una clave que devuelve texto, una respuesta cortada, o un HTTP 401/429 no se presentan como una conexión operativa.
5. Activa y abre su chat. En un directo la conexión corresponde al usuario de ese directo; no se sustituye por el proveedor por defecto. Cada usuario conserva sus permisos.
6. Pide un documento por proveedor, número, nombre o fecha. La entrega usa los originales y se comprueba antes de completar el trabajo. El Excel mensual conserva el constructor de Informes.

No hace falta cambiar código para otra IA que use un protocolo ya soportado. Un protocolo distinto requiere su adaptador. La clave, el plan, los modelos admitidos y la cuota pertenecen al proveedor: Totus no puede ampliarlos ni activar pagos por su cuenta. En la cuenta Mistral revisada el 2 de noviembre, la propia consola mostraba que el plan Gratis no activaba las claves API; no declarar solucionado ese bloqueo por cambiar el contador local.
