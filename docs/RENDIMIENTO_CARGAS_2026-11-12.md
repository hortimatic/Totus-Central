# Cargas de directorios y Ventas — 12/11/2026

Corrección de esperas del cliente sobre PR #189. No modifica Supabase, servicios, permisos, claves, datos comerciales ni configuración de PrestaShop.

- Directorios: lectura principal e idiomas independientes; tandas de direcciones simultáneas con máximo tres; países/provincias independientes en paralelo. La lista principal aparece antes de terminar sus datos secundarios.
- Copia de sesión por cuenta, tienda, conexión, revisión, recurso y filtro: se representa al volver, con fecha y aviso de actualización; cada entrada vuelve a consultar los registros. No es una caché permanente ni un temporizador. Las publicaciones verificadas la invalidan.
- Peticiones idénticas simultáneas comparten transporte; cada consumidor recibe una copia independiente. Las respuestas de sesiones anteriores no se incorporan.
- Ventas/PrestaShop: contexto y preferencias en paralelo; costes de combinaciones únicas con máximo tres lecturas simultáneas. Se mantienen el cálculo y la validación del producto asociado; no se reutilizan costes indefinidamente.
- La actualización de distribución ya no oculta el aviso de que los datos guardados siguen actualizándose.

Verificación: pruebas de transporte/caché/concurrencia; navegador con respuestas retenidas para comprobar filas antes de direcciones y copia visible antes de respuesta nueva; relectura real del flujo y sustitución de copia; directorios, direcciones, Ventas a cinco tamaños y paginación a 390/1440. Estas pruebas de rendimiento son simulaciones controladas, no mediciones del tiempo real de todas las APIs de producción.

No prometer carga instantánea en una primera consulta externa: la latencia de PrestaShop y la red sigue existiendo. El plan de Supabase no modifica esos tiempos. El objetivo de esta corrección es eliminar esperas evitables y peticiones duplicadas, sin omitir verificaciones de escritura.
