# Recuperar una edición con respuesta incierta

Ámbito: actualizar campos de un producto o combinación existente. No crea productos, fotos ni existencias. El alta base y sus etapas conservan sus propios protocolos.

1. Conservar la cuenta propia, tienda, conexión, revisión, recurso, ID, cambios e identificador de solicitud originales. No sustituir el UUID ni borrar el diario.
2. Consultar el registro real. Si ya contiene los valores solicitados, repetir la solicitud original: se concilia por lectura sin otro PUT.
3. Si faltan cambios, usar «Revisar recuperación». Vuelve a preparar exactamente los cambios originales contra la ficha actual. Mostrar diferencias; esta revisión no escribe.
4. Tras revisar, guardar de nuevo. En API: `prestashop_product_prepare` con recurso/ID/cambios originales; luego `prestashop_product_commit` conservando `request_id`, cambios e identidad, con la nueva `expected_fingerprint`, `confirmed:true` y `recover_unchanged:true`. En combinaciones conservar además `expected_product_id`. La interfaz vuelve a pedir GUARDAR en la ficha.
5. El servicio comprueba dos lecturas iguales, la huella revisada y la misma intención. Solo una solicitud incierta de más de dos minutos puede reclamar el reintento de forma exclusiva. Una pendiente puede seguir en curso; no se reenvía. Una completada nunca se reactiva.
6. El guardado exige relectura exacta. Un error conserva el estado incierto y su UUID. El diario añade fecha de recuperación y huella; conserva la identidad y el historial. No consultar claves ni modificar manualmente el diario.

Pruebas: pérdida de respuesta antes del PUT, conciliación posterior, reintento único, mismo UUID, rechazo de cambios concurrentes y de otra identidad; fila de tabla en móvil/tableta/escritorio. La base de datos y PrestaShop aislados verifican el recorrido sin datos de negocio. La prueba real de ChatGPT se registra aparte y solo se da por terminada tras restaurar el campo original.
