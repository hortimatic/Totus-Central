# Recepciones de mercancía · Totus Central

## Para Diego y su equipo
1. Entra en https://hortimatic.github.io/Totus-Central/ → Recepciones.
2. Crea una recepción con tienda, proveedor, referencia y fecha.
3. Añade la factura o albarán del proveedor y los documentos de entrada de PrestaShop. Selecciona el lado correcto antes de subir cada grupo. Puedes asociar una factura ya archivada: no hace falta duplicarla.
4. Pulsa **Copiar instrucción para ChatGPT** y pégala en el chat habitual con Supabase conectado.
5. ChatGPT leerá los documentos y guardará el cotejo. Pulsa **Actualizar** en la recepción para verlo.
6. Si quedan dudas, contéstalas en el chat. Cada resultado guardado conserva una revisión; un documento nuevo devuelve la recepción a pendiente.

La entrada de PrestaShop ya representa el recuento hecho por el equipo. No se pide otro recuento por defecto.
Este módulo no crea gastos, no cambia existencias y no envía reclamaciones.
Los permisos son los de **Documentos**: ver, crear y editar. Confirmar equivalencias permanentes requiere gerencia.

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
