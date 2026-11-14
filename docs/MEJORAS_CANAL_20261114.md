# Contraste del canal Mejoras TotusCentral — 14/11/2026

Canal caa5ce90-ba1b-41c9-bf05-b0666991ae87. Lectura con la cuenta propia Codex autorizada por Diego; sin ampliar otros permisos.

## Bloque de estabilidad de esta rama
- Fuente de producción e41554e contrastada con conexiones v45, asistente v17, IA v25 y avisos v8. Se recuperan fuentes y dos migraciones ya aplicadas que estaban en otra rama. No se activa la interfaz de Hortimatic 8 ni se vuelve a ejecutar su migración.
- Seleccionar campos o terminar una copia verificada deja de generar un falso aviso de guardado. Ediciones reales y publicaciones en curso siguen protegidas.
- Movimientos nativos en Productos > Producto: resolución por id_stock, cantidad con signo, empleado original, pedido, referencia de combinación, periodo y tabla configurable. Lectura paginada por producto, sin consultar toda la tienda. El almacén avanzado se identifica como no cubierto; no se atribuyen sus movimientos por suposición.
- Distribución de movimientos propia por usuario; no comparte ni sobrescribe preferencias ajenas.
- Control de contratos públicos, mapa de consumidores y comprobación del paquete activo antes de sustituir un servicio.
- Pages usa un artefacto único por intento y espera su disponibilidad; evita repetir la avería del despliegue #195.
- Aviso de nueva versión al recuperar foco o cambiar módulo; nunca recarga automáticamente una ficha abierta.

## Peticiones anteriores: alcance comprobado, sin fingir cierre
- APIs fuera de Configuración: ya existente.
- Interfaz/arranque/rendimiento: existen estilos tempranos y recorridos de arranque; esta rama añade aviso de versión y conserva cambios previos. No se acredita que toda consulta externa sea instantánea.
- Margen y medios de pago: recorridos de ventas pasan con datos simulados. Caja y vendedor por POSTPV no quedan resueltos por leer empleados o movimientos de existencias; el acceso de servicio de #181 sigue pendiente.
- Documentos: selección/subida/error/relectura pasan en fixture. Organización y eliminación de duplicados requieren inventario y comprobación de vínculos; esta rama no elimina originales ni historial.
- Ficha personal: perfil/notas/documentos/tareas y aislamiento por usuario pasan los recorridos existentes. La libreta y las tareas no equivalen todavía a un circuito automático de pedidos de clientes.
- Chat: conservación de borradores, citas, invitaciones y respuestas tardías pasan las pruebas existentes. La solicitud de Davina (pedido de cliente leído del chat y aviso al completar stock) sigue siendo una funcionalidad pendiente, no queda cubierta por una tarea o por avisos de pedidos web.
- Atributos/características: creación/asignación y separación por tienda pasan los recorridos existentes; no se renumeran IDs entre tiendas.
- Gastos recurrentes y avisos web: existen circuitos y permisos independientes; sus pruebas pasan. No se activa una regla ni se eligen destinatarios por suposición.

## Evidencia
Pruebas locales: acceso, creación, edición, copia con fotos/combinaciones y reintentos, relaciones/atributos, ventas/pagos, recepciones sin IA, directorios, cierres, escritura de gastos, chat, automatizaciones, Inicio, cuenta, apariencia, documentos y copias de seguridad. Son simulaciones salvo que el informe indique expresamente PrestaShop aislado o lectura real. Movimientos probados a 390/969/1920 px; preferencias probadas en Postgres aislado con rechazo de usuario sin permiso.

Publicación y lectura real: pendientes al redactar esta revisión. Actualizar este apartado solo tras verificar sus resultados.
