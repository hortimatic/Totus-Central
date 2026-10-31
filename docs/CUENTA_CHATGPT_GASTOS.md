# ChatGPT y Totus Central: conexión de Gastos
Vigente: 31/10/2026. Este documento sustituye las instrucciones anteriores de esta conexión.

## Al comenzar cualquier chat
Lee este manual desde la rama vigente de GitHub. Comprueba primero:
```sql
select private.totus_assistant_capabilities();
```
El contrato vigente es versión 3; consulta siempre private.totus_assistant_capabilities(). Usa el conector Supabase autorizado del propietario. Las consultas SQL entran como conexión administrativa y NO son una sesión personal: auth.uid() nulo en SQL no demuestra que el worker esté desconectado. Las operaciones siguientes abren y verifican una sesión Auth REAL de la cuenta **ChatGPT · Asistente Totus**. No simulan la identidad del titular.

La cuenta tiene permisos individuales para Gastos y Documentos, y lectura de Inicio y Equipo. Solo puede leer adjuntos de canales en los que sea miembro. No tiene administración ni borrados. El worker no crea cuentas, no reactiva usuarios y no cambia permisos: se ha retirado la antigua acción setup.

## Presentar operaciones y recoger resultados
```sql
select private.totus_assistant_submit('session_check') as request;
-- En una llamada posterior, con el job_id devuelto:
select private.totus_assistant_result('<job_id>'::uuid);
```
La solicitud inicial queued NO significa completada. Espera unos segundos, sin bucles rápidos, y recoge completed o failed. Si una solicitud no arranca, consulta el http_request_id y su caducidad antes de reenviar. Si hubo un resultado incierto, comprueba registros antes de repetir.
La conexión admite exactamente:
- session_check: comprueba identidad real.
- expense_context: consulta gasto, líneas, documento, estados y régimen configurado.
- validate_expense: validación del guardado dentro de una subtransacción que se revierte; persisted=false.
- save_expense: alta o edición mediante totus_save_expense con la sesión propia.
- attach_chat_file: incorpora el PDF de un mensaje al gasto.
- review_document: actualiza el estado documental y registra el cotejo sin cambiar la fiscalidad ni el pago.
- chat_read y chat_send: lectura y respuesta en los canales autorizados, según CHATGPT_CHAT_INTERNO.md.

## Registrar una factura
1. Comprueba la petición del usuario, original, titular destinatario, tienda, proveedor/NIF, número, fecha, conceptos, base, IVA, recargo, retención y total. Consulta duplicados por proveedor y número. Las facturas originales prevalecen sobre errores de importe del Excel; una fecha del Excel puede corresponder al pago, no a la factura.
2. Consulta tiendas, categorías y proveedores existentes antes de elegir referencias. No inventes identificadores ni valores. Conserva conceptos de coste cero cuando estén en el original.
3. Prepara {"expense":{...},"lines":[...]} con el contrato normal totus_save_expense. Incluye request_id UUID estable para ESA operación. No cambies el UUID ni el contenido al repetirla por fallo de transporte.
4. Envía validate_expense y contrasta su resultado. La simulación no crea contabilidad permanente y no debe usar documentos reales como soportes de gastos ficticios.
5. Envía save_expense cuando la operación esté autorizada. Relee expense_id, cabecera, líneas y created_by. La cuenta de origen debe ser la del asistente.
6. Adjunta el original y comprueba el enlace doble y su integridad.
7. Completa el cotejo y la revisión fiscal según evidencias. Si falta información, conserva el estado pendiente y explica exactamente qué falta.

Campos de save_expense: los mismos del formulario y contrato existente, incluidos categoría, tratamiento interno/fiscal, deducción, porcentajes, activos, retención/modelo, pago, notas y report_group. fiscal_reviewed acepta true o false, no cadenas de texto. Un gasto nuevo permanece sin revisar por defecto; se marca true únicamente tras una revisión real/autorizada y con documentación suficiente. No hay ya una prohibición artificial de guardar true.

Para editar: lee expense_context, conserva todos los campos y líneas que no quieras cambiar, envía id y expected_updated_at recién leídos. Usa un request_id NUEVO para una modificación intencionada; conserva ese mismo UUID si solo estás reintentando. El servidor rechaza una ficha antigua o una solicitud reutilizada con contenido diferente.

## Adjuntar el PDF de un chat
```sql
select private.totus_assistant_submit('attach_chat_file', jsonb_build_object(
 'expense_id','<uuid-gasto>',
 'file_id','<uuid-ops_chat_files>',
 'request_id','<uuid-estable-del-adjunto>',
 'expected_updated_at','<updated_at-recién-leído>'
));
```
La cuenta debe tener acceso al canal del archivo. El servidor usa chat-file-content para verificar original, tamaño, firma PDF y SHA-256; después aplica el circuito normal «Guardar solo adjunto»: sube y relee el archivo privado, registra ops_documents y actualiza únicamente document_id con control de concurrencia. No cambia importes, líneas, impuestos, pago ni revisión fiscal. No sustituye automáticamente otro adjunto.

Comprueba document_id, linked_entity_type=expense, linked_entity_id, uploaded_by, sha256_verified y bytes_verified. Repetir la misma solicitud reutiliza archivo y documento. Si hubo un fallo tras una subida, el documento se conserva para revisar: no generes otro UUID para ocultarlo.

El archivo pasa por el bucket privado business-documents igual que en la interfaz. El espejo automático lo organiza y verifica en OneDrive. scheduled no equivale a espejo terminado; consulta el registro de copia. El original del chat se conserva. La lectura y vista previa deben resolver la ubicación vigente y comprobar huella y tamaño. No se guardan documentos de trabajo ni credenciales en el ordenador.

Esta acción admite PDF del chat. No afirmar que habilita cualquier formato o una importación genérica de archivos sueltos de OneDrive; esos casos utilizan su incorporación documental normal.

## Consultar contexto y cotejar
```sql
select private.totus_assistant_submit('expense_context',
 jsonb_build_object('expense_id','<uuid-gasto>'));
```
El resultado incluye expense, lines, document, fiscal_settings y review_states. Los tres estados son independientes:
- Documento revisado: se ha cotejado el original y su transcripción.
- Gasto fiscal revisado: se ha comprobado su tratamiento fiscal.
- Pago comprobado: hay evidencia suficiente de importe y fecha.

Para dejar constancia documental:
```sql
select private.totus_assistant_submit('review_document', jsonb_build_object(
 'expense_id','<uuid-gasto>','document_id','<uuid-documento>',
 'expected_sha256','<sha256-verificado>','expected_status','pendiente',
 'status','revisada','reason','Conceptos e importes cotejados con el original; indicar salvedades.'
));
```
La operación comprueba vínculo, huella, estado y notas antes de escribir. Un reintento idéntico no duplica la nota. No cambia la aceptación fiscal, deducibilidad ni pago.

La tabla distingue «Documento cotejado · revisión fiscal pendiente». Una fiscalidad pendiente no significa que el PDF no se haya subido ni cotejado.

## Fiscalidad y pago: no completar con suposiciones
Lee el régimen configurado y la factura concreta. IVA soportado, gasto deducible de IRPF y retenciones son conceptos distintos. No clasifiques automáticamente como no deducible solo por desconocimiento; conserva una propuesta identificada como pendiente de revisión cuando proceda. Tampoco marques aceptada una operación con dudas materiales para obtener un estado verde.

Una factura marcada PAID prueba que el emisor la considera pagada, pero no siempre acredita la fecha y medio necesarios para la conciliación interna. No inventes una fecha de pago ni uses la fecha de hoy para cerrarla. Explica la diferencia entre estado del emisor y pago conciliado en Totus. Las fechas de gasto y pago se validan con el calendario Europe/Madrid, incluso después de medianoche.

El titular ha indicado mantener el caso de Hostinger pendiente de aclaración fiscal. Su cotejo documental está completado. No cambiar esa decisión sin nuevos datos o indicación expresa.

## Seguridad y mantenimiento
La contraseña de la cuenta técnica permanece cifrada en Supabase Vault; el chat no debe leerla ni recibirla. Cada trabajo lleva un ticket servidor de un uso, aleatorio de 256 bits y con caducidad. El worker verifica ese ticket, inicia sesión con signInWithPassword, confirma getUser, ejecuta con los permisos de la cuenta y cierra su sesión al terminar. No usa la clave de servicio para guardar el gasto ni falsea claims. La clave de servicio solo atiende la infraestructura interna de trabajos/credencial.

No utilizar INSERT/UPDATE SQL directo para registros contables, fabricar JWT, establecer identidades con set_config, reenviar claves o ampliar permisos para evitar un error. Las consultas SQL de lectura y las funciones privadas documentadas del conector sí son la vía prevista. El runtime ya no ofrece setup ni aprovisionamiento de usuarios.

El administrador puede desactivar la cuenta desde Usuarios. Para reinstalar en otro servidor: un administrador crea una cuenta técnica propia mediante el procedimiento normal de usuarios, configura sus permisos y guarda en Vault la credencial coincidente de forma segura. Nunca pegar contraseñas en chats o manuales. Los respaldos documentales no sustituyen la configuración de secretos de un servidor nuevo.

## Archivos y verificación
- supabase/functions/totus-assistant/index.ts
- supabase/functions/totus-assistant/assistant-attachments.ts
- supabase/review_patches/015_assistant_own_auth.sql y 016: base histórica.
- supabase/review_patches/017_assistant_complete_expense_workflow.sql: contrato actual y retirada de setup.
- supabase/review_patches/018_expense_business_calendar.sql: fechas de negocio en gastos/pagos.
- tests/assistant-own-auth.mjs, assistant-attachments.mjs, assistant-expense-view.mjs.
- tests/assistant-business-calendar.sql: comprobaciones de integración de solo lectura, con transacción reversible.

Ejecutar las pruebas Node con Node 24. La verificación de este circuito no equivale a una auditoría completa de todos los módulos de Totus. Antes de prometer una función nueva, comprobar que existe, probar su recorrido y registrar sus límites reales.
