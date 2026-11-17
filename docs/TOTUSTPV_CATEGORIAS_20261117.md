# Categorías desde el alta de artículos · 17/11/2026

Ampliación de TPV-06 en la rama borrador; no publicada ni activada en las tiendas remotas. La prueba nativa usa exclusivamente el laboratorio PrestaShop 8.2.8, PHP y MariaDB de loopback. Las capturas originales del usuario permanecen en el dossier privado.

## Uso

En **Más acciones → Nuevo producto**, pulsa **+ Crear categoría**. Escribe su nombre y elige la categoría principal. **Revisar categoría** guarda una solicitud revisable; **Confirmar y comprobar categoría** realiza el alta. Después, **Usar en este producto** relee el catálogo y selecciona la categoría verificada. La referencia, precios, fotos y combinaciones del artículo se conservan, al igual que el ticket anterior.

Las **Categorías guardadas** permiten consultar o continuar solicitudes. Si se pierde la respuesta de preparación, los datos quedan bloqueados y **Comprobar envío** conserva el identificador. Si la creación queda pendiente, se comprueba esa misma solicitud; no se prepara otra para intentar resolverla. Consultar el historial no requiere caja abierta; crear, continuar o cancelar exige caja abierta, permiso de venta y permisos habituales de consulta/creación de Productos.

## Construcción

- `category-create-contract.js` acepta exclusivamente nombre y categoría principal. La tienda nativa procede del puesto autorizado; el cliente no puede enviar otro origen, contexto de tienda o datos del operador.
- `catalogue-intake-service.js` conserva revisión, progreso y recuperación. El nuevo diario privado `20261117100653_totustpv_catalogue_helpers.sql` usa RLS, ejecución de servidor, solicitud inmutable, límite de cien pendientes y una reserva de cinco minutos contra ejecuciones simultáneas.
- `official-products.js` adapta el creador común de directorios. Este comprueba idiomas, campos, categoría principal y resultado nativo. Su diario existente identifica la escritura: no se añade otro maestro de categorías ni se amplían las rutas públicas de edición/borrado de directorios.
- La petición Webservice liga `id_shop` y `id_shop_default` al puesto. La consulta y creación usan los permisos nativos ya autorizados; no cambian el núcleo de PrestaShop ni instalan complementos.
- La proyección al navegador excluye carga nativa, huellas, identidad interna y reserva. El almacenamiento local conserva identificador y huella de recuperación, sin datos de la categoría ni credenciales.

La API oficial documenta los campos de [categorías de PrestaShop 8](https://devdocs.prestashop-project.org/8/webservice/resources/categories/). El código instalado del laboratorio confirma la asignación de grupos predeterminada al crear una categoría sin lista explícita; no se certifica con ello una política personalizada de acceso en otra tienda.

## Evidencia y límites

Las 452 aserciones SQL verifican, entre otros casos, propiedad del intento, tienda/caja/operador, permisos, límite, cierre y reapertura, reserva caducada y confirmación tardía. Las pruebas del coordinador simulan pérdida de respuesta nativa y pérdida de confirmación SQL, conservando una única creación. Estas interrupciones de categoría son simuladas; el recorrido nativo conectado verifica creación real y relectura, sin afirmar que se haya cortado una conexión remota.

El recorrido nativo de servicios crea una categoría y un artículo con imagen y dos combinaciones dentro de ella. El navegador conectado crea otra categoría desde el formulario, conserva la referencia del artículo, crea el artículo con proveedor y unidades y lo añade al ticket previo. Se revisan 1440 y 390 píxeles. Autenticación y redirección de entrega local son fixtures. No se producen ventas ni cambios en una tienda remota durante esta prueba.

La migración sigue pendiente de aplicación remota junto con las otras cinco ampliaciones del PR 213. No se declara TPV-06 completo: quedan los límites de recuperación de imágenes y la aceptación remota, además de los demás requisitos del TPV final.

Regresión afectada: 66 recorridos aprobados desde 7d32b1d4; paquetes completos de los nueve servicios comprobados. La última protección de cancelación se comprueba además con la suite SQL repetida de 452 aserciones.
