# Cierre de cambios recientes · 29/10/2026

Alcance acotado a Chat, carga inicial y coherencia del trabajo reciente. No es una auditoría nueva de toda la aplicación ni una certificación de ausencia absoluta de errores.

## Corrección adicional
Una confirmación demorada de envío borraba indiscriminadamente el editor y los archivos seleccionados. Podía eliminar el siguiente borrador o el de un canal abierto mediante navegación directa mientras llegaba la respuesta.

El envío conserva ahora el texto exacto y los identificadores de sus adjuntos. Al confirmarse, retira únicamente ese texto si no ha cambiado y esos adjuntos concretos. Comprueba también a qué conversación pertenece el editor antes de vaciarlo. Se mantienen la interfaz, el envío normal, las solicitudes, el resto de borradores y los reintentos existentes.

Prueba: el caso nuevo reproduce el fallo con el código anterior; con la corrección pasan escritura durante espera, archivo nuevo y navegación a otro canal. Se conserva la batería dirigida de Chat con composición, lectura, solicitudes, permisos privados y tamaños de pantalla. No se crean conversaciones ni documentos reales para estas pruebas.

## Limpieza y continuidad
- Cuatro ramas antiguas retiradas solo después de comprobar su integración y la coincidencia de sus revisiones: PR #40, #43, #48 y #51. Sus cambios e historial permanecen en producción y GitHub.
- Supabase comprobado por metadatos: diez copias guardadas, último intento correcto y ningún trabajo de copia pendiente. No se repite el respaldo completo ya verificado ni se cambian funciones, permisos o datos contables en esta intervención.
- Los SQL 025, 026 y 027 se conservan como historial ordenado de correcciones aplicadas; no se borran ni reaplican como si fueran residuos.
- Las fuentes sincronizadas y los originales de OneDrive se conservan. La entrega vigente se actualiza con el código integrado; los archivos temporales locales se retiran después de verificarla.

## Trabajo posterior
Seguir con ajustes concretos y comprobaciones de las zonas afectadas. No interpretar este cierre como sustituto de los objetivos amplios de usabilidad pendientes ni iniciar otra revisión general sin acordar su alcance. Los límites de uso se consultan al inicio y antes del cierre, sin confundir crédito disponible con autorización para ampliar el trabajo.
