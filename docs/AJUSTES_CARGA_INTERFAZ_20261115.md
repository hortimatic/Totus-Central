# Carga, controles comunes y ganancia estimada

Bloque del PR #205, todavía sujeto a CI y publicación. La base contrastada es 5d05fffe; no presentar este texto como prueba de despliegue. Los circuitos del asistente y sus pruebas reales se documentan en RECORRIDOS_ASISTENTE_20261115.md.

## Causas de espera localizadas y tratamiento

- La caché de Inicio rechazaba resultados con más de 250 pedidos: el mes de trabajo observado superaba ese límite y se releía al regresar. Admite ahora hasta 2000 pedidos y 10000 líneas por lectura, con presupuesto conjunto máximo de 4000 pedidos, 20000 líneas y ocho entradas. Solo memoria de la sesión, separada por usuario/rol, conexión/revisión, tienda y periodo; se limpia al cambiar identidad. No añade almacenamiento Supabase ni conserva documentos.
- Durante dos minutos se reutiliza una lectura reciente y verificada sin releerla; una lectura caducada se presenta mientras se actualiza. Actualizar fuerza la consulta. El estado anterior no debe permanecer etiquetado como «actualizando» si se ha utilizado una lectura reciente sin trabajo pendiente.
- La ganancia esperaba también al historial de vendedores. Los costes verificados se publican y se conservan antes de esa consulta independiente. Una entrada de caché que solo tiene costes no se presenta como historial de vendedores completado ni se utiliza como sustituto de esa comprobación en Pedidos.
- Se consultaban combinaciones aunque el pedido ya tuviese su coste de compra registrado. El recorrido de ganancia utiliza primero purchase_supplier_price u original_wholesale_price positivos y consulta la combinación cuando ese dato falta. El resto de lectores conserva su comportamiento. Los datos actuales de catálogo son una alternativa estimada, no una reconstrucción garantizada de la factura histórica.

Pruebas locales: lectura reciente reutilizada, caducidad y actualización, revisiones de conexión, cambio de usuario, conservación de filtros y vendedores, coste histórico frente a coste de catálogo cambiado, consultas de variantes acotadas y cancelación al navegar. No se afirma una mejora medida de tiempo en producción antes de contrastar la publicación. La primera carga sin datos previos todavía necesita consultas nativas; no se anuncia como instantánea.

## Cálculo solicitado por Diego

La tarjeta **Ganancia de las ventas** estima:

`ingresos cobrados con IVA − coste neto de mercadería × (1 + IVA compra/100 + recargo/100)`.

El coste respeta cantidades y combinaciones. Ejemplo ficticio: 10 netos, IVA 21 %, recargo 5,2 % → 12,62 de coste; 20 ingresados → 7,38 antes de otros gastos. Mantiene pérdidas. El porcentaje usa como denominador esos ingresos cobrados.

Los ingresos del pedido incluyen portes cobrados; no se deducen costes de transporte, gastos generales ni internos. No se presenta como beneficio neto fiscal. Usa purchase_vat_rate cuando está configurado; si falta, el tipo general default_sales_vat_rate de Totus como **estimación explícita** y purchase_re_rate. No inventa un tipo cero si falta configuración; faltantes de costes o datos producen cobertura parcial/pendiente. La factura de compra y sus tipos reales prevalecen cuando se disponga de esa correspondencia.

Este cálculo es independiente de «Ingresos menos gastos». Tampoco cambia silenciosamente el margen comercial sin impuestos de las demás tablas y gráficos. Ambos criterios deben mantener nombre y explicación propios.

## Interfaz

- Las cinco tarjetas financieras comparten altura y distribución adaptada. En edición se mantienen los controles originales de diseño, sin sobrescribir las preferencias guardadas.
- Se retira la regla global que imponía height/min-height importantes y hacía depender la geometría del contenido. El detalle del cálculo se despliega sin alargar la fila de indicadores.
- Columnas de tablas de consulta: barra propia con espaciado común y alineación, no botón pegado al borde. Conserva selección, orden, cuenta y persistencia; no manipula formularios contables editables.
- Precio: Catálogo PrestaShop y Estudios de Totus en la cabecera, sin otra franja de pestañas. Se retira Proveedores de esa cabecera; las referencias de proveedores propias de los estudios anteriores siguen accesibles en un apartado secundario, sin borrar costes ni operaciones existentes.
- Columnas del widget Pedidos: casillas de 18 px, etiqueta en la misma fila y acciones compactas. Se corrige la regla genérica de campos del panel que las convertía en controles de ancho completo.

Se han probado 220 estados por clic en módulos/pestañas a 1640, 1180, 390 y 320 px. La geometría de las tarjetas se contrasta en diez tamaños; las casillas en 390/905/1920. Se conservan las pruebas integrales de Precio y sus referencias, columnas compartidas, informe contable y acciones de Inicio. Revisar los resultados de CI del último commit, no reutilizar los de una revisión anterior.

## Catálogos persistentes: aplazados expresamente

Diego ha pedido dejar este sistema para después. No se han creado tablas de réplica, cron de catálogo, webhooks, módulos de PrestaShop ni infraestructura nueva. Las correcciones de este bloque no dependen de IA ni de un servicio de modelo de pago.

Si se retoma, antes de activar: medir un catálogo piloto, espacio de datos e índices, consultas y tiempo; conservar solo campos necesarios y enlaces de imágenes, no duplicar binarios; definir permisos por tienda, caducidad, borrados, revisión de cambios y retorno al acceso existente. Un producto tiene date_upd, pero stock/combinaciones/eliminaciones no deben asumirse cubiertos por el cambio de fecha de la ficha. No prometer avisos externos nativos ni cambiar tiendas para obtenerlos sin autorización. La futura configuración y recuperación deben ser utilizables desde Totus por el cliente, sin SQL manual ni asistencia de IA obligatoria.
