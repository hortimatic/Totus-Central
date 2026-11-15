# Avance de la consulta de margen

La versión 65a7d674 se verificó en una sesión real: la tarjeta de Inicio completó el margen mensual y su porcentaje, conservando los importes contables. No se realizaron escrituras comerciales. La lectura mensual tardó perceptiblemente sin mostrar progreso; esta corrección hace visible cada fase y desactiva el reintento mientras la consulta está en curso.

El avance se mantiene por tienda y periodo, se descarta al cambiar de cuenta o abandonar Inicio y no sustituye cifras anteriores por ceros. Los errores identifican su tienda y permiten reintentar. La información de progreso actualiza únicamente la tarjeta compacta; no vuelve a dibujar todos los gráficos en cada lote. Conserva consultas compartidas y límites de concurrencia.

Pruebas locales: lógica de margen con pérdidas, parcialidad, porcentaje ponderado, mensajes escapados y carga/error; prueba de navegador con respuesta retenida, botón bloqueado, liberación y resultado; integración en diez tamaños y conservación del informe contable. Adaptadores ficticios. Pendiente de controles remotos y publicación de esta corrección.
