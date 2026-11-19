# Buscador del mostrador · 17/11/2026, 12:10 CET

Ampliación del borrador para CFG-09-03 y CFG-10-04 a CFG-10-08. Implementación y pruebas aisladas completas para este alcance; la activación y aceptación remotas siguen pendientes. Las capturas originales permanecen privadas.

## Uso

En **Más acciones → Configuración → Buscar artículos**, marca los campos que utilizas: **Referencia**, **EAN 13**, **UPC**, **ISBN** o **Nombre y atributos**. Debe quedar al menos uno. Si buscas principalmente con códigos, puedes activar **Teclado numérico al buscar en móvil**. Guarda el mostrador; el ticket se conserva y los resultados se vuelven a consultar con los criterios elegidos.

El campo muestra los criterios actuales como ayuda. Escribir filtra todo el catálogo nativo, no solo la página visible. Enter añade una unidad únicamente cuando hay una coincidencia exacta, única y disponible en uno de los identificadores activados. Si hay varias coincidencias, un producto con variantes por elegir o solo una coincidencia de nombre, se pide seleccionar. Los campos desmarcados no se usan tampoco para el escaneo con Enter.

La elección pertenece a tu cuenta y caja. No cambia nombres, referencias o códigos guardados. Si se intenta guardar sin ningún criterio, se explica el error y se conservan las casillas vacías para corregirlas. Si la preferencia se guarda pero falla la consulta posterior, se distingue el guardado de la actualización fallida y se retiran los resultados antiguos.

## Estructura

`search-preferences.js` define la lista cerrada de cinco campos, su orden, validación, controles y captura de selección múltiple. El adaptador normal de Central envía los criterios; el handler y `native-transport.js` limitan el parámetro al recurso de catálogo. Una conexión que no confirme criterios personalizados no puede ignorarlos silenciosamente.

`NativeCatalogue.php` construye las condiciones con una lista estática de columnas y parámetros preparados. Busca identificadores de producto y combinación; los atributos se incluyen al activar Nombre. Los caracteres `%`, `_` y `!` se tratan como texto. El contexto de tienda, idioma, cliente, dirección y permisos existentes se conserva. La identidad del índice de PVP incluye los criterios para evitar reutilizar resultados de otro filtro.

La migración `20261117105231_totustpv_search_preferences.sql` añade preferencias privadas mediante la RPC autenticada existente, sin permisos nuevos de catálogo o venta. Rechaza campos desconocidos, duplicados, listas vacías y tipos incorrectos. Es la octava migración del borrador todavía sin aplicar remotamente.

El cambio exige coordinar migración, servicio y conector antes de publicar la interfaz. La lista de recursos generales, el catálogo de Clientes y las escrituras de productos no ganan campos o permisos por este buscador.

## Evidencia

- 474 aserciones SQL y 47 recorridos afectados aprobados desde 64090fac. Las 34 pruebas agrupadas específicas/de frontera también pasan; se conservan las pruebas existentes.
- Laboratorio PrestaShop 8.2.8/MariaDB: referencia, EAN, UPC e ISBN para producto y combinación exacta; exclusión por campo, nombre, caracteres literales, índice de PVP y ausencia de escrituras nativas durante las consultas.
- Navegador conectado al handler y SQL reales aislados: corrección de selección vacía, guardado solo por ISBN, teclado numérico indicado mediante `inputmode`, exclusión de EAN/referencia, escaneo ISBN con Enter, preservación del ticket y 1440/390 píxeles.

Autenticación y entrega loopback son fixtures. No se consulta ni modifica una tienda remota. La emulación del navegador verifica la indicación del teclado; no certifica un teclado móvil ni un escáner físico. No se marcan resueltos por este bloque la búsqueda de productos deshabilitados, categorías excluidas, política de falta de stock ni generación de códigos.
