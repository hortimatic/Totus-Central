# Configuración de justificantes · desarrollo del 16/11/2026

Estado: implementado y comprobado de forma aislada; migración y frontend pendientes de activación remota. No acredita una prueba física de impresión ni termina el inventario de configuraciones solicitado.

El mostrador guarda en Central, por cuenta, conexión, tienda y caja: título del justificante, texto inferior de hasta 500 caracteres, tipografía Arial o monoespaciada, tamaño de 10 a 16 px y formato de fecha. Permite mostrar u ocultar referencia de los artículos, dirección y teléfono del establecimiento, formas de pago, total de descuentos y fecha del pedido.

La vista previa cambia al escribir y utiliza datos de ejemplo identificados como tales. No permite imprimir un ejemplo como si fuera un pedido existente. En escritorio, el papel se presenta junto a los controles; en móvil sigue el orden del formulario. La representación usa papel de 58 mm, márgenes de 5 mm y contenido de 48 mm. El botón de guardado ocupa la cabecera de la configuración en escritorio.

Los justificantes recuperados del historial y su impresión utilizan las opciones guardadas. El ticket regalo mantiene los importes ocultos. La factura, sus importes y numeración nativos no se modifican. La referencia y el número del pedido real se conservan en el justificante; la identidad fiscal del comercio no se sustituye con el texto de presentación. No se han añadido todavía el logo, los datos opcionales del cliente, códigos de barras, fidelidad ni todas las columnas y automatismos de impresión pedidos.

La configuración presentada es personal por caja; no debe confundirse con una política fiscal o de cobro del establecimiento. Las políticas compartidas, permisos especiales y sus pantallas deben completarse por separado. No se guardan catálogos ni datos de clientes en estas preferencias.

## Estructura

- `src/totustpv/receipt-options.js`: valores predeterminados, campos de presentación, normalización y captura del formulario.
- `src/totustpv/documents.js`: justificante existente, ejemplo identificado y preparación de impresión. Escapa el texto, limita tipografías y tamaños y conserva las comprobaciones de PDF nativo.
- `src/totustpv/workspace.js`: carga y guardado de preferencias, vista previa y aplicación al documento recuperado.
- `supabase/migrations/20261116205052_totustpv_catalogue_layout.sql`: almacenamiento privado, validación de tipos y claves, actualizaciones parciales que conservan las otras preferencias.

## Evidencia aislada

234 aserciones PostgreSQL/PGlite incluyen persistencia y rechazo de parámetros desconocidos, nulos, números no enteros, tipografías no admitidas y textos fuera de límite. Navegador en 1440/768/390 verifica vista previa, texto escapado, reentrada, aplicación a un ticket recuperado, orden del ticket, columnas y cancelación de cálculo de precios. La simulación de impresión produce PDF de 58 mm para justificante, regalo, informe de caja y justificante personalizado con tipografía monoespaciada de 16 px. No se confunde esta evidencia con el funcionamiento de la impresora, del cajón o del datáfono físicos.
