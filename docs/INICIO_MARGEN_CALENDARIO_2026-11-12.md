# Inicio: margen comercial y calendario

## Margen

El widget Ganancia comercial deja de tener una respuesta fija. Usa los mismos pedidos, líneas y costes de producto/combinación que Pedidos y Resumen; comparte las consultas por tienda y periodo. Necesita permiso de lectura de PrestaShop. No accede a una tienda distinta de las conexiones existentes.

Selecciona tienda y fechas o Día/Semana/Mes. Actualizar margen solicita una nueva lectura. La cifra es venta de productos sin impuestos menos coste de compra sin impuestos; se excluyen transporte y envoltorio mediante sus importes separados. El coste actual de la combinación prevalece cuando está informado; se conserva la recuperación de coste del producto o registrado en el pedido que ya utiliza el adaptador. Los precios de coste de PrestaShop son la base solicitada, no una certificación de coste histórico.

Se muestran cobertura y desglose por tienda. Un resultado incompleto o sin coste no se convierte en cero. No se mezclan monedas no acreditadas como EUR. Los márgenes negativos se mantienen. El redondeo por pedido se agrega en céntimos para que los importes de tiendas, total y gráfica coincidan. La gráfica propia representa margen comercial por fecha, con días sin ventas a cero únicamente cuando la consulta está completa; su tabla de cifras es accesible. No es beneficio neto, no resta gastos generales y no sustituye una conciliación separada de abonos o devoluciones.

La gráfica contable original de Ventas y gastos se conserva. La superposición de otra serie en esa gráfica sigue siendo una parte pendiente del punto 16; no se declara terminada por añadir la gráfica del widget.

## Calendario de tareas

El widget Tareas permite Día, Semana y Mes, selección de fecha, anterior/siguiente y Hoy. El mes se organiza por semanas de lunes a domingo y muestra contadores. La agenda enseña hasta cuatro tareas de la fecha elegida y el número de restantes. Abrir Tareas lleva a la semana de esa fecha en el módulo existente.

La consulta usa `totus_tasks_context` y los permisos actuales de Tareas. Este widget no crea ni modifica tareas; dichas acciones permanecen en su módulo. La selección y los datos se separan por cuenta. Respuestas tardías se descartan al cambiar de cuenta o abandonar el widget. No se añade un temporizador. Los estados se renuevan al entrar al módulo o pulsar Actualizar; la navegación de periodo consulta el rango necesario.

## Interfaz y comprobaciones

Paleta, bordes y tamaños se heredan de Interfaz. El calendario usa siete columnas ajustables al espacio disponible. Los títulos y textos de las tarjetas de indicadores reservan un alto de línea homogéneo sin cambiar sus datos ni las dimensiones guardadas por cada usuario.

Pruebas locales: cinco casos del modelo, calendario en años bisiestos y límites de mes; recorridos Playwright en 390, 768, 1017, 1440 y 1920 px; valores negativos, dos tiendas, error de red, respuesta tardía de otra cuenta, textos escapados y ausencia de desbordamiento. La prueba de acciones de Inicio comprueba en la aplicación simulada un margen combinado de 303,84 EUR y la apertura de Tareas en la fecha seleccionada. También se repite la regresión de diseño y persistencia de Inicio. Son API simuladas, no escrituras reales en las tiendas.

No hay migraciones, nuevos servicios ni permisos de servidor en este bloque. El módulo histórico de margen con coste verificado permanece intacto. Publicación y carga del manual en Fuentes deben acreditarse por separado.
