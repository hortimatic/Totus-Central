# Dirección propia de Totus Central

Objetivo: https://totuscentral.totuscode.com, utilizando GitHub Pages y el DNS existente en Hostinger. Sin Vercel, sin nuevo alojamiento ni dominio personalizado de pago de Supabase. Supabase conserva su dirección técnica actual.

## Secuencia de cambio

1. Partir de la versión publicada; leer los paquetes activos completos de los servicios. Comparar versión, dependencias y huellas antes de desplegar. Para este cambio solo se permiten el punto de entrada y src/application-cors.js de cada servicio.
2. Comprobar ambos orígenes exactos de navegador: https://hortimatic.github.io y https://totuscentral.totuscode.com. No admitir comodines, dominios parecidos, HTTP ni Origin null. Mantener las comprobaciones de usuario, permisos, cron y las respuestas del servicio.
3. En Authentication → URL Configuration de Supabase, conservar la dirección anterior y añadir el retorno HTTPS exacto de la dirección nueva. No ampliar proveedores, usuarios ni permisos. Cambiar la dirección predeterminada solo durante el cambio definitivo.
4. Registrar el subdominio en Settings → Pages del repositorio hortimatic/Totus-Central antes de crear su DNS, evitando una dirección apuntada a Pages sin reclamar.
5. Añadir exclusivamente CNAME totuscentral → hortimatic.github.io en Hostinger. No modificar @, www, correo ni otros registros. GitHub Actions no necesita un archivo CNAME en el paquete publicado.
6. Esperar a la comprobación de DNS y emisión del certificado de GitHub. Activar Enforce HTTPS cuando esté disponible. No sortear alertas de certificado ni declarar terminado un dominio con TLS pendiente.
7. Verificar versión servida, entrada, recuperación de sesión, peticiones y errores CORS desde el nuevo origen. Las sesiones locales del dominio antiguo no se transfieren: puede ser necesario iniciar sesión de nuevo. Nunca copiar tokens a mano entre dominios.
8. Verificar los enlaces antiguos: GitHub Pages puede redirigirlos a la nueva dirección. Comprobar también rutas, parámetros de módulo y recursos estáticos; no asumir que quitar el prefijo /Totus-Central/ funciona en todos los enlaces históricos.

## Reversión

Antes de cambiar, registrar el dominio de Pages, Site URL, retornos y registro DNS. Si la comprobación falla, conservar el acceso actual y no completar el cambio. Después de un cambio, retirar el dominio personalizado de Pages y devolver Site URL a su valor previo si fuera necesario; revisar el CNAME para que nunca quede abandonado apuntando a un recurso sin dueño. No retirar el origen anterior de los servicios mientras exista algún consumidor o enlace vigente.

## Alcance de las comprobaciones

tests/application-cors-qa.mjs verifica orígenes exactos, OPTIONS, errores de autenticación, respuestas en flujo, llamadas sin Origin y dependencias del despliegue. Las comprobaciones reales de DNS, HTTPS y sesión deben anotarse por separado con fecha y versión. Una prueba local no acredita propagación DNS ni una sesión real.
