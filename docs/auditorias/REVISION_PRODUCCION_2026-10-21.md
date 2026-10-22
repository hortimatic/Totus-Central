# Informe técnico de revisión · Totus Central
Actualizado: 22/10/2026. Este documento público describe código y comprobaciones; el inventario y el detalle de la instalación quedan en su registro privado de administración.

## Producción única
La aplicación anteriormente denominada staging es ahora Totus Central, publicada en https://hortimatic.github.io/Totus-Central/. Su propia rama se renombró `totus-central` y es la predeterminada. No se fusionó sobre la implementación obsoleta de main.

La aplicación conserva estructura, pantallas y datos existentes. La dirección /staging/ solo redirige a la raíz y conserva parámetros y fragmentos de enlaces antiguos. El código de publicación no genera una segunda aplicación.

La rama main, el proyecto antiguo de datos, los dos auxiliares sin uso y el entorno Preview se retiraron después de las comprobaciones y confirmaciones correspondientes. Se conservan el proyecto de producción, sus cuatro funciones de servicio y la carpeta de aplicación de OneDrive.

## Correcciones revisadas
- Evitar retirar un archivo todavía usado por un pago de impuestos, incluso cuando una ficha antigua no guarda el vínculo inverso.
- Escapar el número del documento en el título de impresión.
- Mantener filas y columnas del Excel detallado y añadir subtotales que distinguen gastos, control interno y apuntes de pago.
- Impedir que una contraseña opcional inválida guarde primero cambios de ficha; indicar al navegador el tratamiento correcto del autocompletado.
- Unificar nombres visibles sin cambiar roles ni permisos.

Las correcciones se comunicaron antes de aplicarse. No se modificaron importes contables ni la organización de la herramienta.

## Evidencia de código y publicación
La versión operativa `5395afee` superó [la batería completa y la publicación](https://github.com/hortimatic/Totus-Central/actions/runs/39754971994). La [transición inicial](https://github.com/hortimatic/Totus-Central/actions/runs/39750756887) también superó ambas fases.

Las pruebas cubren cálculos, permisos, cierres, gastos, facturación, rectificativas, filtros, periodos, libros e informes, PDF y logos, adjuntos, conexión documental, copias y recuperación, borradores, formularios, navegación y geometría de escritorio y móvil. Se ejecutan con datos aislados en GitHub Actions.

La regresión de usuarios ejecuta la función real: una contraseña inválida produce cero escrituras; guardar solo el nombre no invoca mantenimiento de credenciales. La publicación comprueba el commit servido y mantiene la batería como requisito.

## Comprobaciones operativas
Se comprobó el acceso autenticado, las aperturas por cajón, tarjeta y retiradas visibles, los estados de cierres, el original de un gasto en su visor, los informes con varios meses, el control interno separado de fiscalidad y el formulario corregido.

Se probaron escritura, relectura y traslado reversible de un archivo sintético en el proveedor documental. Se creó una copia desde la propia interfaz y se verificaron lectura íntegra, huella y ensayo de recuperación en tablas temporales, sin restaurar sobre la contabilidad activa. Los resultados particulares y el inventario se conservan de forma privada.

Las actualizaciones de manuales conservan nombres estables y verifican el contenido antes de retirar versiones antiguas.

## Operación y mantenimiento
Consultar [el manual](../MANUAL_CHATGPT_ONLINE.md) y [la entrada de continuidad](../../RELEVO_CHATGPT_ONLINE.md). Los originales y respaldos son privados. No publicar documentos fiscales, inventarios de la instalación, identificadores de cuentas o credenciales en este repositorio.

Las copias de aplicación permiten recuperar datos en el mismo proyecto; la reconstrucción de una infraestructura nueva, sus identidades y sus credenciales es otro procedimiento. Revisar los avisos reales de capacidad y el mantenimiento de conexiones antes de alcanzar sus límites.

Las sesiones del escritorio no se heredan automáticamente a un servicio online; este debe contar con acceso autorizado. La programación del servidor funciona sin un ordenador encendido.

Los cambios complejos futuros se prepararán en un nuevo entorno aislado basado en la producción vigente cuando el titular lo solicite. La comercialización futura no forma parte de esta revisión. Conservar migraciones y trazabilidad de esta misma aplicación.

Las pruebas acreditan los casos comprobados y no constituyen una garantía de ausencia absoluta de incidencias futuras.
