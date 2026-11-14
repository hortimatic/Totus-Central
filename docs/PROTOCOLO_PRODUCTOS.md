# Productos · creación, copia y edición desde Totus Central

Revisión operativa: 14/11/2026. El recorrido visible vigente se describe en docs/RECORRIDOS_PRODUCTOS_CHATGPT.md. Las validaciones internas y la recuperación no deben convertirse en pasos manuales adicionales para publicar. Código publicado, servicio activo y verificación real son estados distintos.

## Resultado solicitado y regla de trabajo

Dos fichas paralelas, Hortimatic y NewOldSmok. Abrir una ficha, elegir únicamente los campos que se desean copiar y completar o adaptar el resto en el destino. La copia no es automática ni obliga a igualar las dos tiendas. Cada escritura se dirige a la conexión elegida y se vuelve a consultar antes de declarar éxito.

Orden: comprobar conexión e identidad; leer las fichas; preparar los campos; completar relaciones e idiomas del destino; validar; confirmar; guardar; releer. No modificar otros módulos, ventas, cierres ni contabilidad para completar un producto.

## Interfaz manual vigente

1. En Catálogo, buscar en el catálogo completo y seleccionar el producto de trabajo, o pulsar **Crear producto** para un alta nueva.
2. En Producto, completar o modificar su ficha y las variaciones. Organización reúne categorías, marca, proveedor y características; Variaciones contiene atributos y valores de la tienda elegida. No reutilizar IDs entre webs.
3. Revisar **Al publicar**: producto con variaciones e imágenes, o solo producto. Pulsar **Publicar en PrestaShop**. La aplicación realiza por debajo la validación, escritura y relectura. Si falta un dato concreto, completarlo sin repetir un alta ya iniciada.
4. Para copiar, abrir Copiar, elegir origen y destino y seleccionar los datos, fotos y variaciones deseados. **Seleccionar todo** incluye las imágenes. Confirmar la categoría del destino si no existe correspondencia única y pulsar **Copiar y publicar en [tienda]**.
5. Comprobar el ID y el resultado releído en destino. Las fotos se verifican en su galería y las combinaciones mediante sus atributos e imágenes asociadas. La ficha debe conservar los datos que no se seleccionaron para editar.
6. Historial sirve para consultar y recuperar operaciones: no es un paso obligatorio para guardar desde Producto o Copiar. Una respuesta incierta se concilia con su misma solicitud, nunca duplicando el producto.

Los apartados técnicos siguientes describen operaciones internas que también puede usar el asistente. No sustituyen este recorrido de un botón ni obligan a recorrer las antiguas etapas de interfaz.

## Campos cubiertos por el contrato

| Área | Tratamiento |
| --- | --- |
| Identificación | Nombre por idioma, referencia, EAN, UPC, ISBN y MPN; los códigos se conservan como texto |
| Contenido y SEO | Resumen, descripción completa, metatítulo, metadescripción, palabras clave y URL por idioma |
| Organización del alta | Marca, proveedor principal, grupo fiscal, categorías múltiples/predeterminada, características y valores, etiquetas y relacionados existentes en destino |
| Precio | Precio base sin impuestos, coste orientativo, unidad/relación de precio unitario, ecotasa, en oferta; cálculo compartido con Precio para PVP y márgenes con IVA y recargo |
| Combinaciones | Atributos del destino, referencias/códigos, coste, impactos de precio/peso/ecotasa/unidad, mínimo, umbral/alerta, fecha, predeterminada e imágenes del producto |
| Existencias | Cantidad por producto/combinación, ubicación y preferencia de pedidos sin existencias; no usar cantidad del producto como sustituto del recurso stock_availables |
| Disponibilidad | Pedido permitido, precio visible, solo online, visibilidad, condición, etiquetas/plazos por idioma y fecha |
| Transporte | Peso, anchura, altura, profundidad y suplemento; comprobar unidades configuradas en cada tienda (Hortimatic: kg y m) |
| Proveedor | Precio y referencia propios por proveedor/combinación y moneda |
| Precio especial | Combinación, cantidad mínima, precio o reducción, impuestos, fechas y restricciones de tienda/moneda/país/grupo/cliente/carrito |
| Imágenes | Importación local y normalización a PNG con transparencia verificada, previsualización, subida por API y asociación a combinaciones; descarga del original y enlace a la copia de la tienda |

PrestaShop 1.7.8.11 recalcula internamente `unit_price_ratio`. No enviar una relación por unidad no acreditada ni instalar complementos para forzarla. Los precios base, PVP, coste y ofertas se gestionan con los campos nativos y relectura. La relación por unidad se consulta como dato derivado, sin prometer una edición que la API instalada no conserva. No repetir un alta para resolver un dato de este tipo. Los precios de coste de variaciones pueden estar redondeados en origen: presentar márgenes aproximados, no beneficio contable real.

La transparencia se verifica en los píxeles del PNG, no en su extensión. PrestaShop puede convertir sus derivados al formato configurado. No cambiar globalmente el tratamiento de imágenes de la tienda para una prueba.

Los identificadores de categorías, impuestos, atributos, imágenes, características y proveedores pertenecen a su tienda. Se seleccionan o verifican en destino. Los campos calculados se leen pero no se reenvían como si fueran datos editables.

## Campos de módulos y límites explícitos

El formulario del administrador incluye también extensiones instaladas: Elementor, IQIT (pestañas, tallas, vídeos/360), SEO ampliado y POSTPV. No se debe afirmar que la API nativa escribe sus tablas privadas. Los datos adicionales recibidos se muestran como información de solo lectura; cada extensión necesita un adaptador comprobado antes de habilitar su escritura.

No anunciar como implementadas operaciones de packs/descargables, creación de maestros, adjuntos o asignación específica de transportistas si no existe un control y una prueba efectiva para ellas. Tampoco confundir copiar campos del producto con clonar automáticamente todas las relaciones y ficheros. Registrar estas necesidades sin descartar datos silenciosamente.

## ChatGPT convencional sin navegador de PrestaShop

La URL de referencia aporta información; no concede acceso ni ejecuta un alta. El chat necesita las herramientas de GitHub y Supabase del proyecto y una cuenta propia de IA activa, vinculada en Administración → Usuarios → Acceso de IA. No pedir claves de PrestaShop ni leer Vault.

1. Leer este protocolo y la entrada vigente desde la rama totus-central. Consultar el catálogo real del trabajador.
2. Comprobar explícitamente la cuenta elegida; no asumir que el alias genérico totus_assistant_submit sigue apuntando a ChatGPT. Puede estar asociado a otro lector.

```sql
select private.totus_agent_submit('<correo de la cuenta ChatGPT activa>', 'session_check');
-- Recoger después el UUID devuelto, nunca inventarlo:
select private.totus_assistant_result('<job_id>'::uuid);
```

Exigir completed, authenticated=true, session_verified=true y el email/rol esperados. Codex utiliza su propio acceso; no suplantar al titular ni a otra IA.

3. Pedir el catálogo:

```sql
select private.totus_agent_submit('<correo de la cuenta ChatGPT activa>', 'operation',
 '{"operation":"catalogue"}'::jsonb);
```

4. Consultar las conexiones mediante la RPC normal totus_prestashop_context o totus_api_manager, enumeradas en el catálogo. Mantener el ID y revisión actuales de la conexión seleccionada; no incluir secretos.
5. Para trabajar con Productos, enviar una operación products. Sus args son EXACTAMENTE el cuerpo usado por el formulario de Totus, con action, store, id, revision y call_id. El trabajador inicia su propia sesión y llama a totus-connections con ella. No usa un servicio privilegiado como sustituto de los permisos del usuario.

```sql
select private.totus_agent_submit('<correo de la cuenta ChatGPT activa>', 'operation',
 jsonb_build_object('operation','products','args',jsonb_build_object(
 'action','prestashop_product_create_profile','store','hortimatic',
 'id','<UUID real de conexión>','revision',<revisión real>,
 'call_id','<UUID nuevo de esta llamada>')));
```

6. Acciones disponibles: prestashop_read, prestashop_item_read, prestashop_product_create_profile, prestashop_product_prepare/commit, prestashop_product_create_prepare/commit y prestashop_product_step_prepare/commit. Preparar y confirmar son llamadas distintas. Los contratos tipados y ejemplos verificables están en src/productos-write-contract.js, src/productos-stages-contract.js y sus pruebas.
7. Seguir los mismos pasos manuales: datos completos, categorías e idiomas, prevalidación, confirmación autorizada, alta inactiva, imágenes/combinaciones/stock/precios, revisión y lectura final. Conservar request_id, parent_request_id y step_key. Un call_id nuevo no reemplaza una solicitud de escritura ya enviada.
8. Los textos e imágenes de Productos admiten hasta 6 MiB de solicitud en el puente; los límites de las demás operaciones no se amplían. El PNG de etapa tiene su propio máximo y validación. Preparar imágenes antes de enviar; no subir una URL remota arbitraria como si fueran bytes verificados.
9. Obtener datos de la URL facilitada, redactar contenido propio y adaptar SEO a la tienda. En datos comerciales reales, no inventar coste, impuestos, stock, proveedor o EAN para completar huecos. En el producto «pruebas», Diego ha autorizado expresamente datos ficticios.
10. Entregar tienda, referencia, ID, estado activo/comprable y comprobaciones reales. No devolver «creado» si el trabajo solo está queued, prevalidado o parcialmente guardado.

## Cambios masivos por combinación

Seleccionar combinaciones concretas, elegir un campo común y su nuevo valor; preparar y validar el lote, revisar sus diferencias y escribir GUARDAR LOTE. Cada combinación conserva una solicitud propia. El lote se detiene ante el primer fallo, conserva las completadas y permite comprobar la pendiente sin repetirla. No incluye combinaciones inexistentes en destino ni constituye una transacción única entre tiendas. Referencias y códigos únicos se editan individualmente; no asignar un mismo EAN a todas.

## Recuperación y concurrencia

El borrador local se conserva por cuenta en IndexedDB, incluidas imágenes y solicitudes estables; no contiene claves. Una reapertura no envía escrituras. Cambiar de cuenta no carga el trabajo de otra. No es una copia de seguridad remota ni sustituye el diario del servidor.

Cada alta y etapa queda registrada en un diario persistente. Ante respuesta perdida o HTTP 500, comprobar la misma solicitud: PrestaShop puede haber guardado antes de fallar al construir la respuesta. Solo una relectura exacta permite conciliar. No repetir POST/PUT ni cambiar referencias para esquivar una operación incierta.

Las actualizaciones comparan la huella leída antes de escribir. Si otro usuario cambia la ficha, volver a leer y preparar; no forzar una propuesta obsoleta. La API de PrestaShop no proporciona una transacción distribuida con Totus: cada fase debe conservar evidencia verificable.

## Publicación y pruebas

Producción requiere migración del diario, servicio totus-connections completo, trabajador totus-assistant actualizado y tres indicadores revisados de creación/etapas/edición. Mantener las claves exclusivamente en servidor y la autorización normal de administración.

Pruebas exigidas: contratos y permisos; diario en PostgreSQL aislado; PrestaShop 1.7.8.11 real aislado con alta, combinación, stock, proveedor, oferta, PNG, publicación no comprable, edición y repetición sin duplicados; recorridos de navegador a 390/768/1440, dos columnas, edición y recuperación por cuenta. Después, crear «pruebas» mediante Totus y contrastarlo en Hortimatic. No presentar las pruebas simuladas como prueba de esa última operación.

## Relevo

Conservar versión publicada, PR y ejecución de controles, tienda/ID/referencia de pruebas, resultados verificados, pendientes explícitos y solicitudes inciertas. No incluir claves, contraseñas ni URLs del administrador con tokens de sesión. Antes de ampliar a otra versión de PrestaShop, repetir la integración aislada y la lectura de capacidades de esa tienda.

## Recuperación del alta y plantilla nativa completa (07/11/2026)
La plantilla `schema=blank` es un catálogo de campos, no un documento para enviar completo. El alta conserva los idiomas del destino y genera únicamente los campos y relaciones seleccionados. No envía relaciones vacías de imágenes, existencias o packs ni setters calculados.

Si una petición queda incierta, primero usar «Comprobar resultado sin repetir el alta». Tras corregir su causa, «Recuperar un alta que no llegó a crearse» exige escribir REINTENTAR. El servidor conserva UUID, referencia, contenido y firma; consulta dos veces la referencia, vuelve a validar esquema/categoría/relaciones y solo reclama atómicamente un registro incierto propio sin ID. Si ya existe un producto, lo recupera por lectura. Un registro pendiente, completado, ajeno o con ID no admite otro POST. Los reintentos se añaden al historial privado, sin borrar el registro. ChatGPT puede usar `retry_absent:true` únicamente en la misma operación confirmada de alta, después de revisar el fallo; no debe modificar el contenido ni inventar otro UUID.
