# PrestaShop 1.7.8.11 · primera fase de integración (solo lectura)

Fecha de preparación: 03/11/2026. Versión de ambas tiendas comunicada por Diego; **no verificada mediante autenticación al webservice**.

## Alcance y límites constatados

- Dos instalaciones independientes: Hortimatic/Azuqueca (cajones Vape y Head) y NewOldSmok/Alcalá. No se mezclan datos.
- El gestor existente de Configuración → APIs almacena la clave en Vault. No se añade almacén ni clave al navegador, código, SQL o informe. El conector hace solicitudes GET desde el servidor.
- Recursos estándar de PrestaShop 1.7 documentados: `stock_availables` y `stock_movements`. El acceso real depende de los permisos que tenga cada webservice; un test de la raíz `/api` no demuestra permiso para listar recursos.
- PrestaShop estándar NO ejecuta SQL libre. El TPV de terceros y sus tablas particulares deben estudiarse en el módulo instalado: **no se dispone aún de prueba de lectura de cierres, retiradas o de sus tablas relacionadas**.
- No se modifica stock, ventas, tarjeta, cajas, factura, gasto ni contabilidad. No se ejecutan consultas SQL sobre MySQL remoto. El código actual no sincroniza automáticamente ni agrega importes.
- Los movimientos de existencias son evidencia de un movimiento, no certifican por sí solos una recepción de mercancía.

## Preparación humana y conexión segura

Las claves webservice recibidas por conversación **no se transfieren desde este chat**, porque el titular debe introducirlas en el control privado. Por haber aparecido en mensajes, sustituirlas por otras nuevas de solo lectura desde el back office de cada tienda antes de activarlas.

En cada PrestaShop verificar URL real de instalación, dominio HTTPS, redirecciones, activación del webservice, y conceder solo GET de los recursos mínimos. No basarse únicamente en páginas públicas que mencionen un dominio. No activar permisos POST/PUT/DELETE.

En Totus Central → Configuración → APIs, crear y probar cada perfil con estos nombres exactos:
- `PrestaShop · Hortimatic`
- `PrestaShop · NewOldSmok`

Protocolo: PrestaShop; dirección **confirmada por el administrador de esa instalación**, terminada en `/api`; autenticación Basic mediante cabecera HTTPS Authorization (el webservice de 1.7 usa la clave como usuario y contraseña vacía). Introducir cada clave renovada únicamente en el campo privado del gestor. Tras la prueba de raíz (que solo verifica conectividad básica), activar el perfil y habilitar de forma consciente la autorización de lectura de datos reales existente. Confirmar conexión y recurso permitido por separado; el estado de un perfil no acredita datos de negocio.

## Panel Configuración → PrestaShop

Muestra estado de ambos perfiles, diagnóstico de una sesión, una prueba de conexión, lectura manual y acotada de recursos estándar, paginación y respuesta por tienda. El historial detallado de errores en esta fase vive únicamente en la sesión del navegador: el gestor existente mantiene contadores por conexión, no aún un histórico persistente de errores de lectura. Esto queda expresamente pendiente.

Si no existe perfil correcto o tiene estado incorrecto, la lectura está deshabilitada. Si el recurso no existe, el servidor rechaza el formato o el webservice deniega GET, mostrar el error sin inventar filas. Los datos se proyectan a un subconjunto de campos; nunca devuelve la clave privada.

## Próxima fase: cierres, retiradas y Recepciones

Con la instalación real verificada: identificar nombre/versión del TPV, sus tablas y las relaciones entre apertura, cierre, retiradas, cajones y usuario. Cotejar una sola fecha y tienda contra el informe del TPV. Si la API estándar no expone esos datos, preparar un módulo pequeño en cada PrestaShop con consultas SQL parametrizadas, de solo lectura, sobre tablas previamente verificadas, y pruebas de permisos, paginación, idempotencia y no duplicación. Ninguna petición del navegador debe aceptar SQL libre.

Solo después integrar vistas de consulta en Cajas/Recepciones; conservar fecha de venta frente a fecha de abono de tarjeta, formato monetario, zona Europe/Madrid, identificador de origen y separación de cada cajón. No crear cierres, ingresos fiscales ni recepciones automáticamente.

## Verificación y despliegue

Las pruebas de la rama ejercitan datos ficticios, denegación de usuario, permisos de recurso, respuesta errónea y ausencia de escrituras. La publicación de una interfaz nueva y despliegue de una versión nueva de `totus-connections` son operaciones separadas: **no fusionar ni desplegar el servicio hasta aprobar la revisión técnica de seguridad y pasar los controles de CI**. Un PR abierto no equivale a producción.
