# Totus Central · Equipo de trabajo con varios chats ChatGPT
**Inicio:** 11/11/2026 · **Estado:** organización propuesta en PR documental; no aplicada a producción hasta integración y aceptación.
**Registro vivo:** [Coordinación #173](https://github.com/hortimatic/Totus-Central/issues/173).
**Instrucciones de apertura:** [Mensajes para cada chat](EQUIPO_CHATGPT_MENSAJES.md).

## 1. Finalidad y límites
Pueden trabajar **varias conversaciones independientes de ChatGPT** sin Codex, siempre que haya reparto explícito y revisión conjunta. No son procesos de fondo: cada conversación requiere que una persona la inicie; no hay comunicación entre chats ni transferencia automática de sesión o herramientas. Compartir la misma cuenta Auth de ChatGPT para Totus no crea operadores distintos ni bloqueos automáticos. Los nombres C0/C1/C2/C3 identifican funciones de coordinación, no identidades de seguridad.

Conservar la única producción de Totus Central:
- GitHub `hortimatic/Totus-Central`, rama `totus-central`: código, pruebas y documentos.
- Supabase `awmojepsasikxocoeqtu`: datos, permisos y procesos. El contrato Auth real y `operation/catalogue` mandan.
- OneDrive personal `Apps/Totus Central`: originales y copias. No mover ni renombrar originales fuera del circuito.
- Web de producción `https://hortimatic.github.io/Totus-Central/`.

No reconstruir funciones validadas, rediseñar lo no solicitado, modificar fiscalidad histórica ni probar borrados, facturas reales, pagos, stock o restauraciones sobre producción. Ninguna tarea autoriza suplantar al titular, abrir secretos o saltar aprobaciones. Seguridad, datos, dinero, SQL, migraciones, copias y arquitectura exigen revisión técnica independiente competente antes de publicarse.

## 2. Organización inicial
| Chat | Función | Ficha de GitHub | Situación al abrir este plan |
| --- | --- | --- | --- |
| **C0** | Coordinación, reservas de superficie, PR, pruebas, aceptación y publicación única | [#173](https://github.com/hortimatic/Totus-Central/issues/173) | Registro de referencia; no publicar por defecto |
| **C1** | Inicio y apariencia | [#174](https://github.com/hortimatic/Totus-Central/issues/174) | Revisar primero PR #168, #171 y #172; no duplicarlos |
| **C2** | Productos y PrestaShop | [#175](https://github.com/hortimatic/Totus-Central/issues/175) | Revisar primero PR #145 y #146; no reejecutar escrituras |
| **C3** | Recepciones y cotejos | [#176](https://github.com/hortimatic/Totus-Central/issues/176) | Auditoría funcional, documentación de pruebas, sin alterar datos |
| **C4** | Cajas, tickets y Facturación | [#177](https://github.com/hortimatic/Totus-Central/issues/177) | Cartera, no desarrollar hasta liberar dependencias |

**Prioridad:** respetar el Plan de trabajo de 05/11/2026 (estilos/Inicio, estudio PrestaShop, Cajas, ticket→factura, Recepciones, consultas, transversales, futuro). El reparto en paralelo permite análisis aislado; **no altera el orden de aceptación ni autoriza tantos cambios como chats**. Si dos trabajos comparten ficheros, RPC, tablas, funciones, conexión PrestaShop, publicación o los mismos registros, C0 secuencia ambos.

## 3. Fuente de verdad y autorizaciones
La fuente operativa de cada encargo es **una incidencia de GitHub** y los comentarios fechados; los documentos son normas, no un estado vivo infalible. El responsable C0:
1. Relee HEAD y los PR abiertos antes de asignar; identifica solapamientos por archivos, funciones, contratos y datos, no solo por nombre de módulo.
2. Autoriza en comentario de la incidencia: **RESERVA Cx / base / alcance exclusivo / archivos o servicios / pruebas / dependencias / siguiente revisión**. Un especialista no se autoasigna.
3. Una reserva de análisis en modo lectura no autoriza escrituras. Para pasar a desarrollo se exige una **reserva de modificación separada y explícita**.
4. Mantiene un único PR candidato a integración/publicación cada vez; otros PR pueden permanecer en borrador sin modificar producción.
5. Si un PR previo está abierto y tiene propietario de otra conversación, no lo modifica ni actualiza sin coordinación y asignación expresa.

Cada especialista antes de operar:
1. Lee `docs/INICIO_CHATGPT_ACTUAL.md`, `docs/PROTOCOLO_MANTENIMIENTO_2026-10-27.md`, el manual vigente de su módulo y el comentario más reciente de su incidencia.
2. Verifica una lectura real de GitHub, Supabase y OneDrive cuando corresponda. Para operaciones Totus, comprueba identidad ChatGPT propia, `completed/authenticated/session_verified`, el catálogo del servidor y revisiones actuales. `queued` no acredita nada persistido.
3. Registra alcance, ficheros, RPC, tablas, pruebas, riesgos y base actual, antes de tocar código o datos.
4. Solo tras **RESERVA MODIFICACIÓN** crea su rama desde HEAD vivo y hace cambio mínimo. No modifica `totus-central` directamente.
5. Prepara PR hacia `totus-central` con matriz de pruebas, diferencias y acciones reales vs simuladas, sin automerge. Si hay conflicto, se detiene y lo reporta.
6. Al terminar, deja en su incidencia y relevo: commit, PR, cambios exactos, pruebas y límites, registros afectados, IDs/`request_id` pendientes, siguiente acción. Nunca claves.

## 4. Estados de incidencia
- **REGISTRADA**: identificada; sin intervención.
- **EN ESPERA**: esperando coordinación, fuentes o dependencias; puede hacer lectura/análisis si se indicó.
- **RESERVADA LECTURA**: C0 permite investigar sin escribir en sistemas.
- **RESERVADA MODIFICACIÓN**: C0 ha delimitado los cambios exclusivos y rama.
- **EN DESARROLLO**: rama de tarea activa y controlada.
- **EN REVISIÓN**: PR abierto, pruebas pendientes o evaluación de cambios.
- **BLOQUEADA**: causa reproducible y acción necesaria registradas; no reintentar por intuición.
- **PUBLICADA**: despliegue y versión comprobados; no significa aceptación humana.
- **ACEPTADA**: recorrido completo y persistencia confirmados por el titular, sin pendientes del alcance.

Los nombres y estados se anotan con comentario fechado; no suponer una actualización instantánea en otro chat. Antes de cada escritura, volver a leer los comentarios y PR. Si falla un bloqueo administrativo, detener ese frente y consultar al coordinador.

## 5. Revisión e integración
1. Reproducción del error y resultado esperado concretos, con datos ficticios o entorno aislado.
2. Diff acotado; preservar funciones, datos, apariencias, permisos y cálculos anteriores. Revisar nuevos consumidores del contrato.
3. Pruebas unitarias/integración, fallos, reintentos, doble acción, concurrencia, cambio de sesión, pantalla y regresiones pertinentes; distinguir simuladas de reales.
4. Para dinero/seguridad/SQL/copias/arquitectura, **revisión técnica competente independiente**; C0 no debe simularla afirmando que otro chat constituye una revisión suficiente.
5. Antes de publicar: backup completo verificado, autorización pertinente, CI y revisión de PR. Integrar una modificación cada vez, comprobar publicación GitHub Actions, HEAD desplegado y flujo autenticado consumidor.
6. El titular valida el resultado práctico en la interfaz. No cerrar el expediente por `CI green` ni por recibir HTTP 200.
7. No usar un ROLLBACK SQL como garantía sobre llamadas a APIs o subidas externas; conservar identificadores y resolver solicitudes inciertas por relectura, sin duplicados.

## 6. Convenciones de ramas y relevo
- Rama individual de cada cambio: `fix/<modulo>-<incidencia>-<aaaammdd>` o `feat/<modulo>-<incidencia>-<aaaammdd>`. Documentación: `docs/<objetivo>-<fecha>`.
- No se crean ramas para reservar un módulo sin tarea definida. No reutilizar una rama de otro chat.
- PR en borrador mientras falte una prueba, revisión o aprobación; no habilitar auto-fusión.
- Relevo mínimo: fecha/hora Madrid, chat/issue, versión base/HEAD, rama/commit/PR, alcance, archivos/RPC/registros, resultados comprobados, pruebas no ejecutadas, operaciones pendientes con IDs y `request_id` originales, bloqueo y siguiente paso.

## 7. Qué NO está automatizado
No existe en este protocolo un agente central ejecutándose solo, ni un mecanismo nativo que impida automáticamente que dos chats de ChatGPT envíen operaciones simultáneas. La exclusividad depende de C0, comentarios y disciplina de comprobación. Si se desea bloqueo técnico real habrá que diseñar y probar otro mecanismo por separado, sin mezclarlo con esta organización.

**Este procedimiento no despliega ni cambia la aplicación.** La adopción requiere revisar e integrar el PR documental; las incidencias del equipo ya pueden servir como registro común sin afectar el funcionamiento de Totus.
