# Adaptación del Inicio modular al diseño Stitch · 10/11/2026

## Petición activa #1
Adaptar fielmente a Totus Central la composición visual y las reglas de interacción entregadas por Stitch, conservando las operaciones originales, la personalización, los dos establecimientos y todos los módulos. Referencia aportada: pantalla `e03fb201cedb4b7794932b8b74ccb144` del proyecto Stitch `5869856515258186560`, acompañada de HTML/CSS/JS (adjunto «Markdown pegado.md»). **El enlace de pantalla no ha sido accesible desde el navegador público; los archivos entregados por el titular sí se han leído. No declarar captura/exportación independiente de Stitch.**

## Por qué NO se copia literalmente el HTML de Stitch
La referencia HTML contiene menús simulados `href="#"`, importes inventados, cuatro cajones forzados, supuestas versiones de Totus inexistentes, estado de conexión y latencias de muestra, acciones de catálogo no implementadas y fórmulas fiscales que no corresponden al contrato real. Es un **prototipo visual**, no un reemplazo de la aplicación. La vista real se monta sobre `src/pages/main.js` y sus controladores, sin alterar `data-action`, fórmulas contables, permisos ni conexiones.
- Hortimatic = Azuqueca (Vape/Head), NewOldSmok = Alcalá, siempre **cajones dinámicos acreditados**, jamás los cuatro valores ficticios de la maqueta.
- KPI fiscal original: ingresos, gastos contables revisados, ingresos menos gastos y gastos internos; no renombrar categorías fiscales por intuición.
- PrestaShop utiliza exclusivamente el lector autenticado existente; ventas de pedido no son automáticamente una venta contable adicional.
- Costes históricos no validados => **Sin validar**, y consulta parcial => sin total que parezca completo.

## Cambios de implementación en rama aislada
- Componentes con altura por contenido. `--height` y preferencias por dispositivo quedan como **altura mínima útil en edición**, nunca como permiso para recortar datos. Eliminadas barras interiores en lectura.
- Contenido responde al tamaño propio del widget: KPIs y resúmenes se apilan, las gráficas se reescalan y los pedidos pasan a fichas en espacio insuficiente (detalle desplegable y botón que abre el pedido original).
- Gráficas PrestaShop agrupan por hora del día, días, semanas o meses de manera explícita. El periodo `Día / Semana / Mes / Personalizado` calcula sus intervalos reales y funciona por widget, sin cambiar los datos de la otra tienda. La selección de una barra diaria abre la vista real de pedidos en esa tienda/fecha. Los datos parciales o monedas no verificadas no generan gráfica engañosa.
- La tabla de pedidos conserva toda la información y la configuración de columnas en escritorio. En pequeño se muestra una ficha con todos los campos en `Ver datos y productos`. El ranking de productos refluye en estrecho.
- Cabecera, menú, `Mi interfaz`, bloque original de aperturas, gráfico de caja, formularios y permisos no se reemplazan por HTML demo. No cambian operaciones de negocio ni SQL.

## Comprobación requerida antes de fusión
- CI completo en el commit exacto y revisión de todos los jobs, incluidos PostgreSQL aislado, PrestaShop aislado y QA de otros módulos.
- Playwright: anchos 320,390,768,1024,1440,1920; contenedor de widget estrecho y amplio; sin scroll interior, ni recorte o pérdida de botón; fecha, semana, mes, personalizado; pantalla con mock y capturas; gráfico que cambia de serie, filtros independientes, tabla->ficha; persistencia de preferencia, duplicado, drag, resize, permisos.
- Revisión visual humana de las capturas respecto a la referencia aportada. **Una prueba en verde no demuestra por sí sola buena calidad visual.**
- La sesión real y los conectores de tiendas requieren comprobación en recorrido no destructivo; no ejecutar operaciones fiscales reales a modo de ensayo.

**Producción:** hasta desplegar y verificar GitHub Pages, solo es código en PR. **Registros contables/stock/OneDrive afectados: ninguno**. **Request IDs comerciales pendientes: ninguno**.
