# Estabilización de Totus Central · 31/10/2026

## Alcance y hallazgos comprobados
- Producción de partida: a8eb61d4, una sola rama totus-central; ninguna revisión abierta al comenzar. Las migraciones y auditorías históricas son historial reproducible, no entornos activos; no se borran para aparentar limpieza.
- Copias: programación diaria 00:35 Europe/Madrid activada, diez juegos completos conservados, tareas de servidor activas. La copia automática del 30/10 a las 00:35 terminó; la del 31/10 arrancó pero falló al perder una referencia del lote. La copia manual del 31/10 a las 10:39 Madrid terminó y fue verificada: 499 originales, 6.937 registros, veinte componentes/índice en OneDrive. No se confunde una programación activada con una copia guardada.
- La copia fraccionada consultaba referencias vivas mientras leía un inventario capturado. La sustitución o eliminación simultánea podía retirar una referencia aún necesaria. Nueva protección transaccional: captura y cambios de identidad de originales usan la misma reserva; mientras el juego está en curso, las referencias incluidas no se pueden reemplazar/eliminar. Se permiten documentos nuevos, notas, lectura y trabajo contable ordinario. La protección se libera cuando el intento termina o falla. Se conservan permisos, plazos, contenido y diez copias.
- El atributo HTML hidden de campos semanales/mensuales podía quedar anulado por display:grid de .field. Se respeta hidden, se alinea el formulario y se prueba la programación diaria/semanal/mensual en seis tamaños.
- Conexión ChatGPT: contrato versión 3 y sesión Auth propia comprobados en producción el 31/10. Manual de Gastos aún indicaba versión 2; se corrige. INICIO_CHATGPT_ACTUAL es la entrada vigente para fuentes y manuales. No es un puente universal ni elimina aprobaciones de OpenAI/conectores.

## Comprobaciones y entrega
Las pruebas SQL nuevas utilizan únicamente una base desechable: rechazan borrar/sustituir documentos y logos de una copia activa, permiten metadatos y documentos nuevos, conservan límites/privilegios y liberan al finalizar. Las pruebas de navegador ejercitan la aplicación real con datos ficticios. Se conservan las verificaciones existentes de los demás módulos en CI.

No se han restaurado copias en producción, alterado cifras fiscales o eliminado documentación financiera para probar o limpiar. No se incorporan servicios de pago, sincronizadores ni tareas locales permanentes. La contraseña del asistente permanece en Vault; no forma parte de fuentes ni del paquete de entrega.

Para mantenimiento: consultar INICIO_CHATGPT_ACTUAL, contrato del servidor y versión publicada; no reinstalar todos los parches históricos. El paquete de fuentes debe corresponder a un commit completo publicado y conservar este informe junto con código, pruebas y manuales. Los resultados finales del despliegue y el ensayo de copia se registran en la entrega privada de OneDrive.
