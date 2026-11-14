# Copia de productos: reparación y uso

La copia se realiza en Productos → Copiar: elegir origen, destino, campos/imágenes/variaciones y pulsar Copiar y publicar. Si las categorías difieren, elegir la categoría de destino en el control visible y volver a publicar. Los idiomas y las etapas nativas se resuelven internamente. Los campos y pasos manuales quedan en Opciones avanzadas, sin ser obligatorios para el recorrido normal.

Causa del fallo detectado: Totus exigía exactamente 13 dígitos para EAN y 12 para UPC. PrestaShop 1.7.8.11 admite campos numéricos de hasta esas longitudes. El EAN 762497004366 del producto Monkey Transparent Pink Cellulose KS es aceptado por el contrato nativo y no debe bloquearse ni rellenarse con ceros. Se conserva exactamente en su campo original.

Referencia oficial: https://github.com/PrestaShop/PrestaShop/blob/1.7.8.11/classes/Validate.php (isEan13 e isUpc).

Las pruebas cubren creación, edición de producto y variaciones, ceros iniciales, valores cortos y máximos; rechazan letras, separadores y exceso de longitud. El recorrido de copia comprueba categoría elegida, EAN original, una sola alta, variaciones y origen intacto. El escenario de PrestaShop real aislado incluye EAN de 12 y UPC de 8 dígitos.

Ante una interrupción: conservar la solicitud y la referencia, comprobar primero el destino y reanudar las etapas pendientes. No inventar otra referencia ni iniciar otra alta para evitar duplicados. Un error previo a la creación no significa que se haya escrito un producto; comprobar el diario y la referencia nativa antes de actuar.

Este arreglo no publica ni continúa la integración de Hortimatic 8. Mantener los servicios ya activos al desplegarlo; no sustituirlos por un paquete antiguo ni retirar funciones ajenas al arreglo.

Segundo fallo reproducido: la función de diario, ejecutada como service_role, no podía consultar private.totus_website_matches. La migración 20261114121001 concede únicamente EXECUTE al servidor; anon y authenticated siguen sin acceso. La simulación reproduce el rechazo anterior y confirma la recuperación con el mismo request_id, completando variantes y activación en el mismo botón, sin duplicar el alta.

