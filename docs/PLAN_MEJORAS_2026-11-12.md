# Registro de trabajo — 12 de noviembre de 2026

Este registro recoge las 26 anotaciones de Diego. Pendiente significa pendiente: no acredita implementación, prueba ni publicación. No sustituir componentes validados, borrar maestros reales ni modificar tiendas para ampliar la API. Los archivos sincronizados de `sources/` son de solo lectura; la publicación en Fuentes debe comprobarse por separado.

## Orden y criterios de aceptación

| Nº | Petición | Entrega verificable | Estado comprobado |
|---|---|---|---|
| 1 | Color del reloj | Hereda Texto de cabecera de Interfaz y persiste tras recargar | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 2 | Clientes por tienda | Lectura completa, tabla configurable, ficha editable, direcciones, pedidos, gasto y margen, publicación y relectura | Pendiente |
| 3 | Proveedores por tienda | Mismo patrón; separar proveedor comercial PrestaShop del fiscal de Totus sin perder relaciones | Pendiente |
| 4 | Navegación | Secciones coherentes conservando orden y preferencias personales existentes | Pendiente |
| 5 | Atributos por tienda | Pestaña propia, grupos y valores, asociados, crear/editar/eliminar y releer | Parcial publicado en PR #186: consulta/edición/asociados; creación independiente y eliminación pendientes |
| 6 | Gastos recurrentes | Previsión, frecuencia, vencimientos, avisos configurables e historial sin duplicar gasto contabilizado | Pendiente |
| 7 | Ventas | Módulo con resúmenes, pedidos, pagos, márgenes, filtros y avisos por tienda reutilizando Automatizaciones | Pendiente |
| 8 | Margen en pedidos de Inicio | Cálculo compartido con Pedidos y ventas, cobertura y unidades coherentes | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 9 | Atendido por en Inicio | Evidencia de pedido/empleado; no inferir por coincidencia de horario | Pendiente de fuente TPV |
| 10 | Filtros de periodo | Alineados en móvil, tableta y escritorio sin desbordar | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 11 | Medios de pago | Mostrar todos los recibidos de la tienda, incluidos Bizum/transferencia cuando existan | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 12 | Margen comercial resumen | Reutilizar cálculo real, distinguir parcial, cero y falta de datos | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 13 | Calidad de catálogo Inicio | Mostrar cobertura, recuentos y acción útil para consultar incidencias | Publicado en PR #186 (35f85256); manual y pruebas simuladas incluidas |
| 14 | Fecha automática | Periodos relativos actualizados; fechas elegidas manualmente conservadas | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 15 | Más vendidos | Foto, referencia, variante y unidades con enlace a ficha | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 16 | Gráfica | Separar margen comercial de ingresos menos gastos y beneficio neto | Parcial publicado en PR #188: widget y gráfica propia de margen; serie sobre gráfica contable pendiente |
| 17 | Gestor de atributos | Sustituir modal confuso por navegación clara grupo → valores → productos | Parcial publicado en PR #186: consulta/edición/asociados; creación independiente y eliminación pendientes |
| 18 | Categorías | Árbol padre/hijos buscable, múltiples asociadas y principal explícita | Publicado en PR #185 (d0f8a087); no implica cierre de otros puntos |
| 19 | Calidad práctica | Filtros de incidencias que abren productos afectados y permiten corregir | Publicado en PR #186 (35f85256); manual y pruebas simuladas incluidas |
| 20 | Avisos de catálogo | Totales, alcance y fecha de última lectura; no guiones sin explicación | Publicado en PR #186 (35f85256); manual y pruebas simuladas incluidas |
| 21 | Simetría Inicio | Tipografía, alturas y saltos de línea adaptados al contenedor | Parcial publicado en PR #188: alineación de títulos/subtítulos; revisión del resto de tarjetas aún abierta |
| 22 | Calendario tareas | Día/semana/mes integrado en el widget sin aumentar su ancho | Publicado en PR #188: calendario Día/Semana/Mes y apertura de fecha en Tareas; pruebas automatizadas en cinco anchuras |
| 23 | Proveedores duplicados | Unificar acceso solo después de sincronización y contraste de relaciones | Pendiente |
| 24 | Marcas por tienda | Tabla/configuración, asociados y edición/publicación/relectura | Pendiente |
| 25 | Caja del pedido | Identidad tienda + apertura/cajón y relación exacta con pedido; PR #181 no terminado | Pendiente de acceso automático |
| 26 | Mi cuenta | Perfil, datos propios, notas y preferencias con permisos y persistencia | Pendiente |

## Frentes adicionales

1. Inventariar duplicados y retirar únicamente los demostrados como innecesarios; conservar migraciones históricas necesarias para reconstruir una base vacía.
2. Cada función nueva necesita permiso de servidor y cliente coherentes; ocultar un botón no sustituye autorización. Aplicar la paleta y densidad de Interfaz, tamaños homogéneos, tablas compartidas y perfiles guardados.
3. Manuales de uso humano y ChatGPT: tienda, identidad, lectura previa, diferencias, publicación, relectura y recuperación de errores; nunca declarar guardado por un clic sin respuesta verificada.
4. Migración integral Hortimatic: proyecto separado, inventario de origen/destino, versión exacta (confirmar si se refiere a PrestaShop 8), mapa de entidades, ensayo en copia aislada, validación y reversión. No importar un volcado 1.7 directamente sobre otra versión. La API de catálogo no equivale a una copia de toda la base: pedidos, clientes, contraseñas, módulos, documentos, imágenes y configuración requieren tratamiento específico.

## Comprobación por entrega

Pruebas dirigidas al cambio, recorridos Playwright con datos aislados, tienda y cuenta diferenciadas, respuesta de escritura seguida de relectura y comparación. Pruebas visuales en 390, 768, 1017, 1440 y 1920 px según el componente. La prueba simulada y la prueba real deben figurar como evidencias distintas. No instalar nada en PrestaShop. No consumir cuotas repetidamente ni añadir pagos.

## Publicación

No publicar una pantalla con botones que simulan una sincronización. Cada entrega debe enumerar lo terminado, lo probado, lo publicado y lo pendiente. No afirmar que este plan está en Fuentes hasta verificar su carga allí.

## Ampliación recibida durante el trabajo

- Reloj y calendario: controles propios de tamaño, diseño y funciones en Interfaz, además del color ya existente. Pendiente.
- Nueve CSV de ejemplo revisados solo en lectura. Mapa de entidades y propuesta en `TRANSFERENCIA_PRESTASHOP_2026-11-12.md`. No son una exportación integral ni se han importado.
- Manual y límites del primer bloque: `INICIO_CATEGORIAS_MANUAL_2026-11-12.md`. Fuentes del proyecto: carga no verificada.

## Revisión posterior a PR #186

PR #186 publicado y contrastado con `build-info.json`, commit `35f852568022e585a9349b141cd2e4e6c646adf5`; sus 18 controles y los 19 trabajos de publicación pasaron. Esto no termina los puntos marcados como parciales o pendientes.

Simulaciones adicionales: paginación completa de grupos, productos y combinaciones; solo lectura; fallo de actualización con caché fechada; rechazo de duplicados, páginas vacías incompletas y respuestas de otra tienda; descarte de respuestas tardías al cambiar tienda, cuenta o desmontar pantalla. No sustituyen una prueba de escritura real.

Omisión detectada tras #186 y corregida en #188: el widget `home.gain` ya calcula margen y muestra su gráfica propia. Sigue pendiente la serie sobre la gráfica contable original del punto 16.

La ficha Mi cuenta ya dispone de datos, notas y apartados con pruebas propias; el punto 26 solicita su ampliación, no se considera cerrado solo por existir esos apartados. La lectura de clientes del conector actual es por ID y no permite declarar una sincronización completa.

## Reanudación y cobertura íntegra

Publicación #187 verificada en `564500ac8790c54f96c7bba3fd602bcb9316b049`. Publicación #188 verificada en `bef6e762e6266f153545436dd85c3a749328c320`; 19 trabajos de publicación correctos. Estas publicaciones no cierran el listado.

Balance del listado: 12 puntos implementados/publicados (1, 8, 10, 11, 12, 13, 14, 15, 18, 19, 20, 22), cuatro parciales (5, 16, 17, 21) y diez pendientes (2, 3, 4, 6, 7, 9, 23, 24, 25, 26). El contrato local de contactos no cuenta como interfaz terminada ni sincronización publicada.

Orden de terminación: Clientes/Proveedores/Marcas y atributos independientes; navegación y Ventas; gastos recurrentes; ampliación de Mi cuenta y controles de reloj/calendario; cierre de los parciales, fuentes de vendedor/cajón, eliminación contrastada de accesos duplicados, documentación y recorridos integrados. No retirar el proveedor de Gastos hasta conservar y contrastar sus relaciones.

Ampliación importante recibida después: (27) diagnosticar y resolver HTTP 401 de la API de Hortimatic nueva; (28) incorporar una tienda conectada a los módulos con las mismas operaciones que las actuales. Deben desarrollarse después de los pendientes anteriores. El escrito general de infraestructura, altas/bajas, convivencia y sustitución de tiendas/cajas queda para tratar después de esos dos puntos. No cambiar ahora el control de Hortimatic 1.7 a la nueva tienda.
