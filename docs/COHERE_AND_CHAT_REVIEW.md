# Cohere y destinatarios de Chat — revisión 02/11/2026

El HTTP 422 se reprodujo con la petición real y Cohere devolvió `HALLUCINATED_ALL_TOOL_CALLS`: rechazaba llamadas generadas que no correspondían al contrato de herramientas. No era una denegación de Supabase. La misma petición respondió 200 al activar `strict` en las funciones y `reasoning_effort: none` en el adaptador compatible oficial. El ajuste solo se aplica a Cohere; conserva proveedor, usuario y presupuesto de salida. La verificación de nuevas conexiones utiliza el mismo modo.

Si Cohere vuelve a rechazar una generación con ese código preciso, el motor admite una sola reparación antes de ejecutar sus llamadas. No reintenta cualquier 422, cuotas ni escrituras inciertas. El diagnóstico utiliza una categoría fija, sin copiar documentos ni claves.

El chat obtiene las identidades desde las cuentas y conexiones registradas. En una conversación directa de API, Enviar indica el nombre real y solicita trabajo a ese destinatario. Se retiraron los dos botones globales que mezclaban la conversación abierta con ChatGPT o la antigua etiqueta Totus IA. La preparación para ChatGPT convencional es manual y explica dónde permanece el mensaje; utiliza el puente autenticado vigente y no crea solicitudes aparentes de ejecución automática.

Las herramientas de redacción quedan visibles en una barra compacta. El botón Avisos de la lista se retira; se conservan sus ajustes y el filtro de mensajes sin leer. En Ajustes de Chat → Fondo, sonido y avisos, la opción de fondo exterior permite ocultar la tarjeta blanca manteniendo la burbuja del texto. La preferencia se guarda por usuario.

La flecha de navegación utiliza un único SVG centrado, conservado también al aplicar preferencias de interfaz. El selector de documentos mantiene el mismo alto y línea de base que el tipo de documento.

Pruebas: rechazo real del proveedor y repetición con esquema estricto; pruebas de transporte y generación; aislamiento de destinatarios y preparación manual; controles compactos y editor en seis tamaños; alineación del glifo y carga de documentos; persistencia y validación de la preferencia de fondo. Un ping, acceso o respuesta 200 no acredita por sí solo un cotejo completo: la entrega debe registrar aparte su prueba de guardado y relectura.
