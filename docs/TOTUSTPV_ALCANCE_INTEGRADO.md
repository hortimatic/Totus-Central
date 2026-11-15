# TotusTPV: alcance integrado

Actualizado: 15/11/2026. Requisitos acordados; esta matriz no certifica funcionalidades implementadas.

TotusTPV pertenece a Totus Central. Reutiliza su sesión, permisos, conexiones de tiendas, navegación, componentes y configuración. No es una aplicación independiente ni requiere POSTPV instalado. Cada operación identifica cuenta, conexión PrestaShop, tienda nativa, usuario, puesto y sesión de caja; los identificadores de diferentes instalaciones nunca son intercambiables.

## Responsabilidades

PrestaShop conserva los pedidos y sus identificadores nativos, productos, combinaciones, clientes y existencias correspondientes. Totus Central conserva la operativa propia del puesto: caja, asignaciones de operadores, borradores, seguimiento de operaciones y conciliación. El registro local de una operación no sustituye la confirmación del pedido remoto. No se duplican numeraciones oficiales de factura ni se supone que un cobro esté aceptado porque el navegador lo indique.

## Cobertura y aceptación

| Área | Recorrido que debe existir | Condición de aceptación |
|---|---|---|
| Tiendas | Seleccionar instalación y tienda autorizadas; cambiar de contexto explícitamente | Pedido, productos, caja y permisos pertenecen al mismo contexto; no se arrastra un carrito a otra tienda |
| Usuarios | Acceso Central, operador, permisos por acción y tienda | Servidor verifica permisos al cobrar, descontar, devolver, reponer y cerrar; cambiar operador no comparte credenciales |
| Venta | Buscar nombre, referencia, EAN/UPC; lector, categorías, combinaciones, cantidades y cliente | Precio e impuestos recalculados; pedido remoto con líneas, cliente, moneda, transporte y totales correctos |
| Precio | Descuento por línea o total, importe o porcentaje, cupones | Sincronización del descuento con el pedido; un ajuste de esa venta no cambia el catálogo. Cambios permanentes y ofertas se gestionan con Precio |
| Cobro | Efectivo, tarjeta, Bizum, transferencia, métodos configurables y mixtos | Métodos mapeados por tienda; importe liquidado y cambio exactos; tarjeta/Bizum no incrementan efectivo físico |
| Crédito | Anticipo, saldo, vencimientos, cuotas y cobros posteriores | Cada cobro tiene referencia única, saldo verificable y documento; no marcar íntegramente pagado un pedido pendiente |
| Recuperación | Corte de red, respuesta perdida, recarga, doble clic | Una operación persistente conserva su identidad y pedido remoto; se concilia antes de permitir otro envío |
| Stock | Reposición por producto y combinación, lectura de códigos y motivo | Guardar cantidad anterior, movimiento, usuario y resultado remoto. Detectar concurrencia; no sobrescribir una venta concurrente con una cantidad antigua |
| Inventario | Ajustes, recuentos y consultas por tienda | Separar recepción, ajuste y venta; traspaso entre instalaciones requiere salida y entrada vinculadas con recuperación parcial |
| Caja | Apertura, entradas/salidas, traspasos, arqueo, cierre e historial | Efectivo esperado separado de pagos no físicos; cada movimiento pertenece a una sesión y no se duplica al reintentar |
| Devolución | Localizar venta y líneas, devolución parcial/total, motivo, reintegro o vale | Límite por cantidad ya devuelta; reposición opcional según defecto; devolución de dinero verificada por su proveedor |
| Carritos | Aparcar y recuperar, reservas y presupuestos | Borrador distinto de venta; recalcular al recuperar; conversión única a pedido y control de vigencia |
| Documentos | Ticket, regalo, factura, albarán, presupuesto, justificante parcial, reimpresión | Documento enlazado a operación confirmada; reimprimir no cobra ni crea otro pedido; numeración y reglas fiscales por definir y validar |
| Clientes | Buscar, crear/editar, direcciones y selección de cliente de mostrador | Identidad y direcciones válidas en la tienda seleccionada; sin inventar datos personales para superar validaciones |
| Puesto | Impresora, cajón, lector, táctil y pantalla de cliente | Compatibilidad comprobada con hardware real; fallo de impresión no repite el cobro; cajón exige permiso |
| Informes | Ventas físicas/web, usuario, tienda, pago, devolución, costes y stock | Totales conciliados con pedidos y pagos; operaciones pendientes y devoluciones visibles; exportación con permisos |
| Avisos web | Detectar pedidos online, aviso y eventual impresión | Identidad remota evita avisos o impresiones repetidos; preferencias por puesto |
| Interfaz | Escritorio compacto y móvil, tablas y columnas compartidas | Mismos componentes de Central, tipografía adaptable, controles sin duplicar y preferencias guardadas en la cuenta |
| Autonomía | Alta de tienda, prueba de permisos, configuración guiada y diagnóstico | Un cliente puede configurar y recuperar incidencias sin IA, SQL manual ni acceso de un desarrollador |
| Sustitución | Ejecutar todos los recorridos sin POSTPV | Ninguna llamada, tabla, clase o licencia de POSTPV; retirada sólo después de validar cobertura y recuperación |

## Límites que se deben resolver antes de prometer equivalencia

La web del proveedor anuncia funciones que usan hardware o módulos adicionales. Fidelización, almacenes avanzados, números de serie, caducidades, reservas especializadas y datáfonos no se consideran disponibles sólo por aparecer en su catálogo. Cada capacidad necesita una implementación propia o una integración explícita, compatible y comprobada.

El alta nativa de un pedido no garantiza por sí sola que se hayan completado estado, pago, factura y descuento de stock. La prueba anterior que necesitó recuperar manualmente el estado no satisface el recorrido autónomo. Se debe resolver ese fallo antes de habilitar ventas ordinarias.

La API oficial disponible y sus permisos deben verificarse por versión e instalación. Si no permite una función completa, se documenta la limitación: no se instala un puente ni se depende de POSTPV para ocultarla.

## Evidencia pública consultada

- [Producto y funciones de POS TPV](https://www.pos-tpv.com/es/inicio/8-tpv-pos-caja-tienda-fisica-para-prestashop-4066521348430.html): referencia funcional para ventas, clientes, cobro, documentos, reposición y puesto.
- [Presentación oficial](https://www.pos-tpv.com/en/): inventario, entradas de material y multitienda.
- [Manual de cajas](https://www.pos-tpv.com/es/manual/manuales-tpv-prestashop/cajas-en-pos-tpv-prestashop?fc=module): asignación, apertura, movimientos y cierre.
- [Historial de cambios](https://www.pos-tpv.com/es/content/7-changelog-lista-de-cambios-pos-prestashop): funciones dependientes de versión; no es prueba de funcionamiento de nuestra implementación.

Estado actual: estudio y contratos iniciales de negocio en `src/totustpv/model.js`, con pruebas locales. Pendientes: interfaz integrada, persistencia y permisos efectivos, adaptadores oficiales y validación completa de los recorridos anteriores. No se ha habilitado un checkout comercial nuevo.
