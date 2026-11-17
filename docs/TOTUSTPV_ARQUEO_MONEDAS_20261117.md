# Billetes, monedas y recuento de efectivo

17/11/2026. Implementado en la rama y verificado en laboratorio. No activado en la interfaz publicada ni en la base remota.

## Uso

En **Más acciones → Configuración → Efectivo · billetes y monedas** se eligen los valores utilizados por la cuenta en esa caja. Se incluyen todos los valores de referencia, desde 500 € hasta 0,01 €. El selector conserva el componente buscable común y el orden de mayor a menor. La selección vacía muestra un error corregible, sin bloquear el formulario ni perder las demás preferencias.

**Contar billetes y monedas** está disponible al introducir el fondo inicial, el efectivo entregado y el arqueo de cierre. Cada cantidad se multiplica por su valor en céntimos enteros. El total se aplica al importe del formulario; los detalles de unidades son una ayuda de introducción y el registro del cierre conserva el importe total. El importe también se puede introducir directamente. Al editarlo manualmente o utilizar un importe rápido se limpia el desglose anterior.

El cobro sigue mostrando el cambio correspondiente al cálculo verificado del ticket. Los valores rápidos usan los billetes configurados. Si se elige tarjeta, el contador de efectivo se oculta y desactiva, para que un dato inválido de efectivo no bloquee otro medio de cobro. Volver a efectivo restaura su validación. No registra un pago externo por introducir cantidades.

Las cantidades se conservan en la vista si se pierde la respuesta del cierre. El adaptador conserva el identificador de ese cierre y consulta la misma operación después de desaparecer la sesión abierta. Una ficha de producto con cambios sin guardar también impide cerrar o reconfigurar la caja sin atenderla.

## Construcción

`src/totustpv/cash-counting.js` contiene valores del euro, normalización de preferencias, suma entera, controles y validación del formulario. `workspace.js` lo integra en apertura, cobro, cierre y configuración; la presentación utiliza los estilos comunes. Se ha corregido además el formulario de movimientos en móvil, donde los tres campos podían comprimirse junto al encabezado.

`20261117093928_totustpv_cash_counting.sql`, creada con la CLI, añade únicamente preferencias de presentación a la tabla privada existente. Conserva el RPC restringido de cuenta/puesto y sus comprobaciones de `auth.uid()`, asignación y permisos. Rechaza valores ajenos al euro, repeticiones, tipos incorrectos y claves arbitrarias. Mantiene todas las opciones anteriores de mostrador, justificante y pantalla de cliente. No amplía los permisos de gestión de efectivo ni cambia la transacción de cierre.

## Comprobación

- Tres pruebas unitarias de importes exactos, límites, denominaciones, formularios y escape de valores retenidos.
- 408 aserciones SQL aisladas; incluyen valores predeterminados, guardado parcial, conservación de preferencias y rechazo de configuraciones inválidas.
- Navegador sintético a 1440 y 390 px: selección vacía, guardado, cálculo de entregado y cambio, cantidades no enteras, cambio a tarjeta, importe exacto, cierre y conservación de cantidades tras respuesta perdida.
- 43 recorridos de regresión afectados desde 1560eec5, aprobados. La expectativa del formulario anterior se amplía con la nueva preferencia sin retirar sus comprobaciones previas.
- `node tests/totustpv-native-http-qa.mjs --cash-counting-only`: navegador/adaptador/handler, RPC y PostgreSQL reales aislados, después de una venta nativa PrestaShop de 8,01 €. Guarda los valores elegidos, cuenta 108,01 € sobre un fondo de 100 €, cierra y recupera la respuesta perdida con el mismo identificador. La fila SQL queda cerrada una vez, por el operador original y por el importe contado. Prueba móvil y escritorio; autenticación y entrega a loopback son fixtures.

CFG-03-05 queda implementado y comprobado de forma aislada, pendiente de activación/aceptación remota. No se certifica dinero físico, cajón, impresora ni el resto de configuraciones de Caja. Quedan cinco migraciones nuevas pendientes de aplicación remota.
