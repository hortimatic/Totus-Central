# Activación QA · 16/11/2026

Diego autorizó: «continua, instala, si es necesario». Posteriormente confirmó el permiso concreto: «Sí, guardar esos permisos en preproducción» para la cuenta #2 TotusTPV.

Esta autorización sustituye únicamente la prohibición anterior de instalar el conector propio en preproduccion.hortimatic.com 8.2.8. Producción y módulos de terceros siguen fuera del alcance. Se conserva el control de estabilidad: la transición del invariante anterior queda identificada, con evidencia y la misma prueba de límites nativos; no se retiran recorridos ni consumidores.

## Verificado realmente

- Instalación propia 0.1.2 mediante el instalador nativo de PrestaShop.
- Permisos de la cuenta existente guardados y releídos. No se muestra ni cambia su clave.
- Se detectó un permiso histórico de recurso no disponible. El guardado inicial se revirtió. La corrección añade sólo permisos ausentes y conserva todas las filas anteriores, incluidas las de módulos retirados, y las asociaciones de tienda.
- Prueba nativa local: token inválido rechazado, permiso histórico conservado, repetición sin duplicados, sin exponer clave ni conceder POST al recurso clásico orders.
- Nueve migraciones aditivas del TPV aplicadas en Central; cero asignaciones inicialmente. El servicio nuevo totus-tpv v1 está activo con validación JWT. Sus 29 archivos se han releído y comparado con el paquete enviado.
- No se han sustituido los servicios existentes de Central. No se han creado ventas remotas durante la instalación ni borrado pedidos.

## Todavía pendiente

Publicar la interfaz actual, configurar el puesto mediante la sesión normal de Central y realizar la aceptación remota completa. Las pruebas nativas locales no acreditan todavía ese recorrido remoto.

La lista real de pedidos de preproducción muestra 46.504 registros; la apertura inicial superó 24 segundos. La tabla de pedidos ocupa aproximadamente 36,22 MiB con índices. Esto no demuestra que deba borrarse el historial. Continúa el diagnóstico de consultas e índices, sin modificar pedidos, documentos ni stock.

## Lectura de pedidos

El plan real empezaba por direcciones y usaba tabla temporal y filesort antes de limitar los pedidos. Con idioma español y tienda 1, el diagnóstico de sólo lectura de esa consulta superó el límite de 5 segundos. Una consulta equivalente que empieza por pedidos recientes y sustituye la comprobación COUNT por EXISTS examinó diez pedidos; ANALYZE registró 0,135 ms de ejecución y 0,221 ms de optimización. Son tiempos SQL de esa consulta, no de toda la pantalla ni una medición bajo carga.

El conector incorpora un hook nativo para la lista sin filtros y orden por ID descendente. Conserva el contador, parámetros, columnas añadidas por otros módulos, límite y desplazamiento. Cualquier filtro real u otra ordenación conserva la consulta anterior. Se reconocen las fechas vacías anidadas que envía el formulario nativo. No modifica núcleo, índices, parámetros globales, estados, stock ni datos históricos. Una meta de diagnóstico del administrador muestra únicamente un código fijo del plan aplicado, sin datos del cliente ni SQL.

La prueba nativa compara todas las filas y campos de tres páginas, indicador de cliente nuevo, parámetros y contador, y verifica que filtros de pago/fecha/cliente nuevo y otras ordenaciones no cambian. También compara una proyección personalizada y los campos de fecha vacíos.
