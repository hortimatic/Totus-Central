# Circuito: Añadir combinaciones a un producto simple

Fecha: 8 de noviembre de 2026.

## Recorrido

Abrir ficha real; Variaciones y atributos; Añadir combinación; consultar atributos de la tienda; Añadir combinaciones; seleccionar valores pertenecientes al grupo; rellenar referencia e impactos de precio/peso; validar etapa; guardar; releer y comprobar asociación con el padre exacto.

## Comprobaciones reproducibles

tests/productos-copy-circuit-browser-qa.mjs; tests/productos-stages-qa.mjs; tests/productos-existing-actions-browser-qa.mjs; tests/prestashop-sandbox/live-product-qa.mjs

## Resultado y alcance

Playwright recorre un producto simple y le añade una combinación a 390/1440. Las pruebas nativas aisladas verifican el POST sobre producto existente, padre, atributos y reintentos sin duplicar.

## Fallos y controles

No tratar el impacto de precio como PVP total. No copiar ID de atributos de otra tienda. Una combinación de atributos ya existente se identifica antes de intentar duplicarla. La predeterminada se elige por su propio circuito.

## Registro de una prueba real

Anotar tienda, ID y referencia inicial, campos preparados, ID de petición, resultado del guardado, valores releídos y estado final. Sin esa evidencia no declarar este informe como verificación de escritura en producción.
