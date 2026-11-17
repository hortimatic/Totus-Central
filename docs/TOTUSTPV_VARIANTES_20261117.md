# Atributos de las variantes

17/11/2026. Desarrollo de rama, sin publicación.

El catálogo conserva los atributos nativos por separado: identidad del atributo y su grupo, nombre público del grupo y valor traducidos al idioma del puesto. El detalle de una combinación puede explicar «Color: Rojo · Tamaño: M», además de su nombre, existencias y precio nativos. Aparece tanto en tarjetas como en la tabla común. Los artículos que requieren elegir una combinación no muestran como propios los atributos de su variante de previsualización.

Se mantiene el nombre compuesto anterior para conexiones que no envían todavía este detalle. No se deducen grupos cortando nombres o separadores. El lector y el ticket conservan sus identidades nativas.

La consulta se limita a la combinación comprobada del producto, con idioma nativo y orden de grupos y atributos. Se admiten como máximo 64 atributos por combinación. El servicio expone únicamente sus cuatro campos públicos; el navegador valida tipos, límites e identidades repetidas y escapa el contenido al mostrarlo. No se envían costes ni datos privados como atributos.

La prueba de laboratorio atraviesa navegador, servicio y PrestaShop 8.2.8/MariaDB. Comprueba una variante disponible con existencias agregadas cero, atributos con grupo y nombre, móvil/escritorio y conservación del ticket, sin escrituras nativas durante las consultas. Son verificaciones aisladas, sin certificar hardware ni despliegue remoto.

El primer bloque de atributos no cerraba la ventana de selección. La ampliación descrita a continuación incorpora esa ventana; la configuración del orden inicial y la revisión del resto de opciones siguen en el inventario de requisitos. No añade migraciones.

Validación terminada del bloque de atributos: 46 recorridos afectados aprobados, ocho pruebas del adaptador, once del handler y cinco de preferencias/presentación. Sintaxis PHP y paquetes de despliegue comprobados. Las capturas del laboratorio muestran el grupo y valor nativos en 390 y 1440 píxeles. Los originales de referencia permanecen privados.

## Ventana de selección y ordenación por atributo

Al pulsar un producto con variantes en Venta, se abre un diálogo con su nombre y las combinaciones disponibles. Usa la tabla y el panel de columnas comunes de Central. En móvil, la vista inicial muestra tarjetas con existencias y precio; se puede cambiar a tabla, fotos, compacta o lista. La elección de vista se conserva mientras se usa el puesto.

«Atributo para ordenar» permite elegir un grupo nativo del producto, como Color o Tamaño. «Orden» permite recorrerlo de A a Z o de Z a A, por existencias, precio o referencia. El servidor ordena el conjunto completo antes de paginar. El grupo no filtra combinaciones: todas siguen en el resultado, con sus atributos completos. Sólo admite grupos pertenecientes al producto y contexto de tienda consultados.

Elegir una combinación con unidades la añade al ticket y cierra la ventana. Volver a productos o Escape cancela la selección y mantiene la venta. Se restaura el orden del catálogo anterior; ordenar variantes no cambia su preferencia general. Los precios siguen procediendo del cálculo nativo y la selección respeta la política de existencias vigente.

Ante un fallo de consulta, el diálogo muestra el error y no presenta filas anteriores como combinaciones. Si cambia un atributo en la tienda, se indica cómo volver a seleccionar el artículo. La selección de variantes de entrada de mercancía conserva su recorrido separado.

Pruebas del selector: 46 recorridos de regresión aprobados y uno adicional específico en 390/1440 píxeles; ocho controles de estabilidad. El recorrido nativo comprueba dos grupos y 23 combinaciones, con 20 resultados en la primera página y tres en la segunda, grupo ajeno rechazado, orden ascendente/descendente, diálogo modal, Escape, selección y ticket conservado. La prueba aislada de interfaz comprueba además fallo de lectura sin filas falsas, variante agotada bloqueada y restauración del orden. No son una publicación remota ni una certificación física.
