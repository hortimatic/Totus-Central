# Totus Central · acceso propio de ChatGPT y Codex

Contrato 4. Este documento describe el código del cambio; comprobar su instalación mediante `private.totus_assistant_capabilities()` antes de utilizarlo. Un archivo en Fuentes no concede conexiones ni permisos por sí mismo.

## Inicio de cualquier chat

1. Leer `docs/INICIO_CHATGPT_ACTUAL.md` de `hortimatic/Totus-Central`, rama `totus-central`. No reconstruir instrucciones buscando conversaciones antiguas.
2. Descubrir GitHub, Supabase y Microsoft SharePoint/OneDrive personal entre las herramientas realmente conectadas. El proyecto Supabase es `awmojepsasikxocoeqtu`; OneDrive es `Apps/Totus Central`, drive `5F6E3002ABE1051C`. No buscar un sitio empresarial ni crear otra carpeta raíz.
3. Consultar capacidades, solicitar sesión propia y recoger el resultado en una llamada posterior:

```sql
select private.totus_assistant_capabilities();
select private.totus_assistant_submit('session_check');
-- Usar exclusivamente el UUID que devuelve la solicitud anterior:
select private.totus_assistant_result('<job_id>'::uuid);
```

Codex utiliza `private.totus_codex_submit` en lugar de `private.totus_assistant_submit`; ambos comparten `totus_assistant_result`. No intercambiar las identidades. El servidor inicia sesión con la cuenta Auth propia y cierra esa sesión al terminar. Nunca solicitar, leer o devolver las credenciales guardadas en Vault.

`completed`, `authenticated=true`, `session_verified=true` y el email propio acreditan la sesión. El campo `role` muestra el rol real de esa sesión. `queued` solo acredita recepción. El `auth.uid()` nulo del conector SQL administrativo no significa que el trabajador carezca de sesión.

## Operaciones por módulo

Las acciones anteriores de Gastos y Chat siguen disponibles: `expense_context`, `validate_expense`, `save_expense`, `attach_chat_file`, `review_document`, `chat_read`, `chat_send`. También `chat_direct` para abrir una conversación legítima.

El catálogo adicional se solicita así:

```sql
select private.totus_assistant_submit('operation', '{"operation":"catalogue"}'::jsonb);
```

Recoger su resultado antes de preparar argumentos. Incluye nombres exactos de RPC, argumentos admitidos y tablas disponibles para lectura con RLS. No admite SQL libre ni llamadas internas de servicio.

| Módulo | Procedimiento normal disponible |
|---|---|
| Cajas | `totus_save_closing`, `totus_delete_closing`; cabecera y cajones por lectura |
| Gastos | Acciones específicas anteriores; pagos, categoría de informe y eliminación mediante sus RPC normales |
| Facturación | Guardar borrador, emitir, convertir proforma, registrar documento externo y pagos mediante sus RPC |
| Recepciones | Contexto, crear, editar, asociar/importar fuentes, cotejar, corregir unidades y marcar revisión mediante `totus_stock_*` enumeradas |
| Pricing | `totus_pricing_save_product`, `totus_pricing_save_provider`; lectura de variantes y precios |
| Tareas | Contexto, comandos, historial y conversión de mensaje mediante sus RPC |
| Configuración | Apariencia personal y Login mediante sus RPC y revisiones |
| Informes/Fiscalidad | Leer registros necesarios, guardar orden de bloques; nunca fabricar un total fiscal |
| Administración | Medición real de almacenamiento, cierre de periodos y limpieza de Log con las confirmaciones del procedimiento |

Para ejecutar una RPC enumerada:

```sql
select private.totus_assistant_submit('operation', jsonb_build_object(
 'operation','rpc','name','totus_tasks_context',
 'args',jsonb_build_object('p_from','2026-10-01','p_to','2026-10-31')));
```

Para leer con la identidad propia:

```sql
select private.totus_assistant_submit('operation', '{
 "operation":"read","table":"ops_daily_closings","limit":50,"offset":0,
 "order":"business_date","ascending":false,
 "filters":[{"column":"business_date","operator":"gte","value":"2026-10-01"}]
}'::jsonb);
```

Máximo 200 filas por página, ocho filtros, operadores `eq/gte/lte`. Paginar hasta completar el conjunto requerido; no sumar una página incompleta como si representara todo el periodo. Si `possibly_more=true`, comprobar la página siguiente. No se exponen tablas Auth, Vault ni configuración con secretos.

## Guardado y comprobación

- Leer originales completos antes de registrar datos. Verificar tienda, destinatario, número, importes y unidades. No confundir fecha de factura, venta y pago.
- Cierres y facturas: crear `request_id` UUID antes del primer envío y conservarlo al reintentar una misma operación. Ediciones requieren `expected_updated_at` de una lectura reciente. No generar un UUID nuevo para ocultar un guardado incierto.
- Recepciones: conservar `revision` leída y enviar referencias originales. El servidor fija `p_actor_email` a la identidad propia; no utilizar al administrador humano como autor.
- La respuesta `executed=true` no equivale a comprobación completa: releer el registro y las líneas, los documentos vinculados y el resultado en el módulo consumidor. Comprobar cálculos mediante las funciones canónicas de `src/`; no implantar una fórmula alternativa en el chat.
- Gastos: cotejo documental, revisión fiscal y pago son independientes. Conservar los casos que el titular haya dejado pendientes de revisión fiscal hasta nueva evidencia/autorización.
- Los impuestos pagados y demás gastos internos conservan justificante, pero no reducen el beneficio fiscal. No duplicar un pago cotejado con su factura.
- Eliminar, retirar una fuente, cerrar periodos o ejecutar limpieza exige autorización explícita de la persona y `confirmed:true` en el envío. Esa bandera no sustituye la autorización. Las RPC mantienen sus comprobaciones y auditoría.
- Las operaciones de recuperación, secretos, registro documental reservado al servidor y ejecución SQL arbitraria no se incluyen en este catálogo. Para funciones no enumeradas, usar su recorrido normal documentado; no insertar directamente tablas contables para saltarse una validación.

## Documentos y OneDrive

Leer y escribir archivos mediante Microsoft SharePoint personal usando IDs exactos, verificando destino y relectura. No renombrar ni mover por fuera de Totus los originales que ya están vinculados. Un PDF suelto en OneDrive no crea un gasto ni una recepción. Para gastos del Chat, `attach_chat_file` verifica bytes y vínculo; para recepciones, el procedimiento de importación verifica el original y su revisión. La lectura textual de PNG o ZIP puede no estar soportada aunque el archivo exista: verificar metadatos/bytes con una herramienta compatible, sin inventar contenido.

## Bloqueos y relevo sin repetir trabajo

Distinguir rechazo de plataforma antes del envío, desconexión del conector, sesión incorrecta, validación de negocio y trabajo pendiente. Informar del error exacto y la fase. No reintentar indefinidamente ni suplantar al propietario. Ningún manual puede anular aprobaciones de ChatGPT/GitHub/Microsoft. No ofrecer Work o una API como requisito si los conectores disponibles bastan.

Al llenar el chat, dejar un relevo compacto con: versión/commit verificados, petición activa, hechos terminados, PR y pruebas, IDs de operaciones pendientes, originales exactos, `request_id` ya enviados, cambios aún sin publicar y siguiente acción. Nunca incluir contraseñas, tokens, enlaces temporales de descarga ni datos contables innecesarios. El siguiente chat lee esta entrada y el relevo; no debe rehacer toda la configuración.

## Mantenimiento de código

Preservar estructura, funcionalidades y datos. Una petición concreta, un cambio revisable, pruebas dirigidas al recorrido afectado y sus consumidores; publicación solo tras controles. No mezclar una mejora visual con restauraciones, limpieza de datos o cambios fiscales. GitHub contiene código/manuales; Supabase, datos y funciones; OneDrive, documentos y diez copias completas. No instalar un servicio permanente en un ordenador para que funcione Totus. La cuenta en el chat interno no implica escucha automática de un modelo con el ordenador apagado.
