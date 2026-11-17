# Precios con y sin IVA · 17/11/2026, 11:49 CET

Ampliación en la rama borrador del TPV, pendiente de activación coordinada y aceptación remota. Corresponde a CFG-09-13. No modifica tipos impositivos, precios de catálogo, cuotas, cobros ni documentos fiscales.

## Uso

Abre **Más acciones → Configuración → Precios de las tarjetas**, elige **Con IVA** o **Sin IVA** y pulsa **Guardar mostrador**. La elección se guarda para tu cuenta y caja. Cada tarjeta identifica el importe mostrado. El ticket sigue usando el total calculado para el cliente y sus impuestos.

En **Vista → Tabla → Columnas** puedes añadir **Precio sin IVA**, conservando **PVP con IVA** si quieres comparar. La ordenación de PVP corresponde al importe con IVA, como indica su cabecera; la nueva columna sin IVA no ofrece una ordenación local que pudiera confundir una página con todo el catálogo.

## Construcción y comprobación

`NativeCatalogue.php` devuelve `preview_tax_excl_cents`, calculado por PrestaShop mediante su regla de redondeo, junto al PVP existente. El handler lo proyecta expresamente; el adaptador conserva ambos importes y la interfaz selecciona su presentación. No divide por un IVA fijo ni deriva el precio neto de un importe redondeado con IVA. Una conexión que aún no entregue el dato muestra «Precio no disponible» o una raya en la tabla, sin inventar un valor.

La migración `20261117104005_totustpv_catalogue_tax_display.sql` amplía la preferencia privada por cuenta/caja y permite la nueva columna. Conserva las opciones anteriores y la autorización existente. Los valores se limitan a `gross` y `net`; cadenas arbitrarias, tipos incorrectos y claves desconocidas se rechazan. Esta séptima migración del borrador sigue sin aplicarse remotamente.

Pruebas: 461 aserciones SQL, tres pruebas específicas, 34 pruebas agrupadas de contratos/adaptadores/frontera y los 46 recorridos afectados aprobados desde 6a506579. El navegador comprueba conservación y cambio de preferencia, ambas columnas y 1440/768/390 píxeles. Las capturas sintéticas se revisan por separado de la prueba nativa.

El laboratorio PrestaShop 8.2.8 confirma 801 céntimos con IVA y 662 sin IVA para el artículo original. El navegador conectado guarda la preferencia mediante SQL real y muestra 6,62 € sin IVA antes de continuar con el alta de categoría y producto. Autenticación y entrega loopback son fixtures; no se consulta ni modifica una tienda remota. La práctica incorpora dos importes ficticios explícitos y permanece separada de la contabilidad comercial.

La preferencia no permite vender sin impuestos ni convertir el ticket en un albarán sin IVA. Esas funciones siguen siendo requisitos distintos y no se marcan resueltas por esta presentación.
