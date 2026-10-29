# Preparación de copias por componentes · 29/10/2026

Al comprobar la carga de metadatos durante la revisión de Chat se detectó un fallo real de la copia nocturna de las 00:35. Las diez copias anteriores se conservaban. Los reintentos manuales también fallaban antes de preparar componentes y almacenaban el texto poco útil `[object Object]`.

La consulta del registro real confirmó un agotamiento de tiempo de sentencia (57014) en la comprobación de la clave foránea de `ops_backup_work` contra `ops_backup_runs`. No se detectaron originales ausentes en documentos, adjuntos listos ni logos. La preparación anterior actualizaba el registro y después insertaba el trabajo en dos peticiones independientes.

La corrección guarda la preparación en una sola transacción mediante `totus_backup_prepare_work`: bloquea el registro, valida que sigue en curso, conserva un trabajo existente compatible sin rebobinarlo, actualiza su ruta e inserta el trabajo. Un fallo del trabajo revierte también la actualización. La espera de bloqueo queda acotada a cinco segundos. La función solo admite al servidor con su identidad `service_role`; no se concede a usuarios web ni a anónimos. Se mantienen las comprobaciones de integridad, las reservas, la rotación y las diez copias.

Se corrige además la extracción del mensaje de error cuando Supabase devuelve un objeto. No se eliminan intentos fallidos para ocultar la incidencia ni se restauran o cambian datos contables.

Validación: coordinador real y formato fraccionado con datos ficticios; SQL aislado para permisos, preparación, reintento sin rebobinar, rechazo de una revisión distinta, estado terminado y reversión al fallar el trabajo. La comprobación final de una copia real debe quedar recogida en el registro privado de entrega, junto con el identificador y resultado del juego completo. No basta con que la interfaz diga «iniciada».


## Prueba real y corrección del transporte
La primera corrección atómica no bastó: el ensayo real siguió agotando el plazo, ahora al evaluar la preparación, antes de insertar el trabajo. El contexto de una sentencia interrumpida no demuestra por sí solo que la clave foránea fuera la causa. Se midieron 5.997.015 bytes de datos de la instantánea; su generación directa en Postgres terminó correctamente.

La continuación elimina el reenvío del bloque completo por REST. Postgres captura y conserva la instantánea directamente; el servidor la lee para validar el formato y devuelve únicamente el estado de preparación y metadatos pequeños. La base de datos no se vuelve a mandar como parámetro JSON. Una reserva identificada de tres minutos evita que dos ejecuciones preparen el mismo trabajo; si se pierde una respuesta, la captura se reutiliza al caducar la reserva, sin crear otra copia ni rebobinar progreso. La función de captura tiene el mismo acceso exclusivo del servidor. Se añaden pruebas de captura retenida, reservas concurrentes, recuperación de respuesta perdida y prohibición de reemplazar la base con metadatos.

La incidencia solo se cerrará tras completar y verificar el juego real. No confundir una batería simulada superada con una copia real guardada.

## Plazo de la captura en PostgREST
El ensayo del transporte nativo también alcanzó el plazo de PostgREST en `totus_backup_capture_snapshot`. Se confirmó que `service_role` no tiene un plazo propio y hereda los ocho segundos de `authenticator`. La generación nativa medida terminó en 1,3–1,8 segundos, pero la llamada completa incluye almacenar y devolver la instantánea; no es correcto equiparar ambos tiempos ni atribuir el fallo a una clave foránea únicamente por el contexto de la interrupción.

Se asigna un máximo de treinta segundos solo a la función de captura, mediante la configuración de función que PostgREST aplica antes de ejecutar la llamada. No se amplían los plazos del rol ni de los gastos y no se elimina la espera máxima de bloqueo de cinco segundos. Tampoco cambia quién puede ejecutar la captura, su reserva ni el contenido. Las pruebas comprueban esta configuración y vuelven a ejecutar permisos, concurrencia, reutilización de capturas y progreso. La aceptación sigue requiriendo una copia real completa y verificada.

Referencia: [Supabase · plazos por función y herencia de service_role](https://supabase.com/docs/guides/database/postgres/timeouts).
