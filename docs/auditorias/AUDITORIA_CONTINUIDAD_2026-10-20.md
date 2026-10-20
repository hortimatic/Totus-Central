# Revisión de continuidad y OneDrive — 20/10/2026
## Alcance
Solo staging. Código y manual en GitHub; funciones, datos, programación y secretos en Supabase; carpeta de aplicación privada en OneDrive. No se han creado archivos de trabajo locales ni modificado producción.

## Cambios y verificaciones reales
- Microsoft autorizó Files.ReadWrite.AppFolder y offline_access para la carpeta de aplicación. La conexión quedó registrada en el servidor.
- La prueba sintética escribió y volvió a leer el archivo con contenido idéntico. Se corrigió el acceso a hijos de la carpeta especial resolviendo su identificador autorizado; no se amplió el permiso.
- La copia documental por lotes está desplegada. Cada documento se comprueba por tamaño y SHA-256 después de descargarlo de OneDrive. Los originales se conservan en Supabase.
- Supabase Cron comprueba pendientes cada dos minutos; no realiza solicitudes si no quedan pendientes. La reserva temporal evita solapamientos y expira si se interrumpe una ejecución.
- Se comprobaron lotes reales con respuesta HTTP 200 y coincidencia de huellas/tamaños. El inventario completo aún está en proceso.
- Las tablas privadas de conexión, estados OAuth y espejo documental tienen RLS y ACL de solo servicio; authenticated y anon no tienen lectura directa. Tampoco pueden ejecutar el disparador de la tarea automática.
- Comprobación del servidor con identidad sin pertenencia al equipo: 45 combinaciones de módulo/operación, cero permisos concedidos.
- Se revisaron las 17 funciones SECURITY DEFINER accesibles a autenticados: incluyen controles explícitos de administración o permisos de módulo. Esto no equivale a una prueba de todos sus argumentos y casos.
- Authenticated y anon no tienen CREATE en el esquema public, relevante para las funciones que usan ese search_path.
- Se corrigió el valor heredado de conservación en totus_backup_save_settings: al guardar se mantienen cinco copias.
- Se recuperaron peticiones en PETICIONES_Y_CIERRE_2026-10-20.md y se añadió el manual operativo docs/MANUAL_CHATGPT_ONLINE.md.

## Interfaz y robustez
- OneDrive se integra dentro de Administración → Almacenamiento, sin pestaña separada.
- El panel muestra cantidad documental verificada, pendientes, trabajo en curso y último error; no lo confunde con la cuota total de la cuenta.
- La actualización automática no debe borrar una credencial mientras el titular la introduce.
- Se retiran textos antiguos que presentaban «al fin» como posible efectivo conservado, pues el titular confirmó que eran ventas. Se mantiene la protección contra duplicar la referencia fiscal mensual.
- Se sustituye «simulaciones internas» en el aviso fiscal por una explicación de previsión, contraste, importe declarado y pago.
- Un source_ref incompleto no debe impedir abrir todo el listado de cajas; el detalle conserva el aviso de datos no disponibles.

## Pruebas y publicación
- 7a244423 y be717a8c completaron la revisión automatizada. La publicación inicial de be717a8c falló al instalar dependencias por HTTP 403 de un repositorio externo; su reintento completó correctamente.
- 887ad01d completó QA. Las versiones posteriores deben verificarse por su propio resultado.
- Se amplió el flujo de navegador OneDrive para comprobar integración en Almacenamiento, credencial efímera, consentimiento explícito, progreso documental y ausencia de cambios contables durante la prueba simulada.
- Se añadió regresión para listado de cajas con referencia histórica malformada.
- Consultar GitHub Actions antes de declarar publicada la última versión; guardar un commit no basta.

## Avisos que no deben ocultarse
El asesor de seguridad mantiene avisos de funciones SECURITY DEFINER accesibles a autenticados y protección de contraseñas filtradas no habilitada. Los nuevos INFO «RLS sin políticas» corresponden a tablas privadas sin acceso ordinario, deliberadamente reservadas al servicio.
Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable y https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .
No se deben retirar controles ni contratar servicios para silenciar avisos.

## Pendientes de cierre
- Completar el inventario documental y verificar continuidad tras renovación del acceso Microsoft.
- Trasladar el almacenamiento principal solo cuando funcionen vistas previas, descarga, permisos y recuperación desde el destino definitivo.
- Trasladar y verificar copias completas; actualmente las copias nocturnas de las 00:35 Europe/Madrid siguen en Supabase.
- Ensayar recuperación integral aislada; un archivo íntegro no demuestra que la restauración esté certificada.
- Revisar el límite técnico de los archivos de copia, separado de la cuota de Storage.
- Recorrido autenticado final de módulos con los permisos de los distintos roles y revisión visual sobre datos reales.
- Revisar el resto del registro de peticiones y actualizar evidencia punto a punto. Esta intervención no certifica «100 % terminado».
