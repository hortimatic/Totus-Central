# Circuito: Alta de producto con combinaciones

Fecha: 8 de noviembre de 2026.

## Recorrido

Elegir tienda; Nuevo producto; completar información, textos, precio y SEO; preparar destino; consultar idiomas y categorías; validar alta; confirmar CREAR; crear base; consultar atributos; crear cada combinación con atributos de destino; subir fotos y asociarlas; ajustar existencias propias; revisar publicación y compras.

## Comprobaciones reproducibles

tests/productos-ui-browser-qa.mjs; tests/productos-create-ui-qa.mjs; tests/productos-create-qa.mjs; tests/prestashop-sandbox/live-product-qa.mjs

## Resultado y alcance

Simulación de base, combinación, existencias, PNG transparente y descripción visual a 390/768/1440. La comprobación nativa aislada realiza POST y relectura. La evidencia de tienda comercial de esta revisión se registra por separado.

## Fallos y controles

No repetir POST tras pérdida de respuesta. Conservar UUID y comprobar referencia dos veces en la recuperación explícita. No publicar como completado un campo no acreditado.

## Registro de una prueba real

Anotar tienda, ID y referencia inicial, campos preparados, ID de petición, resultado del guardado, valores releídos y estado final. Sin esa evidencia no declarar este informe como verificación de escritura en producción.
