# Recorridos del asistente convencional y protección de regresiones

Fecha: 15/11/2026. Aplicación contrastada: `5d05fffe44bcd77a7f8a40f20c666d0f511ebb85`, dominio `https://totuscentral.totuscode.com/`. Este informe distingue las pruebas de lectura/prevalidación reales de las escrituras con datos ficticios en pruebas aisladas. No acredita una sesión independiente de la interfaz de ChatGPT: se ha probado su cuenta configurada mediante el mismo trabajador que utilizan sus conectores convencionales.

## Entrada única

Leer `INICIO_CHATGPT_ACTUAL.md` de la rama `totus-central`, consultar capacidades instaladas y descubrir las herramientas disponibles. GitHub contiene código/manuales; Supabase, operaciones; OneDrive personal, originales. No necesita una API de modelo de pago para estos recorridos. Un chat sin los conectores requeridos no adquiere acceso por tener este documento.

La cuenta técnica histórica de ChatGPT está inactiva; hay otra cuenta propia de ChatGPT activa y vinculada, cuya sesión y rol administrador se han verificado. No publicar su correo personal en GitHub. Resolver la cuenta en Administración → Usuarios → Acceso de IA y usar su correo verificado, sin pedir ni consultar contraseñas. No reactivar la antigua ni suplantar al titular. El alias genérico puede apuntar a otro lector.

```sql
select private.totus_assistant_capabilities();
select private.totus_agent_submit('<correo activo verificado>', 'session_check');
-- Segunda llamada con el UUID realmente devuelto:
select private.totus_assistant_result('<job_id>'::uuid);
select private.totus_agent_submit('<correo activo verificado>', 'operation',
 '{"operation":"catalogue"}'::jsonb);
```

Exigir `completed`, `authenticated=true`, `session_verified=true` y UUID/correo esperados. Recoger también el catálogo mediante su job_id. `queued` no es éxito. Conservar job_id y request_id antes de reintentar; no enviar SQL contable directo ni fabricar claims. La sesión administrativa del conector no es la sesión del trabajador.

## Gasto de proveedor

1. Leer factura completa y verificar destinatario, tienda, proveedor/NIF, número, fechas y todas las líneas. Buscar duplicados antes de crear. Leer `ops_stores`, `ops_expense_categories` y `ops_suppliers` mediante `operation=read`, paginando cuando `possibly_more=true`.
2. Preparar `expense` y `lines` según `CUENTA_CHATGPT_GASTOS.md`, con UUID request_id estable. Una edición intencionada usa otro request_id y el expected_updated_at de una lectura reciente. Un reintento conserva el mismo contenido y UUID.
3. Enviar `validate_expense` por `totus_agent_submit`. Exigir validated=true, simulation=true, persisted=false. Esto ejecuta el guardado normal en una subtransacción revertida; no registra un gasto permanente.
4. Con datos y autorización suficientes, enviar `save_expense` y releer cabecera, líneas, autor y total mediante `expense_context`. Conservar un guardado incierto y buscar su solicitud antes de repetir.
5. Incorporar original por `attach_chat_file` si es PDF de un chat autorizado, o por el circuito documental normal correspondiente. Verificar bytes, tamaño, SHA-256 y vínculo doble; un archivo suelto en OneDrive no es un gasto registrado.
6. Cotejo documental, revisión fiscal y pago son estados independientes. Un justificante no demuestra automáticamente los tres. Conservar revisiones pendientes y no inventar fecha/medio de pago.

Prueba real: validación de una factura ficticia con una línea de base 10 e IVA 21 mediante la cuenta activa; completed, validated=true, simulation=true, persisted=false. Consulta posterior por su número QA confirmó cero gastos conservados. No se guardó una factura ficticia ni se alteró contabilidad real. Los tests de guardado/relectura, adjuntos, errores, concurrencia y recuperación son aislados.

## Factura, entrada y cotejo

1. Listar `ops_stock_receipts` con `operation=read`. Elegir la recepción por tienda y referencia y usar su ID real para `operation=rpc`, name=`totus_stock_context`, args=`{"p_id":"<id real>"}`. **p_id=null no lista recepciones**: se comprobó que devuelve error.
2. El contexto devuelve receipt, sources y equivalences. Leer todos los originales y páginas. Si la extracción está incompleta, leer el original mediante su ubicación de OneDrive; sin lectura suficiente, mantener cobertura pendiente.
3. Para una nueva recepción, usar `totus_stock_create`; incorporar documentos por `totus_stock_add_source` o `totus_stock_import_request`, con revisión recién leída. No insertar fichas documentales directamente ni duplicar factura y albarán como dos entregas.
4. Cotejar referencias, variante, unidad y conversión confirmada. Cantidad desconocida=null. Mantener source_id, line_id y localizador de cada documento. Guardar con `totus_stock_save_result` y su p_revision actual. El trabajador fija el actor propio; el servidor calcula diferencias y estado.
5. Releer contexto y resultado. Si cambió la revisión, volver a cotejar; no sobrescribir a ciegas. Cotejar no modifica existencias de PrestaShop ni crea un gasto. Si se solicita un movimiento real de stock, es otra operación de Productos, con autorización y relectura específicas.
6. `totus_stock_mark_reviewed` certifica una revisión justificada; no convierte diferencias documentales en coincidencias ni sustituye el original. No cerrar una revisión real durante una auditoría técnica.

Prueba real: lectura con la cuenta ChatGPT activa de una recepción y sus fuentes/equivalencias sin modificarla. Creación, asociación, revisión antigua, cantidades desconocidas, cobertura incompleta, ajustes, cierre e historial se comprueban con fixtures y PostgreSQL desechable; no se afirma un cotejo nuevo guardado en producción.

## Crear, modificar o copiar productos

1. Pedir `totus_prestashop_context` por operation=rpc; seleccionar conexión por store_key e ID, no por parecido de nombre. Usar la **revisión de conexión**, distinta de la revisión del registro de webs. Hortimatic 1.8 permanece fuera de esta auditoría por la pausa solicitada.
2. Enviar operation=products con args nativos. En `prestashop_read`, page es base cero y page_size es obligatorio (1..100). Por ejemplo: action, id de conexión, revision, store, call_id, resource="products", page=0, page_size=25. Omitir page_size devuelve error; no indica falta de acceso.
3. Para alta, consultar `prestashop_product_create_profile` **de la tienda destino**. Hortimatic devolvió idioma 1; NewOldSmok, 1 y 2. Enviar todos los idiomas de ese perfil en create_prepare, categoría real del destino y datos comerciales confirmados. No copiar IDs de relaciones entre tiendas.
4. Para edición, leer ficha actual y preparar solo los cambios solicitados con `prestashop_product_prepare`. Usar resource/record_id, idioma por campo localizado y expected_product_id para una combinación. Conservar los campos no elegidos.
5. `prepare` devuelve fingerprint y can_commit pero **no guarda**. Solo tras autorización usar el commit correspondiente con request_id estable, huella previa y confirmed=true. Las etapas conservan parent_request_id y step_key. La copia usa un alta del destino y sus relaciones/idiomas, no un clon ciego de IDs.
6. Ante respuesta incierta, consultar y conciliar la misma solicitud; nunca crear otra base. Releer producto, combinaciones, fotos, stock y precios incluidos en el alcance antes de declarar publicación completa. Una ficha creada parcialmente no se anuncia como terminada.

Pruebas reales: perfil, lectura y prevalidación de edición en Hortimatic; perfil y prevalidación de alta en NewOldSmok. No se envió ningún commit de producto. Las pruebas aisladas cubren alta, edición, copia, etapas, imágenes/variantes y pérdida de respuesta; una prevalidación real no equivale a una escritura real comprobada.

## Blindaje aplicable a futuros cambios

- `stability/circuits.json` declara consumidores, pruebas e invariantes. El circuito conventional-assistant cubre puente, identidad, gastos, adjuntos, recepciones y Productos.
- `tools/stability-gate.mjs` compara con la rama base y rechaza retirar circuitos, rutas consumidoras, pruebas o invariantes; mantiene el rechazo a exportaciones eliminadas y cambios sin recorrido declarado.
- El trabajo CI `conventional-assistant` ejecuta las pruebas de sesión propia y operaciones, además de los controles completos existentes de interfaz y PostgreSQL aislado. En esta revisión local: 123 tests aprobados, sin omisiones.
- No retirar una prueba para poner verde un cambio. No modificar datos reales para simular un éxito. Si evoluciona un contrato, revisar consumidores y transición explícitamente. Este control reduce regresiones; no puede garantizar ausencia absoluta de futuros defectos ni impedir por sí solo que alguien desactive las reglas de revisión del repositorio.

## Fuentes y relevo

Los archivos sincronizados `sources/` son referencias de solo lectura y contienen también originales financieros que no deben sustituirse. No existe aquí una herramienta autorizada para reemplazar automáticamente las Fuentes del proyecto ChatGPT. Preparar un paquete nuevo fuera de esa carpeta, con índice, documentación vigente, código exacto y SHA-256; su incorporación al proyecto es una acción separada. No presentar ese paquete como ya sincronizado.

Un chat nuevo debe consultar primero la rama vigente y este índice, no ejecutar antiguos SQL/migraciones por el nombre del ZIP. Conservar como históricos los informes anteriores, los originales y sus vínculos. No publicar correos personales, contabilidad, credenciales, resultados completos de trabajos ni URLs temporales en el paquete público.
