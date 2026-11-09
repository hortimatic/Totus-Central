# Columnas personales y adaptación de Productos

## Uso

- Arrastrar el borde derecho de una cabecera ajusta solo esa columna. Con el separador enfocado, flechas izquierda/derecha cambian 10 px; Mayúsculas cambia 1 px. Doble clic recupera el ancho inicial de esa columna. «Restablecer anchos» recupera todos los anchos iniciales.
- La rueda de columnas permite marcar campos, arrastrar su asa, elegir una posición exacta o usar las flechas. El asa admite Alt + arriba/abajo. Se conserva la columna de nombre para identificar los productos.
- Anchos y columnas se guardan automáticamente en el perfil autenticado, sin caducidad ni temporizador de borrado. Se recuperan al abrir el módulo, también desde otro navegador. El guardado local permite seguir trabajando si falla la conexión; el panel indica sincronización pendiente y ofrece «Guardar distribución» para repetirla.
- Las vistas locales incluyen ahora los anchos. Cambiar de vista aplica sus anchos cuando están definidos; las vistas anteriores siguen siendo válidas.
- El ajuste visual no cambia precios, existencias ni fichas. La preferencia solo se guarda para la cuenta autenticada y requiere poder ver Productos. Las otras preferencias del perfil se conservan.

## Adaptación y ayudas

El módulo usa el espacio disponible, con la barra lateral abierta o plegada. Los filtros cambian de disposición según el ancho del módulo, no solo el de la pantalla. Las acciones se distribuyen sin estirar todos los botones a cajas grandes. La tabla mantiene desplazamiento horizontal propio; las columnas no quedan fijadas. Las ayudas se alinean junto a las cabeceras, con altura uniforme y nombres cortos. Los permisos de todos los módulos tienen título y descripción con el mismo formato; no se cambian privilegios.

## Verificación

Prueba dirigida en 390,680,969,1280,1920 y2560 píxeles: arrastre y teclado, reordenación directa/arrastre/teclado, guardado y recuperación con almacenamiento local vaciado, alineación de ayudas, filtros dentro del módulo y ausencia de escritura de productos. Matriz de permisos en390/969/1920: todas las descripciones presentes y circuito de guardar/restablecer conservado. PostgreSQL aislado comprueba cuenta propia, permiso, validación de columnas/anchos y conservación del resto del perfil. El informe de publicación distingue estos resultados de una escritura real de producto.
