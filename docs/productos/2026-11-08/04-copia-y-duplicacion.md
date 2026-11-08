# Circuito: Copia entre tiendas y duplicación

Fecha: 8 de noviembre de 2026.

## Recorrido

Abrir origen; Copiar entre tiendas; elegir destino; seleccionar campos y combinaciones; adaptar referencia y textos; preparar borrador; comprobar coincidencias; si no existe, validar alta con idiomas y categoría del destino; crear base; mapear y guardar combinaciones; preparar y guardar galería; asociar fotos y revisar datos finales. Para duplicar en la misma tienda, usar Duplicar producto y una referencia nueva.

## Comprobaciones reproducibles

tests/productos-copy-circuit-browser-qa.mjs; tests/productos-image-copy-browser-qa.mjs; tests/productos-core-qa.mjs; tests/productos-existing-workspace-qa.mjs

## Resultado y alcance

Playwright crea una copia simulada en la segunda tienda con dos combinaciones, utilizando ID de atributos del destino y comprobando que el origen no cambia. La copia de fotos se comprueba por lectura autenticada y subida por etapas.

## Fallos y controles

Fallo encontrado y corregido: Seleccionar todo incluía active y bloqueaba el contrato de creación. La base sigue creándose inactiva; una activación seleccionada queda como etapa de revisión explícita. No se trasladan existencias. Las correspondencias ambiguas se resuelven manualmente; las únicas se verifican por referencia o grupo y valor.

## Registro de una prueba real

Anotar tienda, ID y referencia inicial, campos preparados, ID de petición, resultado del guardado, valores releídos y estado final. Sin esa evidencia no declarar este informe como verificación de escritura en producción.
