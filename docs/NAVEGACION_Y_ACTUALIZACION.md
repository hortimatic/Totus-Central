# Módulos en paralelo y datos actualizados

El menú conserva su aspecto. Sus entradas son enlaces a módulos concretos: botón derecho → abrir en otra pestaña, Ctrl+clic en Windows o Cmd+clic en Mac. En móvil se puede mantener pulsado el enlace y utilizar la opción del navegador. La pestaña nueva comprueba su sesión y permisos normales y entra en el módulo indicado. La dirección contiene únicamente el nombre del módulo, nunca credenciales ni datos del formulario.

Al pulsar normalmente un módulo, se consultan de nuevo sus datos antes de dibujarlo. No se vuelve a descargar todo el arranque por defecto: Cajas consulta cierres y cajones, Pricing sus referencias y precios, Gastos sus registros y justificantes, etc., junto con permisos y referencias comunes. Administración conserva su conjunto completo. Chat, Tareas y Recepciones mantienen además sus consultas propias.

Durante la actualización se muestra su estado y no se abre un formulario que pueda ser sustituido por una respuesta tardía. Los filtros y la vista seleccionada de cada módulo se conservan durante la sesión. Salir de una ficha con cambios pide confirmación; cancelar conserva los campos y archivos. Abrir otra pestaña no abandona el formulario actual. Una pestaña que ya tenga abierta una ficha no se sobrescribe automáticamente por cambios de otra pestaña: al guardar se mantiene el control de versión existente.

Si falla la actualización, no se muestran datos antiguos como si fueran nuevos: se ofrece Volver a intentar. Cambiar rápidamente de módulo descarta la finalización anterior; cambiar de sesión mantiene el aislamiento de las lecturas. Se conserva la identidad Auth al actualizar la ficha del equipo. Las notificaciones y los vínculos entre Chat y Tareas utilizan el mismo recorrido de navegación.

Pruebas: `module-navigation-qa.mjs`, `module-navigation-browser-qa.mjs`, `api-integrity-qa.mjs`, `stale-form-browser-qa.mjs`, `user-permissions-browser-qa.mjs`, `header-tools-browser-qa.mjs` y `backup-schedule-layout-qa.mjs`. La prueba de navegador nueva usa únicamente datos ficticios e incluye PC/móvil, enlaces independientes, datos modificados fuera de la vista, filtros, respuesta tardía, error/reintento y cancelación de un cierre pendiente.

No modifica SQL, permisos, facturas, cajas o documentos en producción. Este ajuste no acredita por sí solo una auditoría total de los demás módulos.
