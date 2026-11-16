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

La interfaz 73d54699 ya está publicada y abierta con la sesión normal de Central. Muestra la configuración integrada del puesto. Queda configurar la asignación y realizar la aceptación remota completa. Las pruebas nativas locales no acreditan todavía ese recorrido remoto.

La lista real de pedidos de preproducción muestra 46.504 registros; la apertura inicial superó 24 segundos. La tabla de pedidos ocupa aproximadamente 36,22 MiB con índices. Esto no demuestra que deba borrarse el historial. Continúa el diagnóstico de consultas e índices, sin modificar pedidos, documentos ni stock.

## Lectura de pedidos

El plan real empezaba por direcciones y usaba tabla temporal y filesort antes de limitar los pedidos. Con idioma español y tienda 1, el diagnóstico de sólo lectura de esa consulta superó el límite de 5 segundos. Una consulta equivalente que empieza por pedidos recientes y sustituye la comprobación COUNT por EXISTS examinó diez pedidos; ANALYZE registró 0,135 ms de ejecución y 0,221 ms de optimización. Son tiempos SQL de esa consulta, no de toda la pantalla ni una medición bajo carga.

El conector incorpora un hook nativo para la lista sin filtros y orden por ID descendente. Conserva el contador, parámetros, columnas añadidas por otros módulos, límite y desplazamiento. Cualquier filtro real u otra ordenación conserva la consulta anterior. Se reconocen las fechas vacías anidadas que envía el formulario nativo. No modifica núcleo, índices, parámetros globales, estados, stock ni datos históricos. Una meta de diagnóstico del administrador muestra únicamente un código fijo del plan aplicado, sin datos del cliente ni SQL.

La prueba nativa compara todas las filas y campos de tres páginas, indicador de cliente nuevo, parámetros y contador, y verifica que filtros de pago/fecha/cliente nuevo y otras ordenaciones no cambian. También compara una proyección personalizada y los campos de fecha vacíos.

Activación real: versión 0.1.6, SHA256 del paquete `9b465dfe9a0fa9ab5822080439f6c753125b8cf39f7024da686c8f70e14dd19a`. Se reconoció la marca guardada `ajax_filter=1` y la ordenación nativa en minúsculas. La meta del administrador confirmó `recent_orders_and_exists`. El documento pasó a estar disponible en aproximadamente 3,1 segundos frente a la apertura inicial superior a 24 segundos. Búsqueda real del pedido 46542: un resultado; restablecimiento: 46.504 pedidos. No se realizó ninguna escritura de comercio.

## Independencia del ordenador y limpieza

La aplicación se sirve desde Totus Central y su servicio autenticado; el conector reside en la web QA. No utiliza el laboratorio local, puertos localhost, una base de datos de este ordenador ni un servicio de IA para ejecutar ventas. La impresora USB es un periférico del puesto; la apertura directa del cajón sigue pendiente y no se ha instalado un agente local.

Se detuvo la MariaDB desechable verificando la ruta de su ejecutable. Se retiraron 25 ramas remotas con PR fusionado y SHA coincidente y 23 ramas locales equivalentes, excluyendo los árboles de trabajo asociados y cualquier trabajo sin integración demostrada. La primera limpieza atómica se canceló sin borrar nada al detectar una referencia remota ya retirada; se releyeron todas las referencias antes del lote definitivo.

Se han eliminado los binarios, bases ficticias, paquetes generados y dependencias del laboratorio. También se eliminó el clon del prototipo separado, comprobando antes que su fuente estaba conservada en GitHub y que no tenía servicio local activo. Tras integrar el PR 211 se retiró su rama remota: total 26 ramas remotas y 23 locales retiradas. Las pruebas y fuentes permanecen versionadas; las capturas de aceptación se conservan como evidencia, sin ser dependencias de ejecución.
