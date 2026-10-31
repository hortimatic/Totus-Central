# Totus Central · entrada vigente para ChatGPT

Vigente: 31/10/2026. Leer este documento desde la rama `totus-central` de GitHub al comenzar. Es la entrada actual; las fechas, propuestas y procedimientos anteriores conservados en el historial no prueban el estado instalado.

## Servicios e identidad
- Aplicación: https://hortimatic.github.io/Totus-Central/
- Código y documentación: `hortimatic/Totus-Central`, rama `totus-central`.
- Supabase: proyecto `awmojepsasikxocoeqtu`.
- OneDrive privado: `Apps/Totus Central`. Datos relacionales en Supabase, originales y diez juegos de copia en OneDrive, código en GitHub. No mover o renombrar los archivos administrados por fuera del circuito de Totus.
- Cuenta de trabajo: ChatGPT · Asistente Totus. No usar la identidad del titular ni inventar JWT, `auth.uid()` o permisos.
- No se necesita Work para las operaciones disponibles en los conectores convencionales. No contratar API ni servicios. Un chat convencional debe ser iniciado por una persona: no está escuchando permanentemente el chat interno.

## Comenzar sin repetir configuraciones
1. Descubrir las herramientas efectivamente disponibles de GitHub, Supabase y Microsoft SharePoint/OneDrive personal.
2. Leer este documento y el manual del módulo desde GitHub. Las fuentes subidas a un proyecto son una fotografía: contrastar siempre la versión vigente antes de cambiar código o datos.
3. Consultar mediante Supabase:
```sql
select private.totus_assistant_capabilities();
select private.totus_assistant_submit('session_check');
```
4. Recoger el resultado del UUID devuelto en una llamada posterior:
```sql
select private.totus_assistant_result('<job_id>'::uuid);
```
`queued` no significa ejecutado. Solo `completed`, `authenticated=true`, `session_verified=true` acredita la sesión propia. `auth.uid()` nulo en el conector SQL administrativo no describe la sesión Auth del worker.
5. OneDrive: usar las herramientas para drive personal y los identificadores exactos devueltos por el conector. Entrar por Apps/Totus Central, confirmar la ruta e identificar el documento antes de usarlo. No buscar un sitio empresarial inexistente ni crear otra carpeta Totus.

## Operaciones del contrato vigente (versión 3)
| Acción | Finalidad | Comprobación final |
|---|---|---|
| session_check | Autenticar la cuenta propia | completed y sesión verificada |
| expense_context | Leer gasto, líneas, documento y ajustes | Coinciden ID, tienda y factura |
| validate_expense | Ensayar el guardado con reversión | simulation=true, persisted=false |
| save_expense | Alta/edición por el procedimiento normal | Releer cabecera, líneas y autor |
| attach_chat_file | Incorporar PDF del Chat al gasto | Vínculo doble, tamaño y SHA-256 |
| review_document | Cotejo del original | Estado documental releído |
| chat_read | Leer canales permitidos | Cuenta miembro y canal correcto |
| chat_send | Responder en el canal | Releer mensaje, autor y client_id |

Consultar el contrato del servidor en cada sesión, no asumir que existe una acción no enumerada. Para los formatos y argumentos completos: [Gastos](CUENTA_CHATGPT_GASTOS.md), [Chat](CHATGPT_CHAT_INTERNO.md), [Recepciones](COTEJOS_CHATGPT.md).

El puente no es una RPC universal. Cajas, Facturación, usuarios, restauraciones y cambios técnicos no se convierten en operaciones autorizadas de este puente por tener un conector administrativo. Utilizar el recorrido normal documentado y una sesión legítima con permiso. Si no está disponible ese recorrido, indicar exactamente cuál falta; no fabricar identidad ni escribir directamente tablas contables. La cuenta técnica no debe recibir administración universal para ocultar un error de validación.

## Registrar y comprobar un gasto
- Leer original completo: destinatario, tienda, proveedor/NIF, número, emisión, líneas, base, IVA, recargo, retención y total. La fecha de pago es independiente. Una factura pendiente de publicar no se inventa.
- Consultar referencias reales y duplicados antes del alta. Las facturas prevalecen sobre errores de transcripción del Excel confirmados por el titular.
- Mantener un request_id estable para una operación y sus reintentos. Al editar, releer expected_updated_at y conservar los campos y líneas no modificados.
- Simular con validate_expense, guardar cuando esté autorizado y releer el resultado. No confundir cotejo del documento, revisión fiscal y pago: son tres estados distintos.
- Fiscalmente revisado solo si existe evidencia suficiente. Una nota antigua no acredita un pago. No cambiar automáticamente un estado real para cuadrarlo con una observación histórica.
- Gastos internos e impuestos pagados se registran por el circuito normal como solo información interna y no reducen el beneficio fiscal. Admiten justificante como adjunto normal.
- Adjuntar el original correcto y verificar su lectura, enlace, tamaño y huella. Subir un PDF suelto a OneDrive no crea el gasto ni su vínculo.

## Si una herramienta bloquea una llamada
- Separar: bloqueo de seguridad de la plataforma antes de enviar; conector desconectado; permiso real de Totus; validación de entrada; trabajo queued; error del servicio. No llamarlos todos «falta de acceso».
- Guardar operación, error exacto y fase alcanzada, sin claves ni datos innecesarios. No repetir indefinidamente ni crear duplicados; releer si el resultado fue incierto.
- No pedir contraseña, tokens, desactivar seguridad o Work por defecto. Mantener las reglas de aprobación del conector; Totus no puede anularlas. Si hay una autorización pendiente, el usuario debe aprobarla en su interfaz.
- No utilizar SQL directo para eludir una denegación del procedimiento de negocio. Un resultado denegado debe corregirse en su causa y comprobarse con identidad legítima.

## Copias y cambios simultáneos
- Programación: 00:35 Europe/Madrid, servidor, diez juegos completos; una nueva copia solo retira una antigua después de verificarse.
- La copia fraccionada captura datos, documentos y código. Durante su preparación no sustituir ni eliminar los originales de su inventario. El trabajo normal y los documentos nuevos continúan; el servidor libera la protección al terminar o fallar el intento.
- `running`, `pending` o una tarea cron correcta no acreditan una copia completa. Exigir `success`, índice y componentes guardados, verificación de OneDrive y ensayo de lectura de recuperación.
- Verificar no es restaurar. No ensayar restauraciones en producción ni borrar respaldos para limpiar apariencias.

## Arreglos técnicos
Leer [protocolo](PROTOCOLO_MANTENIMIENTO_2026-10-27.md), crear revisión separada, reproducir con datos ficticios, cambiar la causa sin quitar funciones, probar éxito/error/reintento/sesión/tamaños afectados, pasar CI y coordinar cliente/servidor/SQL. Nada de publicar credenciales o contabilidad. No alterar periodos aceptados, ni aplicar migraciones históricas otra vez por su nombre. Verificar la versión instalada y el registro de migraciones.

## Fuentes que conservar
Conservar el paquete de código exacto de la revisión publicada y este inicio, el índice de entrega, los manuales de trabajo y el informe de estabilización. Archivar las auditorías históricas como antecedentes; no tratarlas como tareas vigentes. Las fuentes financieras originales se conservan: no son basura del código.
