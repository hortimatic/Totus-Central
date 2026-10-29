# Preparación de copias por componentes · 29/10/2026

Al comprobar la carga de metadatos durante la revisión de Chat se detectó un fallo real de la copia nocturna de las 00:35. Las diez copias anteriores se conservaban. Los reintentos manuales también fallaban antes de preparar componentes y almacenaban el texto poco útil `[object Object]`.

La consulta del registro real confirmó un agotamiento de tiempo de sentencia (57014) en la comprobación de la clave foránea de `ops_backup_work` contra `ops_backup_runs`. No se detectaron originales ausentes en documentos, adjuntos listos ni logos. La preparación anterior actualizaba el registro y después insertaba el trabajo en dos peticiones independientes.

La corrección guarda la preparación en una sola transacción mediante `totus_backup_prepare_work`: bloquea el registro, valida que sigue en curso, conserva un trabajo existente compatible sin rebobinarlo, actualiza su ruta e inserta el trabajo. Un fallo del trabajo revierte también la actualización. La espera de bloqueo queda acotada a cinco segundos. La función solo admite al servidor con su identidad `service_role`; no se concede a usuarios web ni a anónimos. Se mantienen las comprobaciones de integridad, las reservas, la rotación y las diez copias.

Se corrige además la extracción del mensaje de error cuando Supabase devuelve un objeto. No se eliminan intentos fallidos para ocultar la incidencia ni se restauran o cambian datos contables.

Validación: coordinador real y formato fraccionado con datos ficticios; SQL aislado para permisos, preparación, reintento sin rebobinar, rechazo de una revisión distinta, estado terminado y reversión al fallar el trabajo. La comprobación final de una copia real debe quedar recogida en el registro privado de entrega, junto con el identificador y resultado del juego completo. No basta con que la interfaz diga «iniciada».
