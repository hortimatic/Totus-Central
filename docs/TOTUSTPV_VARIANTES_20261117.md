# Atributos de las variantes

17/11/2026. Desarrollo de rama, sin publicación.

El catálogo conserva los atributos nativos por separado: identidad del atributo y su grupo, nombre público del grupo y valor traducidos al idioma del puesto. El detalle de una combinación puede explicar «Color: Rojo · Tamaño: M», además de su nombre, existencias y precio nativos. Aparece tanto en tarjetas como en la tabla común. Los artículos que requieren elegir una combinación no muestran como propios los atributos de su variante de previsualización.

Se mantiene el nombre compuesto anterior para conexiones que no envían todavía este detalle. No se deducen grupos cortando nombres o separadores. El lector y el ticket conservan sus identidades nativas.

La consulta se limita a la combinación comprobada del producto, con idioma nativo y orden de grupos y atributos. Se admiten como máximo 64 atributos por combinación. El servicio expone únicamente sus cuatro campos públicos; el navegador valida tipos, límites e identidades repetidas y escapa el contenido al mostrarlo. No se envían costes ni datos privados como atributos.

La prueba de laboratorio atraviesa navegador, servicio y PrestaShop 8.2.8/MariaDB. Comprueba una variante disponible con existencias agregadas cero, atributos con grupo y nombre, móvil/escritorio y conservación del ticket, sin escrituras nativas durante las consultas. Son verificaciones aisladas, sin certificar hardware ni despliegue remoto.

Esta ampliación no cierra la selección completa por atributo, la configuración de orden inicial de combinaciones ni la revisión de todas las opciones de la ventana de variantes. Permanecen en el inventario de requisitos. No añade migraciones.

Validación terminada del bloque de atributos: 46 recorridos afectados aprobados, ocho pruebas del adaptador, once del handler y cinco de preferencias/presentación. Sintaxis PHP y paquetes de despliegue comprobados. Las capturas del laboratorio muestran el grupo y valor nativos en 390 y 1440 píxeles. Los originales de referencia permanecen privados.
