# Venta con existencias insuficientes

Estado: implementada en la rama de trabajo, en validación aislada. Pendientes activación y aceptación remotas.

En Más acciones → Configuración → Ventas y existencias, una persona con permiso de venta puede activar «Permitir vender con existencias insuficientes» para su cuenta y caja. Por defecto está desactivado. Para poder elegir esos artículos también debe desactivar «Ocultar productos sin existencias»; el formulario explica la incompatibilidad antes de guardar.

Con la opción activa se pueden elegir artículos simples o variantes con stock cero o negativo y vender más unidades de las disponibles. El ticket muestra las existencias reales y avisa de la venta autorizada sin existencias. La opción afecta al mostrador; conserva la configuración de venta online del artículo. El pedido, el pago, la factura y los movimientos conservan sus verificaciones habituales. Las devoluciones con reposición suman exactamente las unidades devueltas.

La preferencia se guarda por cuenta, conexión, tienda y caja en la migración `20261117125500_totustpv_stock_policy.sql`. El servidor financiero la lee mediante una función reservada a `service_role`, con comprobación del permiso de venta. El navegador no puede enviar una autorización propia en el pedido. Si se desactiva después de calcular el cobro, el servidor exige calcularlo de nuevo antes de despachar la venta.

El conector comprueba la capacidad nativa `Cart::updateQty` y utiliza su parámetro explícito para el mostrador. La autorización queda ligada al resultado persistido del carrito propio, al presupuesto nativo de ese carrito y al intento de cobro. La venta vuelve a comprobar las cantidades bajo bloqueo y verifica el descuento y el movimiento de stock. No se modifica el núcleo de PrestaShop ni la política online `out_of_stock`. Un conector sin esa capacidad no habilita la excepción.

La validación incluye preferencia estrictamente booleana, aislamiento y permisos SQL, rechazo por defecto, rechazo del intento de inyección del navegador, cambio de preferencia entre cálculo y cobro, productos simples y variantes, stock cero y negativo, recuperación sin otro pedido, devolución y vistas de escritorio/móvil. Las pruebas de laboratorio utilizan productos ficticios y motores reales locales; no certifican todavía la activación remota.

La recuperación del carrito contrasta el comprobante de efecto persistido con la reclamación original, incluidas huella e identidades. Conserva la autorización aunque se interrumpa el cierre de respuesta del diario independiente. Se prueba una interrupción real del registro propio en el laboratorio, seguida de recuperación por GET, cobro y devolución sin repetir la creación del carrito; otras 17 aserciones SQLite rechazan comprobantes ajenos o alterados. Esto no cambia los esquemas nativos ni las políticas de venta online.
