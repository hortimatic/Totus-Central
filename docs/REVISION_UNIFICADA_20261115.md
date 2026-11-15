# Revisión unificada de interfaz y circuitos

Referencia anterior comprobada en el dominio: 65a7d674. Este documento describe el bloque del PR #203; comprobar su integración y `build-info.json` antes de considerarlo disponible. Los documentos anteriores conservan su valor histórico y no sustituyen este contraste.

## Criterio común aplicado

Las funciones equivalentes comparten presentación, tamaños de control, separación, retorno superior izquierdo y vocabulario. Se conservan los controladores nativos, permisos, perfiles y anchos guardados; no se reemplaza una escritura por un control genérico de consulta. Las tablas de edición contable mantienen sus campos y su orden funcional.

- Inicio: cuatro KPI simétricos; margen de las ventas en franja independiente. No descuenta gastos generales ni internos. Importe y porcentaje sobre venta de producto sin IVA, con cobertura explícita. Mantiene las cifras contables originales.
- Resúmenes: filtros y métricas en cuadrícula regular de dos columnas, quinto indicador completo, tarjetas de una fila con igual altura y botones al pie. Los nombres largos no alteran las filas de productos; el título conserva el nombre completo. La consulta muestra progreso y errores, con espacios de carga explícitos.
- Clientes: ambas tiendas también en Facturación. Identidad por tienda y cliente, sin mezclar IDs, idiomas ni direcciones. Crear y editar emplea el editor del origen; error parcial y respuesta tardía comprobados.
- Precio: catálogo nativo reutilizado desde Productos. Filtrar marca/categoría, seleccionar y revisar un lote de precios base; publicación secuencial y relectura. Una respuesta incierta detiene el lote y mantiene su solicitud. No modifica impactos de combinaciones ni ofertas.
- Perfil: documentos paginados en el servidor y ocultación reversible de la lista en el dispositivo, sin borrar autoría ni vínculos contables. La limitación local se indica en pantalla.
- Retornos: formulario de APIs arriba a la izquierda, enlace del catálogo en la ficha de producto y retirada de retornos secundarios duplicados de documentos/facturas.
- Paginación: corregido un desbordamiento de Productos/Precio en 320 px encontrado durante el recorrido ampliado, sin aviso previo del usuario.

## Evidencia local

81 baterías aprobadas con fixtures ficticios: creación, edición y copia de productos, imágenes y variantes, permisos, precios, respuesta perdida y recuperación, gastos, facturas, cierres, cotejos, documentos, informes/descargas, chat, tareas, apariencia, reloj, calendario, avisos web y copias. Artefactos: `artifacts/stability-final-20261115/results.json` y logs individuales. No son escrituras reales de producción.

Recorrido de 220 estados por clic en todos los módulos y pestañas/orígenes declarados, a 1640/1180/390/320. 52 sesiones de ventanas a 320/390/768/1440. Inicio comprueba recortes internos, límites de filtros, alturas de KPI y franja completa en diez tamaños, de 320 a 2560. Resúmenes contrastados en 905/1440/1920 con capturas específicas y posición de botones medida. El detector respeta los elementos realmente ocultos por details cerrados.

183 módulos JavaScript e importaciones comprobados, sin funciones duplicadas detectadas. Manifiesto de ocho servicios completo y sin cambios de servicios en este bloque. El generador de publicación requiere Python; se valida en CI Linux, ya que el entorno local solo tiene el alias de Windows.

Lectura real de la base anterior: versión y dirección limpia; margen mensual completado y perfil con consulta limitada. Estas lecturas no acreditan la presentación de la versión nueva hasta comprobar su despliegue.

## Límites que no deben convertirse en un cierre falso

Hortimatic 1.8, offline, Totus TPV y la API de pago siguen pausados por indicación de Diego. No se modifica PrestaShop ni se contratan servicios. El circuito solicitado en el chat para pedidos manuales de clientes con aviso al completar stock y el acceso de servicio POSTPV siguen constando como pendientes propios; no los resuelve una mejora visual ni una tarea ordinaria. La limpieza de documentos reales exige comprobar originales y vínculos antes de eliminar nada.

Supabase comprobado ACTIVE_HEALTHY. Sus avisos de funciones definer, políticas permisivas e índices se conservan para revisión específica: no se eliminan permisos ni índices por hacer desaparecer avisos. La protección de contraseñas filtradas requiere revisión de Auth y no se cambia desde esta actualización de interfaz.
