# Centro PrestaShop · contrato, estado y continuidad

Revisión: 04/11/2026. Base publicada revisada: `1043b77` (PR #115 y #116).
Este documento diferencia el lector publicado de la ampliación propuesta en la rama `feature/prestashop-workspace-20261104`. La rama no acredita publicación.

## Estado real observado

- Dominios confirmados por Diego: https://hortimatic.com/ y https://newoldsmok.com/; ambos Webservice en `/api`.
- Ambas tiendas actuales: PrestaShop **1.7.8.11**, versión comunicada por Diego. PrestaShop 8 está en preparación, sin versión ni fecha de sustitución confirmadas.
- El 04/11/2026 se probó el lector publicado de Hortimatic desde la sesión autorizada de Totus: devolvió 25 pedidos. No se alteraron datos.
- NewOldSmok figuraba desactivada y sin prueba registrada. No está verificada su lectura comercial.
- Una prueba de raíz Webservice no acredita pedidos, productos, detalle, TPV ni cierres. Las nuevas lecturas de esta rama necesitan contraste con la instalación real tras desplegar su servicio.

## Ampliación de esta rama

- Módulo independiente PrestaShop en Operaciones tienda. Se conserva su acceso desde Configuración para compatibilidad; reutiliza un único componente y el mismo gestor de claves.
- Selector permanente de tienda y cinco zonas: Resumen, Pedidos y ventas, Catálogo, Cajas y facturas, Conexión.
- Fechas y horas, orden reciente/antiguo, paginación acumulativa y búsqueda en lo ya consultado. Vista compacta/cómoda y columnas seleccionables durante la sesión.
- Pedidos desplegables: importes, pago, validez, estado de origen, referencia y fecha; detalle bajo demanda con productos, variantes, cantidades, cliente y direcciones disponibles. Datos opcionales denegados no ocultan líneas comprobadas.
- Indicadores y gráfico horario de pedidos válidos **consultados y con moneda EUR verificada**. Una moneda no comprobada no se presenta como euros ni se mezcla en el resumen. Una página incompleta se etiqueta como parcial. No se interpreta como cierre, venta neta de devoluciones ni beneficio.
- Catálogo: referencias, nombres multidioma, EAN y peso, avisos y exportación. Un aviso a nivel producto no acredita que falte el dato en todas las combinaciones.
- Claves privadas permanecen en el servidor. No hay SQL libre, claves en URL ni cambios de negocio en PrestaShop.
- El registro de llamadas guarda únicamente tienda, recurso, página y número de filas; los nuevos datos personales no se copian al registro de consumo.
- Personalización de navegación por cuenta: orden de módulos dentro de su sección, secciones plegadas al inicio, fondo/texto/título/selección. El parche 061 amplía solo validación visual; no cambia los permisos ni la propiedad del perfil.

## Recursos y contrato de lectura

Acción `prestashop_read` de `totus-connections`, sesión administradora y permiso actual de Configuración. Se conserva esta autorización: no se abre el módulo a otros roles mediante una preferencia visual.

Recursos permitidos: `orders`, `products`, `order_details`, `customers`, `addresses`, `currencies`, `stock_availables`, `stock_movements`. Campos explícitos, tamaño de página 1–100, páginas acotadas, HTTPS validado, credencial Basic en cabecera, sin redirecciones. `customers`, `addresses` y `currencies` exigen un ID concreto; `order_details` exige pedido. No se exponen contraseñas, claves seguras de clientes ni costes de compra.

Los filtros temporales se envían como `filter[date_add]` y `date=1`, con horas tal como están registradas en PrestaShop. Debe contrastarse el huso real de las tiendas antes de automatizar jornadas de Madrid. Se rechaza un resultado fuera del periodo o perteneciente a otro pedido/registro. No se mezcla una página consultada con filtros nuevos.

## Costes de variantes

Diego comunica un redondeo de coste como 3,90 → 3 al guardar variantes. Es una incidencia de la instalación origen **no reproducida ni corregida por esta rama**. El módulo no importa costes ni ofrece beneficio neto a partir de ellos. Cuando haya una fuente fiable (factura, recepciones o Pricing validado), podrá añadirse margen identificado por fuente y fecha. No corregir costes masivamente sin localizar y probar la causa del guardado.

## Cajas y errores efectivo/tarjeta

El contrato lógico TPV existente no es un adaptador conectado. Faltan nombre/versión instalada, columnas, lectura de cierres/retiradas y mapeo verificado de cajones Vape/Head/NewOldSmok.

Requisitos de importación: origen estable por tienda/cajón/cierre, idempotencia, céntimos exactos, horario y anulaciones comprobados, estado de conciliación y prueba frente a un cierre real. Las salidas y el efectivo dejado continúan manuales. No derivar cierres de una simple suma de pedidos.

La reclasificación efectivo/tarjeta debe mantener el total vendido, preservar el original y registrar importe, motivo, autor y fecha. Hay función y pruebas aritméticas, **todavía no una operación persistente conectada a Cajas**. No generar ventas ficticias para compensar diferencias.

## Tickets y Facturación

Referencia propuesta: `prestashop:<tienda>:order:<id>`, distinta del número fiscal. En esta rama solo se prepara la referencia y se accede a Facturación; no crea ni emite una factura automáticamente.

Antes de habilitar emisión: verificar si el origen es ticket sin documento fiscal, factura simplificada o factura completa; conservar número/serie/fecha originales; vínculo único en servidor para impedir duplicados; mismo emisor y moneda; líneas/impuestos/descuentos contrastados; tratamiento de ingresos ya incluidos en Cajas y devoluciones. El número Totus lo asignará atómicamente la serie al emitir. No renumerar facturas antiguas ni tratar diferentes series como un defecto por sí mismas.

La AEAT exige correlatividad **dentro de cada serie**. Para sustitución de simplificadas describe identificación de número, serie y fecha de los documentos sustituidos. El flujo definitivo debe contrastarse con el tipo real de documento de estos TPV.

Referencias oficiales:
- https://sede.agenciatributaria.gob.es/Sede/iva/sistemas-informaticos-facturacion-verifactu/preguntas-frecuentes/procedimientos-facturacion.html
- https://www3.agenciatributaria.gob.es/Sede/iva/facturacion-registro/facturacion-iva/contenido-facturas.html
- https://devdocs.prestashop-project.org/1.7/webservice/resources/orders/
- https://devdocs.prestashop-project.org/1.7/webservice/resources/order_details/
- https://devdocs.prestashop-project.org/1.7/webservice/resources/products/

## Pruebas y despliegue

Pruebas de contrato/servicio/insights: recursos, autorización, dos tiendas, periodos, céntimos, clasificación, duplicados, URI y campos privados. Playwright: 390/768/1017/1440 px, detalle desplegable, búsqueda, vista, paginación, error/reintento y aislamiento entre usuarios/tiendas. Prueba de preferencias en 390/1017 px, y SQL de aislamiento/revisión en CI. Todos estos recorridos usan fixtures ficticios, no certifican recursos reales nuevos.

Orden de despliegue tras controles: parche 061 de preferencias, servicio `totus-connections` con ambos contratos, frontend. El servicio conserva compatibilidad con lecturas antiguas sin filtro temporal. Comprobar la versión publicada y repetir una consulta de Hortimatic con fecha conocida, detalle y producto. Si un recurso falla, mostrar su error y no activar importación TPV.

## Lista de siguientes tramos (no terminados)

1. Contraste real de pedidos/detalle/catálogo nuevos por cada tienda; NewOldSmok permanece pendiente.
2. Adaptador y correspondencia del TPV; importar cierres idempotentes al módulo Cajas y persistir reclasificaciones.
3. Ventas por producto, variantes y devoluciones; rankings incluyendo productos con cero ventas.
4. Antigüedad de stock por entradas verificadas, rotación y producto recomendado con explicación, sin coste dudoso.
5. Programaciones persistentes, historial de ejecuciones y reintentos por tienda.
6. Vínculo fiscal único con Facturación y pruebas de no duplicación de ingresos.
7. Perfiles independientes para futuras instalaciones PrestaShop 8 y cambio de origen validado.


## Consultas existentes aportadas por Diego
La captura del gestor SQL muestra 20 de 21 consultas. Se ha añadido una biblioteca con esas 20 referencias y disponibilidad explícita. Las recetas de catálogo operan sobre las páginas leídas: los duplicados y recuentos no se presentan como totales hasta terminar la lectura. La consulta de ventas permite distinguir un intervalo continuo de una ventana horaria repetida cada día; por ejemplo 20:00–20:30.

La captura confirma la referencia a `psog_posp_cajas` y `date_add`, pero no sus columnas ni la correspondencia de cierres, retiradas y medios de pago. No basta para importar cierres. Las consultas con idioma 1 y tienda 1 necesitan contraste por instalación. Un impacto de combinación cero no es precio final cero. Las valoraciones con factores fijos 1,21 y 1,262 requieren impuestos reales y costes fiables, por lo que no se presentan como beneficio real. No se ha habilitado ejecución libre de SQL.
