# Automatizaciones y avisos

Automatizaciones es un módulo independiente de Sistema. Tiene tres pestañas: Reglas, Crear/configurar e Historial. Las consultas manuales guardadas siguen dentro de PrestaShop: no se pierden y no se presentan como tareas programadas.

## Configurar un aviso

1. Abre Crear/configurar y escribe un nombre reconocible.
2. Elige el tipo: un recordatorio de texto para cualquier necesidad o una consulta automática del catálogo disponible de PrestaShop.
3. Para PrestaShop, selecciona tiendas y parámetros. Los pedidos online requieren confirmar sus módulos de origen a partir de una muestra real; el medio de pago no identifica si son pedidos web.
4. Elige intervalo, hora diaria o días de la semana. Los horarios se interpretan en Madrid, incluidos cambios de hora.
5. Selecciona el canal de Chat y confirma que sus miembros pueden recibir la información. Prueba sin enviar y activa al guardar cuando corresponda.

La pestaña Reglas permite editar, duplicar como pausada, pausar/activar, comprobar ahora o retirar una regla. Historial muestra ejecuciones e incidencias. La salida de un formulario con cambios requiere confirmar su descarte.

## Permisos y ejecución

Los permisos de Automatizaciones son independientes. La migración conserva los permisos explícitos que antes administraban las reglas desde PrestaShop; los demás usuarios no reciben acceso nuevo por defecto. Las consultas de tiendas siguen necesitando acceso a PrestaShop y una conexión verificada. Cualquier envío requiere un responsable activo, permiso de Chat y pertenencia al canal.

Los recordatorios generales no consultan tiendas ni modelos de IA. Se ejecutan en el servidor con el ordenador apagado, usando el programador y el registro de entregas existentes. Un reintento no duplica el mismo aviso. No se activa ninguna regla real durante el despliegue.

## Límites de alcance

Un recordatorio envía el texto que se ha configurado: no interpreta ese texto como una instrucción ni ejecuta código. Los informes automáticos disponibles son los del catálogo de consultas implementado. Añadir acciones de otros módulos requiere un adaptador con sus permisos y pruebas; no basta con escribir una petición en el mensaje.

El cierre automático de POS TPV sigue necesitando su fuente de lectura verificada. Esta entrega no lo sustituye por sumas de pedidos ni interpreta `al_fin` como efectivo dejado.

Los nombres internos del servicio y de las tablas conservan la compatibilidad con las reglas y su historial previos. El parche 066 es necesario antes de publicar la nueva interfaz y el servicio de avisos.
