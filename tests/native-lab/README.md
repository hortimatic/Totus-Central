# Laboratorio nativo aislado de TotusTPV

Estas pruebas ejecutan clases reales de PrestaShop 8.2.8 contra MariaDB local.
No son una instalación del conector, un despliegue de Totus Central ni una
validación de las tiendas remotas. Todos los clientes y productos son ficticios.
El proveedor de propiedad del carrito de `cart-quote.php` sigue siendo una fixture.

`bootstrap.php` rechaza otra base distinta de `totus_tpv_lab` en
`127.0.0.1:3318`, con el usuario local `tpv_lab`. El correo está desactivado.
Binarios, configuración y datos están en `artifacts/native-lab`, excluido de Git.

Con ese laboratorio preparado y MariaDB iniciado exclusivamente en loopback,
ejecutar desde la raíz del repositorio:

```powershell
node tests/totustpv-native-lab-qa.mjs
```

El comando falla si faltan el laboratorio o la conexión; no informa de éxito
omitiendo pruebas. Cada escenario de venta genera su propio carrito ficticio.
No se ejecuta contra una web remota ni instala un módulo. El aprovisionamiento
reproducible de un laboratorio nuevo sigue pendiente; este comando comprueba
el laboratorio ya preparado y no equivale a un instalador del producto.

Secuencia comprobada el 15 de noviembre de 2026:

1. `cart-quote.php`: nuevo carrito, precio nativo de seis decimales,
   total redondeado de 8,01 € y stock intacto de cinco unidades.
2. `card-payment.php`: un único pedido mediante `PaymentModule`, estado inicial
   sin pago automático, un pago nativo `Tarjeta` de 8,01 € y stock de cuatro.
   Rechaza reenviar un carrito que ya tenga pedido.
3. `card-finalize.php`: continúa ese pedido, cambia al estado pagado utilizando
   el pago existente y comprueba una factura y exactamente un pago de 8,01 €.

4. `mixed-refund.php`: carrito nuevo de dos unidades, pagos separados de 5,00 €
   en efectivo y 11,02 € con tarjeta, una factura y dos abonos de 8,01 €.
   Una unidad defectuosa no se repone; otra revendible sí. Una tercera devolución
   se rechaza sin otro abono. El núcleo no confirma por ello el reintegro externo.
5. `journal.php`: registro propio MariaDB/InnoDB con conexiones independientes,
   reclamación persistida, alcance por cajero/tienda y unicidad del pedido.
   Su tabla aleatoria de prueba se elimina al finalizar, sin tocar tablas nativas.
6. `native-effect.php`: excepción controlada tras crear pedido, pagos y factura
   mediante el núcleo; comprueba rollback de esos registros y del stock con
   reclamación durable conservada. Otro carrito confirma efectos y recibo en la
   misma transacción y recupera el resultado sin reenviar. Correo desactivado;
   no prueba un cierre abrupto ni efectos externos de hooks.

Estas pruebas han pasado con PHP 8.2.35 y MariaDB 10.11.16. El método
`Tarjeta` representa el datáfono independiente: ningún paso contacta con un banco.
La clase de pago del laboratorio es una fixture; no está instalada en una web.
No demuestra todavía el recorrido HTTP autenticado de Totus Central, todos los
modos de interrupción transaccional ni la coordinación con el reintegro externo.
Esas validaciones siguen pendientes.

La prueba mixta ejecuta consulta y edición en el mismo proceso CLI. Debe renovar
las cachés nativas de paquetes y transporte después de editar, usando los métodos
públicos del núcleo; de lo contrario puede reutilizar un paquete de una unidad
con un carrito que ya tiene dos. No se modifica ningún archivo del núcleo.

El terminal se cobra fuera de TotusTPV. El futuro recorrido real debe exigir la
confirmación del cajero, conservar su identidad y distinguir el pago con tarjeta
del efectivo físico; registrar un pedido no acredita un cobro bancario por API.
