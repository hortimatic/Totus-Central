# Estabilización prioritaria — 15/11/2026

Instrucción de Diego: estabilizar y reparar Totus Central antes de aplicar trabajo offline o Totus TPV. Estudiar esos dos proyectos y explicar una estructura de construcción no autoriza considerarlos construidos ni integrarlos ahora. POSTPV sigue siendo el sistema de cobro en uso y no se retira durante esta corrección.

## Comprobación inicial y causas verificadas

Base publicada: 63c54bca4c4e29d608fee77c26b1a8ad552d242a. Sesión real en el dominio propio: apertura de la estructura de Productos, 3164 ms; regreso a Inicio, 1684 ms. Son dos observaciones de navegación, no percentiles ni tiempo de terminación de todas las consultas externas. No prueban que la carga general esté resuelta.

- La ficha leía stock de variantes, pero su resumen tomaba el total de catalogStock, una caché de las filas visibles del catálogo. Abrir una ficha directamente podía dejar el resumen sin consultar.
- Las combinaciones se leían una por una; el tiempo acumulaba cada viaje a la API.
- Cada respuesta de PrestaShop en Inicio reconstruía todo el tablero, incluido el calendario y los formularios ajenos a esa consulta.
- Volver a Inicio descartaba las lecturas de los resúmenes. Las respuestas antiguas podían retirar del mapa una petición nueva con la misma clave al terminar su finally.
- La comprobación de retiradas documentales esperaba a que terminaran todas las tablas antes de empezar, añadiendo una espera serial.
- La barra de periodos se partía por el crecimiento intrínseco de controles flexibles. Había además dos zonas de cabecera redundantes.

## Correcciones de este bloque

1. Stock de ficha calculado desde su propia lectura verificada: producto simple o suma de sus combinaciones, sin sumar también el padre nativo. Desglose visible de cada variante. Datos ausentes, ambiguos o fallidos no se convierten en cero.
2. Lecturas independientes de combinaciones con máximo de tres peticiones simultáneas. Conserva orden, verifica producto asociado y deja de programar lecturas al cambiar de selección o fallar.
3. Las respuestas de las consultas de Inicio actualizan solo widgets relacionados con PrestaShop. No reconstruyen el calendario ni el resto de tarjetas. Los controles con foco se conservan hasta terminar su interacción.
4. Memoria de lecturas de la sesión, solo para lectura: usuario/rol y conexión/revisión comprobados de nuevo antes de reutilizarla; hasta ocho consultas, 250 pedidos y 1500 líneas por entrada. Al entrar se actualiza automáticamente, con la lectura anterior marcada. No se persiste en disco y no habilita funcionamiento offline. Una conexión distinta o revisada no reutiliza el resultado anterior.
5. La consulta de retiradas entra en el mismo grupo máximo de cuatro lecturas; no se suprime su validación ni se amplía la concurrencia total.
6. Engranaje accesible de personalización, cabecera compacta y periodos en una fila con fechas debajo. Conserva editor, guardado, widgets y preferencias personales.
7. Comparación seleccionable de ventas de cada establecimiento en la gráfica de actividad, manteniendo las series totales. El selector de tienda y periodo sigue limitando los datos. Comparar no modifica las cifras contables.
8. El widget «Ganancia comercial» permite comparar el total y los márgenes de cada tienda. Usa los mismos pedidos/costes y conserva importes negativos y avisos de cobertura incompleta; no se presenta como beneficio neto.
9. Los enlaces de módulos y la entrada normal eliminan v y utm_* sin navegar de nuevo ni alterar los parámetros funcionales o el retorno de autenticación. release se conserva para compatibilidad. La URL directa es https://totuscentral.totuscode.com/?module=inicio. La redirección del alojamiento antiguo solo mantiene los enlaces antiguos; no forma parte del cambio interno entre módulos.

## Orden de trabajo restante

Cerrar este bloque con controles, publicación y comprobación de la versión realmente servida. Después revisar los módulos de uno en uno: Inicio y navegación; Productos (lectura, nuevo, edición, copia, imágenes, variantes, atributos); Ventas; Cajas; Gastos; Facturación; Documentos/Recepciones/Cotejos; directorios; tareas/chat; administración/permisos/configuración/automatizaciones; respaldo y recuperación. Por circuito anotar entrada, permisos, contexto de tienda/caja, escritura autorizada, relectura, error, respuesta tardía, salida/regreso y pruebas en pantalla estrecha y amplia. No declarar cumplida una escritura real por pasar un fixture.

Precio conectado a catálogo y cambios por familias queda identificado como ampliación pendiente: requiere compartir el catálogo verificado de la tienda y usar sus escrituras de precios existentes, vista previa de todos los afectados y relectura posterior. «Familia» debe corresponder a categorías, marca y/o agrupaciones concretas, nunca inferirse para publicar cambios masivos. No sustituir los estudios locales que ya funcionan. No se ha implementado esa ampliación en este bloque.

## Offline y Totus TPV: estudio, no implementación

Chats consultados: «TPV Offline Y Sincronización» (6af8d1d4-f470-83eb-b4fc-e8f28e8926dc) y «Arquitectura TPV independiente» (6af7378a-96c8-83eb-ae02-f651a4e48257). El primero describe una PWA y laboratorios; el segundo no acredita una venta completada y contrastada en PrestaShop. Sus mensajes no equivalen a código de producción validado. Los paquetes ZIP enlazados en sandbox de aquel chat no aparecen en las fuentes locales sincronizadas examinadas: no se declara haber revisado sus archivos.

Estructura para una fase futura:

- Catálogo compartido por conexión: productos, variantes, precios, stock, clientes y taxonomías con fecha/fuente/cobertura. Sin credenciales en el navegador. Sincronización por diferencias solo cuando la API lo permita, y conciliaciones completas para eliminados o cambios de stock no identificables por fecha de producto.
- PWA: archivos versionados y copia local autorizada por usuario/dispositivo; primera apertura con conexión, migraciones de IndexedDB, borradores y recuperación tras cerrar el navegador. No prometer persistencia física absoluta del almacenamiento del navegador.
- Cola de operaciones: identificador estable, estado pendiente/enviado/incierto/verificado, permisos revalidados, conflictos visibles y conciliación antes de reintentar una escritura incierta. No repetir ventas ni descuentos de stock.
- Totus TPV online antes de offline: tienda/caja/operador, producto simple y combinación, impuestos, cobros mixtos, cambio, devoluciones, apertura, retiradas, cierre y descuadre. Probar una venta de laboratorio completa, ID del pedido en PrestaShop, stock antes/después, diario en Totus e ingresos sin duplicar.
- Offline de caja después: cortes antes/durante/después del envío, dos dispositivos, sesión caducada, cambio de permisos, reinicio, cuota o borrado del almacenamiento, rechazo de stock y devolución. Numeración/documentos y requisitos fiscales deben validarse antes de emitir comprobantes oficiales desconectados.
- Retirada de POSTPV: solo tras validar el sustituto, exportar historial, mapear cajas/operadores y comprobar dependencias y reversión. Sin desinstalaciones ni instalaciones en las tiendas en este bloque.

Referencias técnicas consultadas: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation y https://devdocs.prestashop-project.org/8/webservice/resources/orders/. Documentan mecanismos, no certifican el funcionamiento de nuestras tiendas.
