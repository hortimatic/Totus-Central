> Entrada vigente (31/10/2026): [INICIO_CHATGPT_ACTUAL.md](docs/INICIO_CHATGPT_ACTUAL.md). Leerla primero. Este documento conserva también antecedentes históricos; no reinstalar propuestas antiguas sin comprobar producción.

# Totus Central · entrada para ChatGPT

> Para cambios técnicos, leer también el [protocolo de mantenimiento de la revisión del 27/10](docs/PROTOCOLO_MANTENIMIENTO_2026-10-27.md). Comprobar si la revisión está instalada antes de aplicarlo.

## Empieza aquí
1. Descubre las herramientas disponibles: Supabase, GitHub y SharePoint/OneDrive. No confundas la navegación web pública con acceso a archivos privados.
2. Lee [el manual operativo](docs/MANUAL_CHATGPT_ONLINE.md), [el trabajo diario](docs/GUIA_TRABAJO_DIARIO_CHATGPT.md) y, si vas a cotejar, [Recepciones](docs/COTEJOS_CHATGPT.md).
3. Única producción: https://hortimatic.github.io/Totus-Central/; repositorio hortimatic/Totus-Central, rama totus-central; proyecto Supabase awmojepsasikxocoeqtu.
4. Consulta datos reales antes de escribir. No dupliques gastos, cierres, documentos ni recepciones. No modifiques el histórico aceptado para cuadrar cifras.

## Conexión comprobada y alternativa de lectura
GitHub, Supabase y SharePoint se verificaron habilitados en la cuenta el 23/10/2026. Se probaron búsqueda y lectura de un PDF personal de OneDrive con SharePoint. Cada chat debe comprobar sus propias herramientas y autorización.
- Usa las herramientas de OneDrive personal; no busques primero un sitio empresarial inexistente.
- Prefiere el identificador Graph exacto que devuelva el contexto o la búsqueda.
- Un lector que devuelve contenido nulo para un Markdown no demuestra un fallo de conexión. Lee los manuales en GitHub.
- En Recepciones, public.totus_stock_context devuelve textos, cobertura, referencias originales y biblioteca. Si la extracción está completa, usa ese texto aunque el lector de OneDrive de ese chat no admita el formato.
- Si faltan páginas o un escaneo no tiene texto, lee el original con las herramientas disponibles o deja pendiente lo que no puedas comprobar. No inventes lectura ni cantidades.
- Si falta una herramienta, concreta cuál y qué operación intentaste. Continúa con las vías disponibles; no pidas nuevas claves ni Work por defecto.

## Operación
Este flujo pertenece a Recepciones de Totus Central, con biblioteca persistente en Supabase. Un panel independiente o de ejemplo que indique que no tiene base de datos no describe este módulo. No cambies de herramienta al recibir un identificador de recepción de Totus.
La base de datos está en Supabase. OneDrive guarda originales y copias; GitHub guarda código y manuales.
Para un cotejo, Diego crea o abre la recepción y pega Copiar instrucción para ChatGPT. Lee el contexto, consulta equivalencias aplicables, coteja, guarda con public.totus_stock_save_result usando la revisión actual y relee para verificar.
Las entradas de PrestaShop son el recuento declarado por el equipo. No alteres existencias ni contabilidad por cotejar documentos. Guarda equivalencias permanentes solo con confirmación explícita de gerencia para esa variante y unidad.

## Seguridad y cambios
No leas secretos ni publiques documentos o direcciones temporales. No dependas de archivos locales. No muevas archivos administrados de OneDrive por fuera del flujo de la herramienta.
La recuperación de una copia es una operación distinta de verificarla y necesita autorización expresa del titular.
Para cambios de interfaz, conserva la estructura y los datos, explica el ajuste y comprueba lectura, escritura, descargas y permisos afectados. Los cambios complejos se preparan aparte.
Al terminar informa qué se hizo, qué comprobaste y qué queda pendiente, sin afirmar que una prueba no ejecutada ha pasado.


## Revisión del 24/10/2026: Pricing y conexión convencional
Pricing dispone de guía específica en [PRICING_PRODUCTOS_Y_VARIANTES.md](docs/PRICING_PRODUCTOS_Y_VARIANTES.md). Consulta también el índice [ENTREGA_FUENTES.md](docs/ENTREGA_FUENTES.md).
La prueba real desde «Revisar Totus Central» acreditó lectura GitHub, Supabase y ambos PDF originales en OneDrive con el conector SharePoint, y operaciones reales de Recepciones dentro de una transacción revertida: creación, asociación de dos documentos, guardado y lectura de 39 líneas/100 unidades. Tras ROLLBACK no quedó la recepción de prueba y la original conservó revisión 4. Evidencia: https://github.com/hortimatic/Totus-Central/pull/12#issuecomment-6376148457.
La prueba no acredita por sí sola transferencia de un binario nuevo ni registro contable persistente. No hace falta Work para esas operaciones demostradas; cada chat debe tener disponibles y autorizados los conectores en su propia sesión.

## Propuesta pendiente: asignación manual y eliminación de recepciones (28/10/2026)
- Fecha: 28/10/2026. Producción conocida: rama `totus-central`, base `602f3d940c15be8492334c8f644a9be9eb402a86`; no modificar directamente.
- Rama de trabajo: `fix/recepciones-asignacion-y-eliminacion-20261028`.
- Petición 1 (código preparado, no desplegado): botón de asignación manual de líneas de proveedor y PrestaShop no relacionadas; registra origen, motivo, responsable y posible incidencia de catálogo. Guardar en biblioteca es una opción distinta y restringida a gerencia, sin memorizar errores de catálogo.
- Petición 2 (código y migración preparados, no desplegados): botón Eliminar recepción, contraseña NO necesaria, confirmación textual `ELIMINAR`, motivo, verificación de revisión/referencia y permiso `documentos.delete` + gerencia. La eliminación borra solamente ficha, fuentes y revisiones, y conserva originales de Documentos. En auditoría queda el estado íntegro anterior, con referencias a documentos conservados; los compartidos conservan la asociación vigente. Para retirar los PDF, Documentos aplica su propio flujo protegido.
- Archivos modificados: `src/app.js` (permisos centrales), `src/stock-ui.js`, `src/stock-workflow.js`, `src/stock-manual-matching.js`, `tests/stock-workflow-qa.mjs`, `tests/stock-db-qa.sql`, `docs/COTEJOS_CHATGPT.md` y migración `supabase/migrations/20261028164000_stock_manual_pairing_receipt_delete.sql`.
- Verificación local en JS con el contenido de GitHub: `stock-workflow-qa.mjs` (incluidas nuevas pruebas de asignación) PASSED en entorno de funciones, parseo de `src/stock-ui.js` PASSED. No se han ejecutado ensayos destructivos ni se ha tocado Supabase producción.
- Bloqueo: la herramienta impidió crear una prueba adicional de navegador; no consta ejecutada. Ejecutar la batería preexistente completa y la revisión técnica de SQL/seguridad en el PR antes de aprobar.
- Despliegue controlado: migración en entorno controlado primero; validar permisos y contrato RPC; después publicación del frontend mediante el flujo autorizado. Verificar versiones/flujos y ausencia de variación en contabilidad, inventario y documentos existentes.
- Datos afectados por esta propuesta: ninguno en producción. Se mantiene la recepción Garden Seeds `1cda074b-d12e-450a-8293-a0be9270aca9`, versión 4, sin cambios de este PR. Los PDF originales no se han movido ni borrado.
