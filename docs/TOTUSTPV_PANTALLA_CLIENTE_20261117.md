# Pantalla para el cliente · 17/11/2026

Ampliación de la entrega completa en desarrollo. Implementación verificada en laboratorio y pendiente de activación remota coordinada; no acredita un segundo monitor físico.

## Uso

En Más acciones → Configuración, habilita Pantalla para el cliente, elige si muestra precios y nombre, color principal y tamaño de letra de 14 a 40. Pulsa Guardar mostrador. Los ajustes se guardan para tu cuenta y caja y se recuperan en otro ordenador.

Con caja abierta, Más acciones → Pantalla para cliente abre otra ventana. Colócala en el segundo monitor y pulsa Pantalla completa. Si el navegador la bloquea, la aplicación indica que debes permitir sus ventanas emergentes y volver a intentarlo. Volver a pulsar la acción enfoca la ventana existente.

La pantalla acompaña los artículos y cantidades del ticket. Distingue la estimación del total verificado al preparar el cobro, explica el descuento de ticket calculado por la tienda y muestra el agradecimiento tras confirmar. Ocultar precios elimina los importes de líneas, descuento y total. El total permanece visible con tickets largos y la lista se desplaza por separado. El color ajusta automáticamente el texto del panel para conservar contraste.

El nombre está desactivado por defecto. Solo se muestra si está habilitado y la cuenta tiene permiso de consulta de Clientes en su sesión actual. Se retira al confirmar o si el resultado queda incierto. No se envían teléfonos, correos, direcciones, identificadores ni detalles de pago. Al salir, cambiar de cuenta, perder el acceso de la sesión actual, deshabilitar la opción o cerrar caja se borra y cierra la ventana. Si el mostrador deja de actualizarla durante diez segundos, la ventana elimina artículos, nombre e importe y queda en espera. El agradecimiento pasa a bienvenida tras quince segundos.

## Construcción

- `customer-display.js`: normaliza las cinco opciones, proyecta los datos mínimos, construye la ventana con nodos de texto y sincroniza el ticket. El HTML inicial es una constante, sin datos interpolados.
- `customer-display-watch.js`: ejecuta la limpieza por falta de actualización en la propia ventana y permite pantalla completa. No consulta autenticación, almacenamiento ni APIs.
- `customer-display.css`: distribución adaptable con lista desplazable y total visible.
- `workspace.js`: conecta el estado real del ticket, el permiso actual de cliente, las preferencias y el cierre del contexto.
- `20261117031559_totustpv_customer_display.sql`: añade la preferencia privada y conserva el RPC existente, limitado por `auth.uid()` y la asignación de caja. No concede acceso directo del navegador a la tabla privada.

No añade dependencias de ejecución, un servidor en el ordenador ni otro acceso de usuario. La ventana es de solo presentación y no registra operaciones en la tienda.

## Verificación

345 aserciones SQL aisladas, con tipos, límites de color/letra, persistencia parcial, conservación de otros ajustes y rechazo desde otra cuenta. Los 37 recorridos afectados desde el último commit verificado han pasado; después del ajuste final de contraste y documento estándar han pasado de nuevo las pruebas específicas de proyección, SQL y navegador. El bloque anterior ya había pasado 86 recorridos y las cuatro comprobaciones automáticas de GitHub.

Chromium a 1440/390 px: ventana real, proyección sin datos de contacto o pago, permiso de nombre, importes ocultos, texto escapado, contraste, cien líneas, importes grandes, total visible, caducidad de confirmación, desconexión/reconexión y cierre por pérdida de permiso. Integración con guardado de preferencias y actualización del ticket.

PrestaShop 8.2.8/PHP 8.2/MariaDB locales: la ventana muestra 8,01 € o 7,01 € calculados nativamente, según el ticket de escritorio/móvil, incluido el descuento general de 0,50 € del segundo; el nombre del cliente ficticio se muestra solo en el ticket identificado, desaparece al confirmar y la ventana se cierra al cerrar caja. Se conserva la recuperación de la respuesta perdida del cierre. Después se han repetido las pruebas específicas de ventana/proyección para comprobar la reapertura inmediata sin conservar el temporizador antiguo y los errores de bloqueo o falta de sesión. Estos ensayos no sustituyen la aceptación remota ni la comprobación en el monitor físico.
