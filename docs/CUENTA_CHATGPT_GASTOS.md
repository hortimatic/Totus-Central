# Cuenta propia de ChatGPT para Gastos
Fecha: 27/10/2026. Complemento del manual vigente. No sustituye las instrucciones contables.

## Identidad y autorización
La cuenta visible es **ChatGPT · Asistente Totus**. Es una cuenta técnica Auth real, no un rol universal ni la sesión del administrador. Su dirección terminada en .invalid es un identificador interno: no es un buzón para recuperación por correo. La contraseña aleatoria (68 caracteres, dentro del máximo de Auth) se guarda cifrada en Supabase Vault; nunca debe copiarse a un chat, GitHub, OneDrive ni archivos locales. El administrador puede desactivar la ficha en Usuarios. El servidor comprueba de nuevo que esté activa en cada trabajo; las funciones normales conservan su autorización.

Se usa el rol existente Encargado con permisos individuales explícitos: Inicio de consulta, Gastos y Documentos de consulta/alta/edición; todas las acciones de los demás módulos denegadas, sin borrados ni exportaciones. La conexión solo ofrece setup, session_check, validate_expense y save_expense; no expone pagos, restauraciones ni seguridad. No prometer que este cambio demuestra todos los demás recorridos de la herramienta.

## Cómo trabaja ChatGPT convencional
Usa el conector Supabase ya autenticado del propietario. Este conector entra como postgres y puede presentar solicitudes; no es una sesión personal de Totus. El servidor crea una solicitud cifrada con un ticket aleatorio de 256 bits, uso único y caducidad de dos minutos, y la envía mediante pg_net al worker totus-assistant. El worker verifica y consume el ticket, inicia una sesión real con signInWithPassword de la cuenta técnica, comprueba getUser y llama totus_save_expense mediante ese cliente autenticado normal. No modifica claims ni fabrica JWT. Cierra la sesión propia al terminar. La clave de servicio se utiliza únicamente para aprovisionamiento, lectura del trabajo y publicación de su resultado, no para guardar el gasto.

La función antigua private.totus_connector_save_expense, que delegaba temporalmente la identidad del titular, se ha retirado.

### Comprobación de sesión
En Supabase execute_sql:
```sql
select private.totus_assistant_submit('session_check') as request;
```
Conserva job_id. En otra llamada, después de unos segundos:
```sql
select private.totus_assistant_result('<job_id>'::uuid);
```
Los estados son queued, running, completed, failed. Solo completed con authenticated=true y session_verified=true demuestra sesión válida. El resultado nunca contiene contraseña ni tokens. Una petición expirada que no arrancó puede permanecer queued; consulta la respuesta net del http_request_id antes de reenviar. No hagas bucles rápidos.

### Preparar, validar y guardar un gasto
1. El usuario debe autorizar la operación real. Consulta original y duplicados; los originales de factura prevalecen sobre errores del Excel. No inventes fechas de pago, proveedor, impuestos ni aceptación fiscal.
2. Construye el JSON del contrato normal totus_save_expense. expense debe incluir request_id UUID fijo para todos los reintentos de la misma operación y fiscal_reviewed=false. lines es el array normal. La edición exige id y expected_updated_at recién leídos.
3. Usa validate_expense con el objeto {"expense": {...}, "lines": [...]}. Reproduce el guardado dentro de una subtransacción que se revierte; persisted=false. El resultado incluye actor, importe y líneas para contrastar. No es una factura ya guardada.
4. Para el alta autorizada, presenta el mismo payload con save_expense. Relee el resultado por job_id: expense_id, expense y lines. Contrasta created_by de la cuenta técnica, importes, tienda, referencia y estado. El gasto sigue siendo editable por el usuario normal según permisos y protecciones históricas existentes.
5. Reutiliza el document_id del original administrado en Totus si ya está en el chat interno. Comprueba que corresponde al PDF exacto y que su vínculo OneDrive es válido. No basta con subir un archivo a OneDrive. Esta primera conexión no incorpora una nueva acción de subida documental genérica; para archivos ajenos al circuito actual hay que usar y verificar la incorporación normal antes de guardar su document_id.
6. fiscal_reviewed=false significa pendiente de revisión; NO presupongas que es un borrador excluido de todos los indicadores. Comprueba la lógica fiscal vigente antes de afirmar su efecto. Nunca uses management_only artificialmente para ocultar un gasto fiscal.
7. Si el guardado terminó pero falló la relectura o publicación de resultado, consulta primero por número/proveedor y por el request_id. Reenvía solo el mismo UUID y contenido, no generes otro que duplique el alta.
8. No uses INSERT/UPDATE directo en las tablas contables, set_config de identidad, JWT inventados ni claves de servicio.

Ejemplo de estructura (todos los valores son ficticios):
```sql
select private.totus_assistant_submit('validate_expense',
 jsonb_build_object(
  'expense',jsonb_build_object(
   'store_id','<uuid-tienda>',
   'expense_date','2026-10-27',
   'supplier_name','Proveedor de ejemplo',
   'invoice_number','EJEMPLO-1',
   'paid_status','pendiente',
   'amount_paid',0,
   'fiscal_reviewed',false,
   'request_id','<uuid-operacion>'
  ),
  'lines','[{"description":"Ejemplo","base_amount":19.99,"vat_rate":21,"vat_amount":4.20,"irpf_imputable":24.19,"deductible_irpf":true}]'::jsonb
 ));
```
No utilices estos datos de ejemplo como contabilidad ni presupongas su tratamiento fiscal para una factura real.

## Implementación y mantenimiento
- Código: supabase/functions/totus-assistant/index.ts.
- Instalación consolidada: supabase/review_patches/015_assistant_own_auth.sql.
- Pruebas: node --test tests/assistant-own-auth.mjs (Node 24 o compatible con stripTypeScriptTypes).
- verify_jwt=false es deliberado SOLO para este worker: autentica el ticket propio dentro de la función, no acepta solicitudes anónimas sin ticket válido. No trasladar este ajuste a otras funciones.
- Los auxiliares públicos claim/complete están revocados a PUBLIC/anon/authenticated y concedidos solo a service_role. Los auxiliares privados submit/result son del conector administrativo. Validación reversible requiere la cuenta técnica autenticada.
- Credencial y trabajos temporales están cifrados en Vault; se purgan los trabajos de más de siete días al presentar otro. No se añaden tablas de negocio ni cambia su huella de recuperación.
- Vault no equivale al paquete contable descargable. Recuperación en otro servidor: instalar código/SQL, aprovisionar una cuenta nueva con setup y credencial nueva; no copiar contraseñas en manuales.
- El alta configura la cuenta; NO vuelvas a ejecutar setup como prueba rutinaria porque reestablece sus permisos operativos. Para comprobar, usa session_check.
- Si la cuenta está desactivada, no reactivarla sin petición del titular. Si se cambia su contraseña manualmente, la conexión fallará hasta renovar el secreto por un procedimiento administrativo seguro.
- No mostrar secretos en consultas, logs, diagnósticos o capturas.
- La interfaz y los cálculos existentes no se rediseñan con este cambio.

## Evidencia real
Cuenta creada y getUser confirmado con UUID propio; validación de 19,99 + 4,20 = 24,19 ejecutada a través de sesión Auth real, created_by propio, línea correcta y reversión comprobada sin restos en ops_expenses. Tickets incorrectos y reutilizados rechazados; auxiliares sensibles sin EXECUTE para navegador/anon. Ocho pruebas unitarias pasan.
Las comprobaciones reales detectaron y corrigieron: envoltura Deno.serve, Vault sin privilegio UPDATE (se usa bloqueo asesor, sin ampliar permisos de Vault), máximo 72 caracteres de contraseña Auth e identificador ambiguo en la validación reversible. No confundir estas pruebas de integración con una auditoría completa de toda Totus.
El caso real de Hostinger debe confirmarse por su gasto, línea, documento y auditoría, no deducirse de esta prueba ficticia.
