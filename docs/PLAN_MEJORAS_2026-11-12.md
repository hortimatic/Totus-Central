# Registro de trabajo — 12 de noviembre de 2026

Este registro recoge las 26 anotaciones de Diego. Pendiente significa pendiente: no acredita implementación, prueba ni publicación. No sustituir componentes validados, borrar maestros reales ni modificar tiendas para ampliar la API. Los archivos sincronizados de `sources/` son de solo lectura; la publicación en Fuentes debe comprobarse por separado.

## Orden y criterios de aceptación

| Nº | Petición | Entrega verificable | Estado inicial |
|---|---|---|---|
| 1 | Color del reloj | Hereda Texto de cabecera de Interfaz y persiste tras recargar | Implementado/comprobado en local; sin publicar |
| 2 | Clientes por tienda | Lectura completa, tabla configurable, ficha editable, direcciones, pedidos, gasto y margen, publicación y relectura | Pendiente |
| 3 | Proveedores por tienda | Mismo patrón; separar proveedor comercial PrestaShop del fiscal de Totus sin perder relaciones | Pendiente |
| 4 | Navegación | Secciones coherentes conservando orden y preferencias personales existentes | Pendiente |
| 5 | Atributos por tienda | Pestaña propia, grupos y valores, asociados, crear/editar/eliminar y releer | Pendiente |
| 6 | Gastos recurrentes | Previsión, frecuencia, vencimientos, avisos configurables e historial sin duplicar gasto contabilizado | Pendiente |
| 7 | Ventas | Módulo con resúmenes, pedidos, pagos, márgenes, filtros y avisos por tienda reutilizando Automatizaciones | Pendiente |
| 8 | Margen en pedidos de Inicio | Cálculo compartido con Pedidos y ventas, cobertura y unidades coherentes | Implementado/comprobado en local; sin publicar |
| 9 | Atendido por en Inicio | Evidencia de pedido/empleado; no inferir por coincidencia de horario | Pendiente de fuente TPV |
| 10 | Filtros de periodo | Alineados en móvil, tableta y escritorio sin desbordar | Implementado/comprobado en local; sin publicar |
| 11 | Medios de pago | Mostrar todos los recibidos de la tienda, incluidos Bizum/transferencia cuando existan | Implementado/comprobado en local; sin publicar |
| 12 | Margen comercial resumen | Reutilizar cálculo real, distinguir parcial, cero y falta de datos | Implementado/comprobado en local; sin publicar |
| 13 | Calidad de catálogo Inicio | Mostrar cobertura, recuentos y acción útil para consultar incidencias | Pendiente |
| 14 | Fecha automática | Periodos relativos actualizados; fechas elegidas manualmente conservadas | Implementado/comprobado en local; sin publicar |
| 15 | Más vendidos | Foto, referencia, variante y unidades con enlace a ficha | Implementado/comprobado en local; sin publicar |
| 16 | Gráfica | Separar margen comercial de ingresos menos gastos y beneficio neto | Pendiente |
| 17 | Gestor de atributos | Sustituir modal confuso por navegación clara grupo → valores → productos | Pendiente |
| 18 | Categorías | Árbol padre/hijos buscable, múltiples asociadas y principal explícita | Implementado/comprobado en local; sin publicar |
| 19 | Calidad práctica | Filtros de incidencias que abren productos afectados y permiten corregir | Pendiente |
| 20 | Avisos de catálogo | Totales, alcance y fecha de última lectura; no guiones sin explicación | Pendiente |
| 21 | Simetría Inicio | Tipografía, alturas y saltos de línea adaptados al contenedor | Pendiente |
| 22 | Calendario tareas | Día/semana/mes integrado en el widget sin aumentar su ancho | Pendiente |
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
