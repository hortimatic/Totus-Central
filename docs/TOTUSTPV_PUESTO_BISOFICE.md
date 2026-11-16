# Puesto físico de TotusTPV

## Equipo confirmado por Diego · 16/11/2026

Impresora Bisofice VTR-T58W conectada por USB al ordenador. El cajón está conectado por cable a la impresora. También se utiliza pistola de códigos de barras. La impresora no figura entre las colas instaladas en el ordenador de desarrollo; no se ha realizado una impresión ni una apertura física del cajón desde aquí.

El fabricante del modelo VTR-T58W indica papel de 58 mm, área imprimible de 48 mm, 203 dpi y comandos ESC/POS. [Ficha primaria del fabricante](https://en.xmvtr.com/Product_Center_details/20.html). Las variantes comerciales pueden diferir: antes de enviar pulsos al cajón deben comprobarse la unidad, el conector y su configuración real.

## Impresión disponible en el código local

Ticket, ticket regalo e informe de caja utilizan 48 mm de contenido sobre papel de 58 mm. La altura se mide con las fuentes ya cargadas para ajustar la página al contenido. La factura y el abono conservan su PDF nativo; no se sustituyen sus numeraciones ni se vuelven a crear al imprimir.

La vía actual utiliza el diálogo de impresión del navegador y el controlador existente de Windows. En el puesto se debe seleccionar la Bisofice, papel de 58 mm, escala 100 %, sin cabeceras/pies añadidos por el navegador. No cambiar la impresora predeterminada del ordenador ni reemplazar un controlador que ya funcione desde un proceso automático de Totus.

La prueba de navegador genera PDF y captura de ticket normal, regalo e informe. Comprueba anchura, altura, importes, caracteres españoles y que los textos no se ejecutan como HTML. No acredita alimentación, calidad térmica, estado del papel ni funcionamiento del USB. Una incidencia de impresión nunca autoriza repetir el cobro: se consulta el pedido confirmado y se reimprime su documento existente.

## Cajón · pendiente de integración y prueba física

No se utiliza la opción del controlador de abrir el cajón con cualquier impresión: también lo abriría al reimprimir, emitir un regalo o consultar un informe. La apertura debe ser una acción independiente, autorizada y registrada para la caja y el operador actuales. No hay un botón presentado como operativo sin ese recorrido.

El diálogo estándar del navegador no ofrece una API para enviar comandos RAW al USB. Windows dispone del [canal RAW del spooler](https://learn.microsoft.com/en-us/windows-hardware/drivers/print/raw-data-type). Si se incorpora un componente propio de puesto, pertenecerá a Totus, limitará los comandos a impresión/apertura autorizadas y no contendrá claves de PrestaShop ni ejecutará ventas. No se ha instalado ningún componente adicional.

Un servicio de puesto en loopback necesita autorización del navegador y CORS restringido al origen de Central; no se deben desactivar protecciones o usar permisos universales. [Acceso a red local en Chrome](https://developer.chrome.com/docs/modern-web-guidance/guides/security/local-network-access). La instalación, emparejamiento, recuperación y retirada deben poder hacerse por el cliente sin IA, con una prueba explícita del cajón antes de habilitarlo para trabajar.

## Lector

El recorrido implementado recibe el código en la búsqueda del TPV y procesa Enter. Una coincidencia exacta y única de referencia/EAN/UPC añade el artículo; una coincidencia ambigua requiere seleccionar el producto o combinación. No añade unidades durante el cobro ni permite saltarse mínimos o disponibilidad.

Se ha probado con teclado simulado y Enter. Queda verificar que la pistola física está configurada como teclado y termina el código con Enter, además de su funcionamiento con EAN y referencias de las tiendas. No se requiere instalar un módulo en la web para leer un código.
