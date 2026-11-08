# Circuito: Modificación de producto existente y archivo

Fecha: 8 de noviembre de 2026.

## Recorrido

Identificar fila; Editar fila; elegir idioma si procede; editar solo los datos necesarios; Revisar; abrir diferencias; Guardar cambios; releer. Para archivo, Archivar (desactivar), revisar los tres cambios y guardar. Para recuperar, editar activo, visibilidad y permiso de compra desde la ficha.

## Comprobaciones reproducibles

tests/productos-table-browser-qa.mjs; tests/productos-table-editor-qa.mjs; tests/productos-write-qa.mjs; tests/productos-remove-product-qa.mjs

## Resultado y alcance

Playwright simula edición/guardado/relectura, archivo, duplicado de borrador y eliminación/ausencia a 390/768/1440. Comprueba también teclado, búsqueda en selectores y preferencias visuales. Las pruebas de transporte validan huella, conflictos y relectura.

## Fallos y controles

Una huella obsoleta no debe sobrescribir otro trabajo. Un PUT incierto conserva la misma petición. DELETE requiere confirmar el ID, detecta solo HTTP 404 como ausencia y no se repite automáticamente.

## Registro de una prueba real

Anotar tienda, ID y referencia inicial, campos preparados, ID de petición, resultado del guardado, valores releídos y estado final. Sin esa evidencia no declarar este informe como verificación de escritura en producción.
