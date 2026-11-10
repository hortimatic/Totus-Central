# Inicio modular de Totus Central · implementación aislada (10/11/2026)

## Propósito y alcance
El trabajo afecta únicamente al módulo Inicio. Parte de su DOM y de sus funciones canónicas; no sustituye el contenido de `src/pages/main.js`, la fiscalidad, el calendario de tareas, los cálculos ni los formularios. El editor se monta desde `src/app.js` después de pintar Inicio y mueve al grid los nodos existentes. Conserva los atributos `data-action` y `data-route` y sus permisos delegados.

La fotografía de diseño es la referencia visual entregada en la conversación (Stitch no estuvo conectado; las imágenes generadas aquí no son un archivo exportado de Stitch). Los estilos heredan variables de Configuración → Mi interfaz.

## Requisitos implementados en esta entrega
- Biblioteca de 28 tipos; los existentes se reutilizan sin reconstruir los cálculos. Las fuentes no acreditadas muestran mensajes claros y enlace al módulo, no cifras ficticias.
- Instancias con ámbito, fechas y filtros propios; duplicar crea un ID nuevo. Excepción: el formulario de Consulta rápida de precio es único para evitar dos juegos de campos con los mismos IDs.
- Arrastrar paneles en escritorio y ordenar mediante selectores y botones accesibles en móvil. Ajustar ancho entre las anchuras válidas y alto entre 2 y 12 unidades, sin permitir ancho mayor que la cuadrícula.
- Dos resúmenes PrestaShop, uno por tienda, y un listado paginado de diez pedidos por defecto. Lectura vía servicio existente `totus-connections`, previa consulta de `totus_prestashop_context` y validación de revisión, tienda, moneda, exclusión de duplicados y alcance. No escribe en PrestaShop ni en contabilidad.
- Aperturas por cada establecimiento y cajón real mediante `lastDrawerBalance`, más resumen total **solo si todos los saldos proceden del último cierre del día**; en otro caso el importe conocido figura como parcial y se indican cajones pendientes/desactualizados. No confundir efectivo retenido con retiradas.
- Ganancia comercial: campo visible, pero sin cifra mientras no exista una fuente contrastada de coste histórico por variante, descuentos y devoluciones. No usar coste actual como coste histórico ni anunciar beneficio neto.
- Preferencias `profiles.ui_preferences.home_dashboard` con revisión optimista y propietario ligado a Auth; migración pendiente de revisión técnica y despliegue. Si falta la RPC, se utiliza la composición predeterminada, sin fingir que los cambios se guardaron entre sesiones.

## Limitaciones reales antes de publicar
- El resumen de PrestaShop realiza consultas en tiempo real: necesita sesión, permisos y conexiones autorizadas; si no están disponibles el widget muestra el error. No sustituye la conciliación de cajas/contabilidad.
- El widget de pedidos solo presenta un recuento total si se ha agotado la paginación. Si se alcanza el límite de 20 páginas, muestra consulta parcial. La paginación visual y búsqueda filtran el conjunto descargado, con advertencia.
- La clasificación web/TPV no se infiere de `payment` ni de `id_shop` sin origen verificado.
- El cálculo completo del margen comercial y los widgets de recepciones/stock especializados requieren fuentes verificadas; no se presentan como implementados en esta fase.
- Faltan pruebas de conectores reales en sesión de producción, persistencia entre dispositivos y revisión técnica de la migración. No publicar/mergear antes de verificar estos puntos.

## Pruebas exigidas y puntos de rechazo
Playwright: 320/390/768/1024/1440/1920, sin scroll de página horizontal; orden y resize; duplicados PrestaShop con tienda y filtros independientes; tabla con diez filas y scroll propio; navegación; editor/discard; conservación de apertura y caja en tres y cinco cajones; no mostrar margen inventado; no perder acciones de Inicio. PostgreSQL aislado: autenticación y cuenta propia, revisión antigua rechazada, no escribir preferencias ajenas, no aceptar IDs duplicados o tipos arbitrarios, lectura posterior, preservación de `ui_preferences.interface` y `team_chat` y reversión. PR / CI, revisión de seguridad independiente, despliegue de RPC antes de interfaz, verificación de versión y aceptación del titular.
