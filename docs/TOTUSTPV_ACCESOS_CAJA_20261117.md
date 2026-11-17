# Accesos a cajas · 17/11/2026

Ampliación de la entrega completa en desarrollo. No constituye publicación ni cierre de las configuraciones solicitadas.

## Uso

Desde Configuración → Puestos y operadores, el responsable consulta los accesos ya asignados y pulsa Cambiar acceso. Puede permitir venta o solo consulta, habilitar por separado la gestión del efectivo y desactivar o reactivar el acceso. La desactivación conserva pedidos, movimientos e historial y no cierra una caja abierta. Los permisos generales de Central siguen aplicándose.

La consulta permite localizar pedidos y recuperar documentos de la tienda aunque no haya una caja abierta. Registrar una devolución sigue requiriendo caja abierta y permiso de venta. Abrir, registrar entradas o retiradas y cerrar requiere el permiso de gestión de caja. El responsable puede asignar estos permisos desde el primer alta del puesto.

## Construcción y límites

La asignación existente continúa siendo la autoridad. La nueva migración añade revisión de acceso, control de concurrencia y un diario privado de cambios. El servidor comprueba la identidad autenticada, el permiso de administración y la conexión QA vigente antes de usar las funciones privilegiadas. El navegador no recibe secretos ni acceso directo al diario. No se crean tiendas, usuarios o cajas paralelos.

Un cambio identifica su solicitud y revisión previa. Reintentar la misma solicitud devuelve el resultado original; cambiar su contenido o sobrescribir una revisión posterior se rechaza. Las actualizaciones del flujo anterior también incrementan la revisión. Editar los accesos no llama a PrestaShop ni registra operaciones de dinero. Cuando el responsable cambia su propio acceso, se abandona el contexto local del mostrador para recuperarlo con los permisos actuales; la caja no se cierra.

La administración se limita expresamente al circuito QA autorizado. No sustituye todavía todas las políticas por empleado/tienda ni contraseñas y demás configuraciones de las capturas. La tabla de requisitos permanece abierta.

## Verificación aislada

- 327 aserciones en PostgreSQL PGlite: permisos, revisión, solicitudes repetidas, denegación de escrituras, registro de cambios, lectura sin sesión y aislamiento de tienda/moneda.
- Pruebas del controlador HTTP y lector de configuración: identidad real, gestor autorizado, revisión vigente, entradas malformadas, proyección de campos y cambio de cuenta.
- Chromium a 1440 y 390 px: consulta, venta y gestión de caja por separado; historial y documento con caja cerrada; administración con pérdida de respuesta y reintento idéntico; desactivación, recarga y ausencia de avisos falsos de cambios pendientes.
- Regresión del mostrador compartido aprobada en cuatro tamaños.

Los adaptadores de las pruebas de interfaz son ficticios; la denegación real se prueba por separado en SQL y servidor. El laboratorio nativo integrado ha pasado en escritorio y móvil, incluidos cierre con respuesta perdida y reintento idéntico después de desaparecer la sesión abierta del contexto, sin otro cierre ni movimiento. SQL sigue rechazando escrituras nuevas sobre una caja cerrada. El control completo de estabilidad ha superado los 86 recorridos afectados. Una corrección visual posterior aplica el estilo común a los campos de administración de la entrada; han pasado de nuevo administración, preparación e integración en Central. También se ha comprobado que cambiar el propio acceso elimina el contexto antiguo aunque falle la recarga de la lista.

Migración y servicio aún no aplicados remotamente en esta ampliación. No acredita hardware físico.
