# Automatizaciones de PrestaShop

La pestaña sigue la estructura de Stitch: editor de reglas, reglas configuradas e historial de ejecuciones. Las consultas manuales anteriores se conservan plegadas debajo.

## Configuración desde la interfaz

Cada regla tiene nombre, tipo de consulta, tiendas, intervalo, días del informe, tramo horario aplicable a ventas por horas, umbral mínimo y canal de Chat. Se guarda pausada salvo que el usuario elija activarla. El destino debe ser un canal activo al que pertenezca el responsable; la interfaz exige confirmar que puede recibir esos datos.

Para pedidos online, «Analizar pedidos de muestra» muestra módulos de origen reales, pagos y ejemplos. El usuario selecciona los módulos de la web y deja fuera el TPV. El medio de pago no se utiliza para adivinar el origen. El primer aviso solo considera pedidos desde la activación.

Hay consultas de ventas y de catálogo: EAN, pesos, referencias, imágenes, duplicados, variantes, categorías y existencias. Los costes no verificados no se utilizan para calcular beneficio. Los cierres TPV no se simulan como sumas de pedidos.

## Ejecución y comprobación

«Probar sin enviar» consulta datos y muestra una previsualización sin escribir mensajes. «Comprobar ahora» pone una regla activa en la cola del servidor. Es posible editar, duplicar en pausa, pausar, reactivar y retirar reglas. El registro diferencia cola, ejecución, completada e incidencia con reintento.

El programador comprueba reglas vencidas cada minuto. Cada ejecución recibe un identificador y autorización de un solo uso, revalida los permisos actuales y respeta los límites de las conexiones. Las lecturas incompletas no avanzan la marca de última ejecución correcta. Los avisos enviados se registran de forma atómica para que los reintentos no dupliquen mensajes. Los informes usan una clave estable entre reintentos.

Las reglas no dependen del navegador ni llaman a una IA. El remitente de Chat es «Avisos de PrestaShop», sin suplantar al usuario ni a una IA. No se crean ni activan reglas reales al publicar.

## Despliegue y traslado

Aplicar primero 064 (si falta), después 065, desplegar totus-prestashop-alerts y actualizar totus-connections, y finalmente publicar la web. La función de avisos utiliza autorización propia por trabajo; las credenciales permanecen en el servidor.

Para trasladar el servicio deben conservarse también las tres tablas privadas totus_prestashop_automations, totus_prestashop_jobs y totus_prestashop_deliveries, además de Auth, permisos, canales, mensajes y conexiones. No basta con copiar los archivos de la web. La URL del programador debe apuntar al nuevo proyecto antes de activarlo; mantener solo un programador activo. Los secretos de conexión se trasladan por un canal privado y no se incluyen en el código.

## Alcance actual

El destino implementado es Chat de Totus. Correo, creación automática de tareas y PDF en Documentos necesitan sus acciones de servidor antes de ofrecerse como destinos. Los tipos de consulta soportados están definidos en el catálogo compartido y validados también en SQL; no se ejecuta SQL ni código escrito por el usuario. Una nueva clase de acción necesita implementación y pruebas, no una etiqueta ficticia en el formulario.
