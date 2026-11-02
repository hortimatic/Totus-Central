# Recepciones desde cualquier conexión de IA

El usuario técnico de cada conexión firma sus acciones. Todas usan el mismo catálogo y procedimientos de negocio; no se sustituye una IA por otra ni se omiten permisos.

## Recorrido

1. Consultar tiendas y localizar los originales. La búsqueda admite el nombre de la tienda.
2. Leer completos factura y entrada de PrestaShop. El servidor descarga el original y verifica su tamaño y SHA-256.
3. Si existe una extracción completa guardada para esos mismos bytes, puede reutilizarse. Se identifica como lectura guardada verificada, no como OCR nuevo. Lecturas parciales, páginas ausentes, avisos, lectores desconocidos o textos discrepantes exigen lectura nueva.
4. Crear la recepción solicitada; para revisar una existente, consultar su contexto y conservar su identidad.
5. Asociar los adjuntos del mensaje mediante `adjuntar_recepcion`. Para originales existentes, `totus_stock_add_source` exige haber leído antes el documento en este trabajo; el servidor aporta el texto y la huella, no los inventa el modelo.
6. Guardar cobertura y líneas mediante `totus_stock_save_result`, conservando variantes, conversiones justificadas y diferencias. Cada cambio relee la recepción y utiliza su revisión actual.

Una conversión aplicable a un pedido no autoriza crear una equivalencia global. El historial y la biblioteca no sustituyen el cotejo de los dos originales.

## Límites reales

El permiso de administración no amplía cuotas del proveedor. Un 429 puede impedir generar una respuesta aunque Totus permita la operación. No se activa facturación ni se cambia de proveedor automáticamente. PDF escaneados sin lectura completa previa siguen necesitando un lector autorizado disponible.

El motor admite hasta doce turnos y dieciséis acciones, conservando el plazo, el contador y la protección frente a escrituras inciertas. No se repiten altas cuyo resultado sea incierto.

## Verificación

`tests/verified-extraction-qa.mjs` comprueba huellas, cobertura, contradicciones y permisos. `tests/cloudflare-tools-qa.mjs` verifica asociación de originales leídos con identidades independientes, relectura, argumentos y escrituras inciertas. Las pruebas de proveedor reales se registran por separado: una simulación correcta no acredita disponibilidad o cuota real de una cuenta.
