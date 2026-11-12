# Revisión de cumplimiento — 12 de noviembre de 2026

Resultado: NO se cumplen todavía todas las peticiones. Esta revisión no autoriza marcar pendientes como terminados ni publicar funciones a medias.

## Estado contrastado

La web pública responde con commit `bef6e762e6266f153545436dd85c3a749328c320` (#188). El PR #189 está abierto como borrador, sin integrar. Los parches 076/077 no están aplicados en producción. El código de directorios de #189 no es aún una función disponible en la web pública.

| Nº | Petición | Estado | Evidencia y falta concreta |
|---|---|---|---|
| 1 | Reloj: color y personalización | Publicado parcial | Color publicado en #185. Faltan controles específicos de tamaño, diseño y funciones de reloj/calendario. |
| 2 | Clientes por tienda | En desarrollo #189 | Tabla completa, columnas, alta/edición, pedidos y margen implementados y probados de forma aislada. Faltan editor completo de direcciones conservando historia, grupos, recorrido integrado de cuenta/permisos y publicación. |
| 3 | Proveedores por tienda | En desarrollo #189 | Directorios y proveedores secundarios consultables; no está cerrado el enlace explícito con el proveedor fiscal de Totus ni la edición completa de direcciones. |
| 4 | Orden de navegación | Pendiente | Sigue la agrupación anterior en config.js; no se ha entregado la reorganización solicitada. |
| 5 | Atributos sincronizados | Publicado parcial + desarrollo #189 | Consulta/asociados publicados. Alta, edición y borrado independientes del producto añadidos en #189. Revisión detectó y corrigió cachés de selectores desactualizadas; falta publicación. |
| 6 | Gastos recurrentes y previsión | Pendiente | No existe todavía el circuito completo de frecuencia, vencimiento, aviso e historial sin duplicar el asiento. |
| 7 | Módulo Ventas independiente | Pendiente | Pedidos y ventas sigue dentro de PrestaShop; no existe aún la ruta independiente solicitada. |
| 8 | Margen en pedidos de Inicio | Publicado #185 | Comparte el cálculo y distingue cobertura incompleta. No acredita automáticamente los pedidos sin coste disponible. |
| 9 | Vendedor del pedido | Pendiente de fuente | Existe lectura de registros nativos de empleados, pero falta demostrar la relación POSTPV pedido-vendedor para todas las ventas y ambas tiendas. Nunca inferir por horario. |
| 10 | Alineación de periodos | Publicado #185 | Filtros adaptados y probados en varios tamaños. |
| 11 | Medios de pago | Publicado #185 | Opciones derivadas de los datos recibidos de la tienda, incluidos otros pagos si aparecen. |
| 12 | Margen del resumen | Publicado #185 | Cálculo y cobertura implementados. No confundir con beneficio neto. |
| 13 | Datos de calidad en Inicio | Publicado #186 | Cobertura, recuentos y acceso al diagnóstico. |
| 14 | Fecha automática | Publicado #185 | Periodos relativos actualizados; las fechas manuales se conservan. |
| 15 | Fotos y datos de más vendidos | Publicado #185 | Representación de foto, referencia, variante y unidades con acceso a ficha. |
| 16 | Ganancia en gráfica | Publicado parcial #188 | Hay gráfica propia de margen; falta terminar la integración pedida sobre la gráfica contable original sin mezclar conceptos. |
| 17 | Gestión clara de atributos | Publicado parcial + desarrollo #189 | Nueva edición independiente añadida; no declarar el punto cerrado antes de integración y publicación. |
| 18 | Categorías en árbol | Publicado #185 | Padres/hijos, búsqueda, múltiples asociadas y principal explícita. |
| 19 | Calidad práctica del catálogo | Publicado #186 | Diagnósticos que abren productos afectados. |
| 20 | Información del catálogo con avisos | Publicado #186 | Totales, alcance y fecha de lectura; estados no consultados explícitos. |
| 21 | Simetría y ajuste de tarjetas | Publicado parcial #188 | Títulos/subtítulos alineados. Falta contraste completo de tarjetas y tamaños del contenedor. |
| 22 | Calendario de tareas | Publicado #188 | Día/semana/mes y apertura de fecha en Tareas, con pruebas a cinco anchuras. |
| 23 | Eliminar acceso duplicado a proveedores | Pendiente condicionado | No retirarlo antes de sincronizar y contrastar los vínculos fiscales existentes. |
| 24 | Marcas por tienda | En desarrollo #189 | Lectura, tabla, edición/alta/borrado y relaciones implementadas; ciclo nativo aislado verificado. Falta integración final y publicación. |
| 25 | Caja del pedido | Pendiente de fuente automática | No se ha acreditado aún una relación automática estable pedido-apertura/cajón para Hortimatic y NewOldSmok. PR #181 no equivale a funcionalidad terminada. |
| 26 | Ampliación de Mi cuenta | Pendiente | La ficha anterior existe, pero no se ha entregado la ampliación de datos y organización de notas solicitada. |
| 27 | HTTP 401 de nueva Hortimatic | Pendiente importante | No resuelto. La tarjeta está desactivada/sin verificar. No sustituir la conexión operativa de Hortimatic 1.7. |
| 28 | Nueva tienda disponible en módulos | Pendiente importante | Persisten dos identidades de tienda fijas en las rutas actuales. Una API nueva no se incorpora automáticamente a todas las operaciones. |

## Comprobaciones de esta revisión

- 34 pruebas dirigidas correctas de contratos, transporte, permisos, sesión, altas, edición, borrado, ventas por cliente e invalidación de catálogos.
- Playwright de directorios: búsqueda completa, paginación, columnas, persistencia, creación, edición, consulta de pedidos y eliminación, con API simulada en cinco anchuras.
- Playwright de atributos: alta/edición, cancelar sin perder los datos y confirmación de eliminación en cinco anchuras; API simulada.
- Ciclo contra PrestaShop 1.7.8.11 desechable correcto para cliente, dirección, marca y grupo/valor de atributo. No son escrituras en las tiendas reales.
- Se corrigió un hueco de integración: los atributos publicados desde su pestaña deben invalidar también los catálogos de los selectores de Productos y los asistentes, sin borrar propuestas pendientes ni datos de otra tienda. Prueba de regresión añadida.
- El control general del commit 4a3f6f1 falló al arrastrar una columna. Se reprodujo el recorrido local a 390/680/969/1280/1920/2560 px y pasó; esto no demuestra corregida la causa del fallo de CI. Se añadió diagnóstico de anchura y debe verificarse en el siguiente control.

## Orden conservado

Terminar los circuitos de directorios y atributos; cerrar navegación, Ventas y gastos recurrentes; ampliar Mi cuenta y reloj/calendario; completar parciales; resolver y verificar vendedor/cajón; retirar solo duplicados contrastados; consolidar manuales y probar sus recorridos integrados. Después desarrollar los puntos 27 y 28. El escrito más amplio de infraestructura se tratará con el estado real de estos puntos, sin cambiar todavía el control de Hortimatic 1.7 a la nueva tienda.

## Fuentes y documentación

Este documento está en docs del repositorio. No se ha verificado su carga en Fuentes del proyecto ChatGPT. Los documentos sincronizados de sources son de solo lectura y no se han modificado.

## Correcciones adicionales de la revisión

Se añadieron límites nativos de nombres y metadatos antes de enviar altas a las tiendas. También se corrigió el aviso posterior al guardado de atributos: una publicación verificada seguida de un fallo de refresco conserva y comunica el éxito de la escritura y el fallo de la lista por separado, sin repetir el alta. La simulación de ese fallo pasa en las cinco anchuras. Estas correcciones no cierran los pendientes de la matriz ni convierten el borrador en una publicación.
