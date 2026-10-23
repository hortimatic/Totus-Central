# Recepciones de mercancía · Totus Central

## Para Diego y su equipo
1. Entra en https://hortimatic.github.io/Totus-Central/ → Recepciones.
2. Pulsa **Nueva recepción**, elige tienda y proveedor. Si falta, **+ Nuevo proveedor** lo crea en la lista común y lo deja seleccionado sin perder los archivos elegidos.
3. Introduce referencia y fecha. Puedes seleccionar varios documentos en **Proveedor** y varios en **PrestaShop** en esa misma pantalla.
4. Pulsa **Guardar recepción y documentos**. Si una subida falla, la recepción y los documentos correctos se conservan. Usa **Reintentar archivos pendientes**: no crees otro pedido. La cola vive solo en memoria del navegador; si cierras la pestaña tendrás que seleccionar otra vez los archivos pendientes.
5. Dentro del pedido, pulsa **Copiar instrucción para ChatGPT** y pégala en el chat habitual con Supabase conectado.
6. ChatGPT lee el contexto, los textos y la biblioteca, coteja y guarda. Pulsa **Actualizar** para verlo.
7. **Descargar Excel** incluye todas las líneas, cantidades, factores, ajustes, fuentes y una hoja de documentos. **Descargar informe** entrega una página HTML completa que puedes abrir, imprimir o guardar como PDF desde el navegador. Las líneas pendientes siguen pendientes; nunca se convierten en cero.
8. **← Volver a recepciones** conserva tienda, fechas, estado y búsqueda. El rango Desde/Hasta incluye ambos días y admite varios meses; Limpiar vuelve a todas las fechas.

La entrada de PrestaShop ya representa el recuento hecho por el equipo. No se pide otro recuento por defecto.
El módulo no crea gastos, no cambia existencias y no envía reclamaciones.
Los permisos son los de **Documentos**: ver, crear, editar y exportar. Crear un proveedor usa el permiso Crear de Gastos. Confirmar equivalencias permanentes requiere gerencia.

### Quitar un documento del pedido
En cada archivo, **Quitar del pedido** retira su asociación y devuelve el cotejo a pendiente. El original se conserva en Documentos para evitar borrar una factura utilizada por otra operación. No elimina un gasto ni otras asociaciones. Si lo habías añadido por error, selecciona después el archivo correcto.

### Biblioteca de productos
El listado de Recepciones tiene **Biblioteca de productos**, con búsqueda por tienda, proveedor, nombres y variante.
Muestra solo equivalencias confirmadas, con factor de conversión y motivo. No es un catálogo de existencias de PrestaShop.
Para añadir una, abre un cotejo y pulsa **Guardar equivalencia** en una línea revisada. Gerencia debe escribir el motivo y confirmar explícitamente que puede reutilizarse.
Se aplica únicamente a la misma tienda, proveedor, nombres, variante y unidad. Un cambio de sabor, nicotina, resistencia o tamaño requiere comprobar su propia equivalencia. Que dos nombres cuadren en un pedido no autoriza a generalizarlos.
En el caso del 22/10/2026 se guardaron las dos referencias concretas de pods Pack3 → unidades. La equivalencia 11 mg/10 mg se confirmó solo para ese pedido; no se convirtió en una regla general.

## Conexiones: comprobar antes de declarar que no se puede
- **Supabase**: registros, texto extraído y cotejos. **OneDrive**: originales y copias. **GitHub**: código y manuales.
- El 23/10/2026 se comprobaron los tres complementos habilitados en la cuenta y la lectura de un PDF personal de OneDrive mediante SharePoint. Esto no da a un chat herramientas que no tenga activadas; al iniciar sesión hay que descubrir las herramientas de ese chat.
- Con Supabase conectado, public.totus_stock_context ya devuelve el texto disponible. Para un documento con extracción completa no hace falta un lector adicional de OneDrive para leer ese texto.
- Si SharePoint está disponible, busca en **OneDrive personal**, no en sitios empresariales. Usa la dirección Graph exacta del contexto o del resultado de búsqueda. Buscar por sitios de SharePoint no es una prueba de acceso al OneDrive personal.
- Un archivo Markdown puede devolver metadatos y contenido nulo: léelo en GitHub. No reconectes Microsoft ni cambies permisos por un problema de formato.
- Si falta una herramienta, indica su nombre y la operación necesaria. Comprueba que el complemento esté activado/seleccionado en el chat. No propongas Work como requisito de este flujo ni contrates una API de IA.
- Si un PDF está escaneado o incompleto, el texto disponible no demuestra cobertura completa. Usa el original con las herramientas del chat. Si no puedes leerlo, deja pendientes sus líneas e identifica exactamente el archivo o páginas que faltan.
- **Texto para ChatGPT** muestra el paquete de textos y cobertura para copiarlo cuando un lector concreto no funcione. No sustituye las páginas ilegibles.
- Nunca publiques archivos ni direcciones temporales, ni solicites la contraseña o la clave de Microsoft.

## Instrucciones para ChatGPT convencional

No necesitas Work ni una API de IA: tú haces el cotejo usando los conectores disponibles en este chat.
Comprueba primero que tienes herramientas de Supabase. Que el chat pueda buscar páginas públicas no significa que tenga acceso a archivos privados.
Proyecto Supabase: **awmojepsasikxocoeqtu**. Código: **hortimatic/Totus-Central**, rama **totus-central**.
No leas secretos, no cambies Microsoft y no modifiques tablas contables ni PrestaShop.

### Leer una recepción
Con el identificador que proporciona Diego:
- Lee las tablas públicas ops_stock_receipts y ops_stock_sources mediante el conector SQL autorizado.
- Es preferible llamar a public.totus_stock_context(p_id, p_actor_email). p_actor_email es la cuenta administradora activa que autoriza el trabajo; consúltala en team_members si no la conoces. No inventes una identidad.
- Devuelve la recepción, su revisión, documentos, texto extraído, cobertura de páginas y equivalencias confirmadas.
- El campo graph_item_url apunta al identificador exacto del archivo en OneDrive. Úsalo con el conector de SharePoint/OneDrive para leer el original.
- Nunca conviertas el identificador de OneDrive en un enlace público. No compartas direcciones temporales de descarga.
- Si el lector de un formato devuelve contenido nulo, usa extracted_text como segunda vía. Los originales permanecen archivados; un fallo del lector Markdown no demuestra un fallo de autorización.
- Un PDF escaneado puede no tener texto. Si no consigues leer el original con las herramientas del chat, conserva la revisión pendiente y explica qué archivo falta. Nunca inventes cantidades ni marques cobertura completa.

### Comprobar los documentos
- Confirma tienda, proveedor y pedido. No mezcles Hortimatic y NewOldSmok.
- Lee todas las páginas, hojas y líneas de ambos lados.
- Factura y albarán del mismo suministro no son dos entregas. Señala explícitamente qué documento respalda al otro.
- Varias entradas de PrestaShop pueden pertenecer a un mismo pedido.
- Une productos por referencia/EAN o equivalencia confirmada. Un nombre parecido es una propuesta, no una certeza.
- No mezcles sabor, nicotina, tamaño, color, resistencia ni paquetes de distinta cantidad.
- Cantidad desconocida = null, nunca cero. Una unidad o conversión dudosa mantiene la línea pendiente.
- Conserva cada origen: source_id, locator (página/hoja/fila) y line_id único por documento.
- Un ajuste externo incluido en la entrada se descuenta: recibido = entrada − ajuste. Si no está incluido, recibido = entrada. Si no se sabe, queda pendiente.
- Ajustes distintos de cero requieren explicación. Las conversiones distintas de uno requieren factor confirmado y motivo.
- No fuerces la coincidencia; informa de faltantes, sobrantes y dudas.

### Guardar el resultado
Usa public.totus_stock_save_result(p_id, p_revision, p_result, p_actor_email).
Vuelve a leer la revisión justo antes de guardar. Si otra persona la ha cambiado, relee y coteja; nunca sobrescribas a ciegas.
El servidor calcula el estado y las diferencias; no se envía un estado elegido por el chat.

Ejemplo de p_result, con identificadores de fuente reales de esa recepción:
~~~json
{
  "complete": true,
  "coverage": [
    {"source_id":"UUID-PROVEEDOR","complete":true,"explanation":"Todas las líneas de las páginas 1 y 2 revisadas"},
    {"source_id":"UUID-PRESTASHOP","complete":true,"explanation":"Todas las filas de la entrada revisadas"}
  ],
  "rows": [
    {
      "id":"linea-1",
      "supplier_name":"Nombre en factura",
      "prestashop_name":"Nombre en PrestaShop",
      "variant":"Formato y variante comprobados",
      "unit":"unidad",
      "unit_factor":1,
      "unit_confirmed":true,
      "match_confirmed":true,
      "supplier_qty":10,
      "prestashop_qty":10,
      "adjustment_qty":0,
      "adjustment_included":"no",
      "adjustment_reason":"",
      "conversion_reason":"",
      "source_refs":[
        {"source_id":"UUID-PROVEEDOR","locator":"Página 1, línea 3","line_id":"p1-l3"},
        {"source_id":"UUID-PRESTASHOP","locator":"Hoja Entrada, fila 8","line_id":"Entrada-f8"}
      ]
    }
  ]
}
~~~
Si la extracción figura parcial o sin leer y tú has leído realmente el original completo, añade manually_verified:true y reading_note a la cobertura correspondiente. No lo hagas si no has podido leerlo.
Para confirmar una equivalencia reutilizable usa public.totus_stock_confirm_equivalence, únicamente tras confirmación explícita de Diego/gerencia. Incluye variante, unidad, factor y evidencia. Nunca reutilices una equivalencia para otra variante.

## Conservación y seguridad
- Originales: archivo documental existente, con traslado verificado a OneDrive mediante el proceso habitual.
- Texto, cotejos, historial y equivalencias: Supabase.
- Código y este manual: GitHub.
- Las nuevas copias completas incluyen las cuatro tablas ops_stock_* y los originales vinculados a ops_documents.
- Las copias anteriores al módulo siguen siendo comprobables y recuperables: al recuperarlas, el módulo queda vacío porque entonces no existía. La contabilidad conserva todas las comprobaciones previas.
- No hay documentos ni procesos permanentes en el portátil. La extracción se realiza en memoria del navegador al subir el archivo.
- No se añaden claves ni servicios de IA de pago.

## Diagnóstico comprobado
En la auditoría del 23/10/2026 se leyeron dos PDF completos mediante sus identificadores Graph. Un manual Markdown devolvió metadatos sin contenido. Se distinguen los errores de lectura de formato de los errores de autorización. No se afirma que un chat tenga un conector que no está disponible en su sesión.

Para corregir tienda, proveedor, referencia, fecha o notas usa **Editar datos** en la ficha. El resultado vuelve a quedar pendiente y se conserva el historial. No se permite cambiar a una tienda incompatible con los documentos asociados.

## Importar documentos que Diego ya tiene en OneDrive (sin ordenador local)
Si los originales ya están en OneDrive, no los descargues a un equipo ni los envíes al repositorio.
1. Localízalos mediante SharePoint/OneDrive, leyendo su contenido y metadatos por los identificadores exactos. No te fíes solo del nombre o de una búsqueda amplia.
2. Crea la recepción con totus_stock_create y conserva su revisión.
3. Con el conector de OneDrive copia (no muevas) los originales a una subcarpeta exclusiva de **Apps/Totus Central/01 Documentos/Recepciones/**, por ejemplo año/pedido. Usa conflicto fail y una referencia de pedido inequívoca. Los permisos no se amplían.
4. Espera a que la copia exista y comprueba su item_id, nombre, tamaño y quickXorHash frente al original.
5. Solicita su asociación con public.totus_stock_import_request: p_id, p_revision, p_kind (supplier o prestashop), p_path relativo a Apps/Totus Central empezando por 01 Documentos/Recepciones/, p_item (el ID de la copia), p_name, p_quickxor del original, p_text, p_extraction y p_actor_email. Solo administración puede solicitar esta importación.
6. Devuelve un identificador de solicitud. Consulta net._http_response por ese ID con el conector SQL autorizado. Espera respuesta imported:true; un HTTP 200 por sí solo no basta. Si falla, explica el motivo y relee la recepción antes de repetir.
7. El servidor lee la copia dentro de la carpeta de aplicación, comprueba identidad, huella de copia y tamaño, calcula SHA-256 y registra documento, ubicación y asociación en una transacción. El original queda en las copias completas y en la vista previa habitual. No insertes a mano fichas documentales ni inventes huellas.
8. Vuelve a leer la revisión antes de asociar el siguiente documento. Si faltan páginas o el texto está recortado, marca extraction.state partial/unread y conserva las dudas para el cotejo.
No se muestran claves de Microsoft, claves de servicio ni el secreto de programación al chat.
