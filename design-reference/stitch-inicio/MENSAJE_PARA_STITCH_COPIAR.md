# Mensaje directo al agente del proyecto Stitch de Totus Central

**Abrir el proyecto EXISTENTE:** https://stitch.withgoogle.com/projects/5869856515258186560
**No generar un proyecto nuevo.** Utilizar `DESIGN.md` y el encargo completo `ENCARGO_STITCH_INICIO_PROFESIONAL.md` de `design-reference/stitch-inicio/`.

---

Quiero que actúes como un equipo sénior de diseño UX/UI especializado en software de gestión empresarial. Diseña de nuevo el **INICIO MODULAR DE TOTUS CENTRAL** dentro de este proyecto Stitch, respetando el sistema visual que ya hemos aprobado. No necesito un prototipo decorativo ni una cuadrícula de tarjetas enormes: necesito un **entorno de trabajo diario profesional**, claro, elegante, denso en información útil, ágil y completamente funcional al integrarlo con la aplicación existente.

**PROBLEMA QUE DEBES RESOLVER:** La implementación actual tiene contenedores de alturas inadecuadas, enormes espacios desperdiciados, gráficas apretadas, barras de scroll dentro de las tarjetas, datos y controles escondidos. Esta solución se rechaza. Diseña reglas reales de reflujo y adaptación al ancho y alto disponibles; los componentes cambian estructura, número de columnas, etiquetas y presentación en función de **la anchura de cada widget**, no solo del móvil o escritorio. El contenido debe verse y usarse entero; si hace falta más altura, el widget crece; si se estrecha, pasa a resumen compacto con acción de ampliar; **nunca barras interiores para ver gráficas, KPIs, campos o botones**. Una tabla ancha debe reorganizarse en fichas en móvil, no hacer scroll horizontal obligatorio para actuar.

**FUNCIONES QUE NO PUEDES PERDER:** Inicio original con cabecera, aperturas por establecimiento y cajón, cuatro indicadores del periodo, gráfica Ventas/Gastos, filtros, cierres, control interno, fiscalidad, documentos, tareas, acceso a facturación y formularios de nuevo cierre/gasto/factura/documento. Pricing y variantes, facturas, recepciones, chat, informes, administración y demás módulos conservan sus rutas originales, permisos y formularios. Los widgets se pueden añadir, duplicar cuando es seguro, mover, redimensionar, ocultar y recuperar; guardado individual por usuario con cancelar, recargar y revisión de cambios. Tema claro y oscuro y preferencias `Mi interfaz` prevalecen.

**PRESTASHOP:** Dos tiendas distintas, Hortimatic (Azuqueca) y NewOldSmok (Alcalá), con resúmenes paralelos y filtros independientes. Crea una barra **DÍA | SEMANA | MES | PERSONALIZADO** en cada vista que lo necesite; botones anterior/siguiente, selector de día/semana/mes, Desde/Hasta, Aplicar/Limpiar y selector de tienda. Día = evolución por horas, semana = por los siete días, mes = por días/semanas, personalizado = rango exacto con granularidad indicada. Gráficos interactivos de pedidos válidos, ventas EUR verificadas y ticket medio, ejes legibles, selección de serie y de puntos, tooltip útil en ratón y táctil, acceso inmediato al detalle/tabla filtrada. Evitar todas las barras de scroll dentro de gráficas.

Resúmenes de ventas, número de pedidos, ticket medio, top de productos **por variantes y nicotina sin mezclar**, calidad de catálogo y avisos de consulta parcial. Tabla real de pedidos con filtro de tienda, fecha, referencia, estado, pago y orden; paginación de 10; columnas configurables; ver pedido y navegar a la ficha original. En anchura pequeña, fichas de pedido con importe/fecha/estado/botón y detalles desplegables. No inventar Cliente, Empleado, Margen o Beneficio que no se puedan verificar. No duplicar ventas de PrestaShop con ingresos de Cajas; apertura de cajón no es venta nueva; retirada no es gasto fiscal. Ganancia comercial sin costes históricos comprobados = `Sin validar`.

**ENTREGA VISIBLE Y COMPLETA:** Diseña **escritorio de 1440 y 1920px**, tablet 768/1024px, móvil 390 y 320px, estado de edición, área/detalle de PrestaShop con gráficos y filtros, tema oscuro y estados carga/vacío/error/parcial. Un solo sistema visual coherente con las pantallas de Totus ya existentes, no diez diseños sin relación. Entrega **prototipo navegable**, interacciones representadas, exportación original HTML/CSS/capturas, IDs/enlaces de pantallas, y `DESIGN.md` con tokens y reglas explícitas de reflow para widgets de 320/500/750px.

**TU FUNCIÓN:** proponer, dibujar, criticar y perfeccionar el diseño profesional que resuelve este problema; no publicar, no sustituir datos reales, no crear lógica comercial ni mostrar cifras ficticias como acreditadas.

**FUNCIÓN DE CHATGPT AL RECIBIR TU ENTREGA:** guardar originales, seguir el diseño final fielmente, mapear cada control a la lógica ya existente en GitHub, implementar las transformaciones responsive sin romper módulos, usar la conexión real y segura de PrestaShop, comparar pantallas reales con las exportadas y comprobar todas las acciones antes de publicar por PR y GitHub Pages. Nada de improvisar otro diseño "parecido".

Primero, analiza las referencias aprobadas de Totus dentro de este proyecto. Luego presenta una composición coherente y **genera las vistas y prototipo**. No me devuelvas solo una propuesta escrita; necesito el resultado visual y sus archivos.

---

**Referencias completas y alcance exhaustivo:** `ENCARGO_STITCH_INICIO_PROFESIONAL.md` y `DESIGN.md` del directorio `design-reference/stitch-inicio/`. La especificación detallada prevalece sobre las simplificaciones de este mensaje.
