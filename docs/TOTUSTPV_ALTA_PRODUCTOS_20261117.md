# Alta de productos desde TotusTPV

17/11/2026. Ampliación integrada en la rama de trabajo, verificada en laboratorio nativo. No desplegada ni disponible en la interfaz publicada. Continúa la base documentada en `TOTUSTPV_ALTA_PRODUCTOS_BASE_20261117.md`.

## Comportamiento comprobado

**Más acciones → Nuevo producto** abre un formulario sobre el mostrador y conserva el ticket actual. Incluye nombre, referencia, precios de venta con/sin impuestos, coste, EAN, categoría, marca, proveedor y su referencia, unidades, descripción, visibilidad, imágenes y combinaciones. Los selectores usan el buscador común de Central. El PVP se convierte con aritmética entera de seis decimales cuando existe un impuesto simple comprobado para España; los casos que necesitan dirección se calculan al preparar el ticket nativo.

Las fotos se normalizan en el dispositivo con el editor existente. Se admiten hasta seis PNG preparados, cuatro MB en total y cien combinaciones, con atributos, referencia, EAN, coste, precio final, imágenes y unidades propios. El servidor vuelve a comprobar los archivos y las relaciones nativas. No se transfieren IDs entre tiendas.

Guardar la ficha prepara una revisión, sin crear un producto nativo. La confirmación recorre ficha, imágenes, combinaciones, existencias, proveedor y disponibilidad. El artículo permanece inactivo hasta completar las etapas anteriores. Los resultados verificados se conservan y un envío incierto mantiene el mismo identificador. La revisión de una etapa existente precede a preparar otra escritura: esto permite recuperar una combinación creada aunque su confirmación local se haya perdido.

**Más acciones → Altas de productos** recupera los trabajos de la persona y caja actuales. La consulta puede realizarse sin caja abierta; crear, continuar o cancelar exige los permisos y sesión vigentes. Una solicitud local de preparación puede recuperarse al volver a abrir el puesto sin guardar las fotos ni datos de la ficha en `localStorage`. Las fichas e imágenes preparadas quedan en el diario privado del servidor.

## Evidencia y alcance

- Quince pruebas de contrato, coordinación y frontera autenticada: importes, permisos, origen, contexto nativo, datos privados excluidos, respuestas perdidas y limitación del cuerpo HTTP. Las acciones ordinarias conservan el límite original de 64 KiB, también con caracteres multibyte; solo la preparación con imágenes admite 6 MiB.
- Navegador aislado a 1440 y 390 px: conversión de PVP, imagen local, combinación, envío incierto, recuperación de la misma ficha, confirmación expresa, progreso, conservación del ticket y consulta al perder permiso de creación. Las respuestas de esta prueba son sintéticas.
- `node tests/totustpv-native-http-qa.mjs --products-only`: handler real, migraciones PostgreSQL reales aisladas y Webservice oficial de PrestaShop 8.2.8/PHP/MariaDB local. Verifica una imagen, dos combinaciones, impactos exactos de precio, tres costes de proveedor, unidades 3/7 y activación final. Pierde una respuesta de alta nativa y una confirmación local de combinación; no repite sus POST.
- El mismo recorrido abre el formulario conectado al servidor y crea otro artículo con proveedor y dos unidades, lo relee desde el catálogo y lo añade al ticket preexistente, sin venderlo. Se comprueba escritorio/móvil. La autenticación y entrega a loopback son fixtures explícitas; no constituyen una prueba con una cuenta remota.
- La suite SQL del diario de TPV tiene 390 aserciones aprobadas. El manifiesto conserva las nueve funciones y sus dependencias completas; no se ha sustituido un servicio remoto.

## Estructura

`src/totustpv/product-intake.js` administra el formulario y su progreso; `product-intake-contract.js` normaliza y deriva el plan. `central-adapter.js` conserva la identidad de las solicitudes sin datos de producto en el almacenamiento local. El handler autentica con la sesión habitual y consulta los permisos de Productos antes de cargar la conexión.

`server/product-intake-service.js` coordina una etapa por llamada. `server/official-products.js` adapta los escritores existentes de `totus-connections`, sus diarios y el contexto `id_shop` obligatorio. No añade otro maestro de productos. La migración `20261117052454_totustpv_product_intake.sql` guarda el manifiesto y progreso privados, con RLS, funciones invocadoras restringidas al servicio, alcance de actor/conexión/establecimiento/caja y exclusión concurrente de cinco minutos.

El paquete reutiliza las dos habilitaciones revisadas de creación y etapas de Productos. No las elude ni las activa desde el navegador. El bloque de metadatos conserva el contrato existente: los impuestos se consultan por los IDs de las reglas leídas, sin ampliar la lectura general.

## Trabajo que permanece abierto

Activación coordinada y aceptación en la preproducción autorizada; creación de categorías desde el botón propio del TPV; contraste de los demás emergentes y ajustes del registro maestro. Si una carga de imagen pierde una respuesta sin identificar el registro creado, el escritor conserva el resultado incierto y exige revisión, sin duplicar otra carga ni declarar éxito. No se ha certificado este caso como recuperación automática.

TPV-06 permanece abierto hasta cubrir esos límites. El bloque no cierra las 149 configuraciones, traspasos, presupuestos, vales, impresora/cajón físicos ni la documentación final privada.
