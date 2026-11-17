# Gestión de establecimientos y cajas desde TotusTPV

17/11/2026. Ampliación de rama; no publicada.

La preparación de un puesto ofrece «Crear y gestionar cajas» a los administradores con acceso a Administración. Abre en otra pestaña la sección existente «Negocio y cajas», en lugar de crear otro registro de establecimientos o cajas. La pestaña original mantiene su formulario y su ticket.

La dirección admite únicamente secciones conocidas de Administración. El acceso directo llega a Negocio y cajas después de recargar y mantiene las comprobaciones habituales de usuario y permisos. Cambiar de sección actualiza la dirección; cambiar de módulo elimina el contexto de Administración. No se trasladan parámetros ajenos ni credenciales al enlace.

Al regresar, «Actualizar tiendas y cajas» consulta la configuración existente y conserva los datos del formulario, sin asignar puestos. Un fallo de consulta conserva la preparación. Si ha cambiado la conexión o su revisión, se exige cancelar y preparar de nuevo, evitando reutilizar una solicitud con otro destino. La creación y edición siguen siendo las de Central y requieren sus permisos normales.

La actualización no sustituye la revisión de los accesos por persona y caja. Una caja nueva necesita asignación antes de que su operador pueda usarla. El listado de asignación incluye cajas activas.

Validación: 82 recorridos iniciales aprobados; se corrigió la reapertura del panel en una prueba y aprobaron sus 14 recorridos restantes, además de creación/edición/desactivación de cajas y protección de formularios: 98 recorridos distintos. Ocho comprobaciones del protocolo de estabilidad también aprueban. La navegación directa se prueba después de recargar; el TPV verifica enlace separado, actualización sin escrituras, campos conservados y fallo de consulta en 390 y 1440 píxeles. Las pruebas de interfaz usan datos ficticios; no acreditan una escritura remota. No se ha añadido ninguna migración.
