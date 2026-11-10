# Relevo · Inicio modular · 10/11/2026

## Petición activa y coordinación
1. **Nuevo Inicio modular de Totus Central**: implementación en PR #166, rama `feat/inicio-widgets-modulares-20261110`, **sin publicar**. El titular confirmó que Codex ha detenido su trabajo; no abrir un segundo frente modificando lo mismo.
2. **Conservar el Inicio real**: mantener `src/pages/main.js`, la gráfica `dashboard-activity.js`, cierres, las aperturas por tienda y cajón vía `lastDrawerBalance`, cajas, ingresos, gastos contables, control interno, tareas, informes y todos los accesos.
3. **PrestaShop doble tienda**: dos resúmenes a la vez y listado con filtros/paginación (10 pedidos por defecto), usando únicamente el puente autenticado de lectura y comprobando tienda, moneda y cobertura.
4. **Ganancia comercial**: visible como «Sin validar» hasta disponer de costes históricos de las combinaciones, descuentos, devoluciones y moneda verificadas. No confundir con resultado fiscal.
5. **Widgets**: catálogo, arrastre, redimensión, duplicación, ocultación y recuperación, configuración personal, orden por teclado/móvil; estilos heredan `Mi interfaz`.
6. **Persistencia personal**: RPC `totus_home_dashboard` propuesta en migración `20261110103900_inicio_modular_personal_layout.sql`; **NO aplicada** y sujeta a revisión técnica competente, test aislado de RLS/Auth y relectura.

## Cambios técnicos verificados en la rama
La base de partida de este trabajo fue `285ddff99939dec3abb3c630d4828cdfe9b25701`; la rama productiva avanzó a `4c92c8f45ffbd7ff2812f5438a310c319fabe930`. Consultar `compare_commits` y estado del PR antes de integrar, porque podrían aparecer nuevos commits.

En la continuación actual se corrigieron: recuperar widgets ocultos; confirmación antes de descartar cambios; evitar que una lectura tardía sustituya una edición; conservar Tareas sin permiso, con su aviso original; diagnóstico de controles interactivos en `subtab-walk-qa`; validación estricta de JSON y perfil activo en SQL; distribución compacta 4+4 KPI y 3+4+5 para que ambos resúmenes PrestaShop de 6 columnas queden en paralelo; eliminar el rótulo «Cliente TPV» sin origen demostrado; lectura descriptiva de retiradas por cierre y tienda, sin tratarlas como otro ingreso ni deducirlas.

## Pruebas y evidencia
- Local: `node tests/home-widgets-core-qa.mjs`: **19 PASS**.
- Playwright de componente con datos simulados: anchos **320, 390, 768, 1024, 1440 y 1920** sin errores JS ni desbordamiento; editor, duplicación, cambio de tamaño y guardado simulado. Esta prueba no acredita un recorrido completo con sesión real.
- Primer CI revisado: `42802009488`, dos fallos concretos: `operational-admin-browser-qa` no encontraba `#tasksHomeSummary` con permiso denegado, y `subtab-walk-qa` clasificaba botones `data-home-command` como inertes. Ambos corregidos en PR. Para aceptar el PR, comprobar que la **nueva** batería completa termine satisfactoriamente.
- No se han realizado operaciones contables, emisión, cierre, eliminación ni modificación de stock en producción.
- El uso real de conectores PrestaShop requiere sesión autorizada; en el entorno local solo se probaron respuestas ficticias.

## Bloqueos y siguiente acción
1. Comprobar la última ejecución CI asociada a la cabeza del PR #166. Ante un fallo, leer el job y error exactos, corregir y repetir; `queued` o `in_progress` no es PASS.
2. Ejecutar validación PostgreSQL aislada de la nueva RPC: identidad, permiso, duplicados, revisión obsoleta, lectura tras guardar, preservación de `ui_preferences`, y regresión de seguridad. No aplicar migración real sin revisión competente.
3. Completar recorridos Playwright autenticados: datos reales por tienda y cajón; edición, tamaño, duplicación, filtros independientes, 10 filas, navegación al módulo, móvil, otro usuario, recarga y revisión concurrente. No producir escrituras comerciales de prueba.
4. Revisar calidad visual frente a las referencias de la conversación. **Stitch no está conectado aquí**; no declarar una exportación Stitch inexistente.
5. Tras revisión y aprobación del titular, coordinar publicación controlada y comprobar versión y flujos. Mantener el PR en borrador hasta entonces.

## IDs y hechos
- Repositorio: `hortimatic/Totus-Central`; rama de destino `totus-central`.
- PR: https://github.com/hortimatic/Totus-Central/pull/166
- Proyecto Supabase: `awmojepsasikxocoeqtu`.
- Originales y copias: OneDrive personal, `Apps/Totus Central` (sin modificaciones de archivos por este frente).
- Ningún `request_id` de escritura comercial pendiente del desarrollo de Inicio.

## Continuación de auditoría funcional (10/11/2026)

Petición activa #1: terminar **solo Inicio** de Totus Central en PR #166, sin publicar ni ejecutar escrituras comerciales, y sin intervenir en otras tareas de Codex.

Hechos añadidos en la rama:
- Se confirmó el CI completo **16/16 PASS** para commit `1083b975e249275ab1b36164295fa060916e415c` antes de continuar.
- La biblioteca permite filtrar por módulo y buscar; se puede añadir, duplicar, ocultar, recuperar y **quitar una instancia** sin borrar datos del módulo. Formularios/estado único (gráfica, precio, tareas, avisos y sistema) no se duplican como copias inertes.
- Las dimensiones son independientes entre escritorio (12 columnas), tablet (6) y móvil (una), con redimensión por teclado, ratón y gesto táctil. Hay pruebas Playwright para las 3 situaciones; consultar el CI de la última cabeza antes de afirmar PASS final.
- Se corrigió `expenses.pending` para **revisión fiscal pendiente** (no impagados), con acceso a la ficha de gasto y filtro de tienda. Test con gasto pagado pero pendiente de revisión en mock aislado.
- En PrestaShop los dos resúmenes comparten una sola consulta del contexto autorizado. Las tablas duplicadas pueden filtrar tiendas separadas, medios de pago, estado, búsqueda, fecha y orden; muestran 10 filas, selector numérico y flechas, scroll vertical/horizontal. Pedido enlazado al detalle nativo.
- La tabla presenta nombres y cantidades de `order_details` solo con cobertura válida, conserva combinaciones/variantes para el Top de ventas, mantiene columna Cliente por ID cuando se acredita y Atendido por como **No informado** si el origen no lo acredita. Margen/ganancia comercial sigue **Sin validar** cuando faltan costes históricos verificados.
- Se impone límite de 120 instancias en lectura, altas y duplicados; errores de cambios de diseño se informan sin romper la interfaz.
- Se han añadido capturas de Playwright (escritorio/editor/móvil) como artefactos de GitHub Actions. Las imágenes son de la implementación, no una exportación remota de Stitch.

Pendientes estrictos:
1. Comprobar el **último** commit de la rama y CI correspondiente. Revisar fallo exacto de cada job antes de corregir; resultados de ejecuciones anteriores no validan cambios posteriores.
2. Revisar visualmente capturas nuevas, especialmente tabla de productos y editor táctil; contrastar con referencias acordadas y comprobar accesibilidad.
3. Validación real de la RPC `totus_home_dashboard` en entorno aislado (PASS en CI) y revisión técnica competente de seguridad antes de aplicar **ninguna** migración a Supabase de producción; hoy sigue sin instalarse.
4. Recorrido autenticado con permisos reales y dos PrestaShop, guardado entre dispositivos y costes históricos no comprobados. No crear ventas/facturas/cierres para probar.
5. Los widgets de catálogo de productos/recepciones/chat que aún usan acceso descriptivo al módulo no representan una lectura de datos validada; no declarar cobertura funcional universal.
6. Cuando todo esté revisado, solicitar aprobación de publicación y hacer merge controlado, comprobar versión en producción y todos los flujos. PR todavía draft.

Datos afectados: **ninguno**. Producción, stock, fiscalidad, OneDrive y registros: **sin cambios**. `request_id` comerciales pendientes: **ninguno**.

## Ampliación de dashboard, módulos y QA visual · 10/11/2026

Petición activa #1 (en progreso): **Inicio exclusivamente**; la implementación debe respetar contenido y cálculos actuales, mejorar fidelidad a las referencias visuales, personalización modular, tablas y gráficos en todas las pantallas. No publicar mientras falten controles.

Hechos comprobados del desarrollo:
- Se parte de la rama `feat/inicio-widgets-modulares-20261110`, PR #166 **draft**, base `totus-central`.
- Hay 28 tipos de widget. Configuración general del tablero: separación entre contenedores, ancho máximo, densidad y fondo suave. Los colores, tipografía, bordes y efectos se heredan de las variables reales de **Mi interfaz**. Preferencia de diseño por usuario, guardada con revisión CAS y relectura, sin introducir CSS arbitrario. PostgreSQL aislado valida valores allowlist; no se instala migración en producción.
- Cada resumen PrestaShop permite elegir horas/días, pedidos válidos o ventas EUR verificadas, visibilidad de métricas y clasificación de 4/8/12 productos. No presenta total monetario si la moneda, el estado o la cobertura no son fiables. Gráficas con ejes, cifras, información accesible y colores de Mi interfaz.
- Cada tabla de pedidos conserva 10 filas por defecto con scroll horizontal/vertical, filtros de fechas/tienda/búsqueda/pago/validez, orden, paginación numérica y flechas, densidad individual, columnas configurables y reordenables. Los productos se recuperan de líneas de pedido; referencia de cliente y responsable solo si existe evidencia; sin costes históricos verificados no se inventa margen.
- Widget **Más vendidos** de productos por tienda: tabla o gráfico de barras, combinación, referencia, unidades y porcentaje sobre todas las unidades *verificadas* en la lectura; no mezcla variantes.
- Widget **Calidad de catálogo** consulta `products` por el servicio autenticado existente, con paginación y límite, utiliza `catalogIssues` canónico (referencias, EAN, peso), separa tiendas y marca resultados parciales sin afirmar total completo. El resumen de tienda incorpora el recuento de avisos cuando se ha realizado una consulta.
- Widget **Aperturas por tienda** permite duplicar y seleccionar Hortimatic o NewOldSmok, muestra cada cajón y su saldo acreditado de cierre anterior con aviso si está pendiente; el original general permanece intacto. Otras cifras de Inicio, gráfica, formularios y acciones se preservan.
- La biblioteca permite buscar, filtrar por módulo, añadir, mover, duplicar instancias seguras, cambiar tamaños independientes escritorio/tablet/móvil, ocultar, recuperar y quitar sin eliminar datos de módulos; 120 instancias máximo con errores visibles.
- CI dispone de tests de motor JS, PostgreSQL aislado, Playwright de módulos y pedidos, navegador táctil real, tema oscuro Mi interfaz y capturas.
- Ejecución antigua `42818645219`: 16 de 16 jobs PASS de versión anterior. Ejecuciones posteriores incluyen nuevas funciones y **no se consideran aprobadas hasta completar el CI de la última cabeza**.
- En la ejecución `42827944061` se localizaron (y corrigieron posteriormente) dos fallos: defaults involuntarios en opciones y operador PostgreSQL ambiguo; en `42830493845` se corrigieron selectores de columnas fuera del viewport. Los tests son herramientas de detección, no certificaciones de publicación.

Pendientes bloqueantes:
1. Leer última cabeza y logs completos del CI correspondiente; corregir causas, no relajar aserciones legítimas.
2. Revisar capturas reales del Inicio claro/oscuro, escritorio/editor/móvil y posibles cortes por redimensión.
3. Completar pruebas con sesión real autorizada: permisos, fuentes PrestaShop, caja y preferencias entre dispositivos; nunca ejecutar ventas, pagos, cierre ni emisión para probar.
4. Revisión técnica competente del diseño de almacenamiento personal y de la migración SQL antes de ejecutar cambios en seguridad o producción.
5. El **margen comercial histórico** permanece sin validar hasta tener costes de productos/variantes acreditados, descuentos, impuestos y devoluciones; no poner un importe falso.
6. Algunos tipos (Productos, Recepciones, Chat) todavía muestran acceso nativo al módulo, no una lectura propia contrastada: no afirmar cobertura completa de cada tipo.
7. Comprobar rama `totus-central` (avanzó durante el trabajo), revisión PR, publicación controlada y regresiones tras publicación solo cuando corresponda.

Producción: sin cambios. Supabase operativo: migración sin aplicar. Registros comerciales: ninguno. OneDrive: sin modificaciones. IDs/request_id de operaciones comerciales pendientes: ninguno.

## Continuación de revisión por ChatGPT · 10/11/2026 (sin publicar)

- **Último código funcional revisado:** commit `4df1ccb3b59cc8a0c606a86ed9825afb3810ce8a`, PR #166 sigue abierto y draft contra `totus-central`. La CI del commit anterior `c2496e1` terminó **16/16 success** en ejecución `42832788565`. La ejecución nueva `42837866590` del código corregido tenía **15/16 success**, 0 fallidos y `qa` en curso en la última consulta; **consultar de nuevo** antes de darla por superada. Este añadido documental genera un SHA más nuevo; no trasladar resultados entre commits.
- **Incidencia visual corregida en rama:** en lectura móvil la altura de los widgets pasa a ser una **altura mínima**, para que el contenido del Inicio original no quede oculto tras un segundo scroll vertical. En edición se conserva la altura fija y los tiradores de tamaño. Prueba Playwright nueva comprueba la gráfica original, explicación de ganancia comercial y precio a 390px. El job `home-widgets-functional-browser` terminó `success` y se descargaron y revisaron capturas renovadas de móvil y modo oscuro: botones Este mes/Limpiar, gráfica, acceso a cifras y el mensaje completo «Sin validar» ya aparecen visibles.
- **Integridad del contrato SQL pendiente:** se corrigieron casos en que `p_action=NULL`, `schemaVersion` nulo/ausente/de tipo incorrecto o `widgets`/tipo de widget ausentes podían eludir comprobaciones por lógica SQL de tres valores. Tests añadidos al ensayo PostgreSQL descartable; `home-dashboard-database` finalizó `success` en `42837866590`. La migración `20261110103900_inicio_modular_personal_layout.sql` **no se ejecutó**. Una lectura de producción confirmó `installed=false` y `migration_recorded=false`.
- **Conectores comprobados:** lectura del PR/archivos/Actions en GitHub, lectura de OneDrive personal `Apps/Totus Central`, y consulta de capacidades de Supabase contrato 4. La solicitud de sesión por el alias genérico `private.totus_assistant_submit` terminó con sesión autenticada de un **usuario de integración de rol gerente**, **no acreditó la identidad ChatGPT/admin**. No usarla para aprobar pruebas reales de ambas tiendas. Se requiere selección explícita y verificación de identidad propia antes de consultas reales.
- **Limitaciones explícitas:** los datos PrestaShop de las capturas son simulados; no hay prueba autenticada de lectura de las dos tiendas, preferencia conservada en otro dispositivo o de todos los botones nativos en producción. Algunos widgets siguen siendo accesos a sus módulos, no lecturas completas. Los costes históricos no acreditan la ganancia comercial. Las capturas proceden del navegador de QA y no de Stitch.
- **Seguridad:** migración con `SECURITY DEFINER` y RLS/identidad por usuario ensayadas en PostgreSQL simulado; la revisión técnica **independiente** de las autorizaciones reales, payload, privilegios de ejecución y esquema existente sigue siendo obligatoria antes de aplicar SQL. Los avisos de seguridad del proyecto vivo no acreditan esta migración ausente ni se corrigieron fuera de alcance.
- **Datos afectados:** solo archivos versionados de CSS, tests y migración sin ejecutar, más este documento. Sin guardados comerciales, facturas, cierres, stock, documentos OneDrive ni publicación. Sin `request_id` comerciales nuevos.
- **Siguiente paso:** comprobar el SHA más reciente y toda su CI; revisar si hay fallos concretos. Verificar la cuenta real ChatGPT/admin con sus permisos, lectura real de Hortimatic y NewOldSmok y persistencia por usuario en entorno legítimo autorizado. Obtener revisión técnica competente sobre la migración, y la aprobación del titular para planificar despliegue. Mantener draft y no ejecutar migración ni publicar hasta entonces.

## Verificación adicional desde ChatGPT con identidad propia · 10/11/2026

1. **Petición #1 — Inicio modular: sigue abierta, sin publicar.** PR #166, rama `feat/inicio-widgets-modulares-20261110`, continúa en borrador. No se ha hecho merge, migración ni despliegue; no hay `request_id` de escritura comercial pendientes.
2. **Identidad corregida y verificada:** la captura de Administración muestra ChatGPT como administrador. La comprobación EXPLÍCITA mediante `private.totus_agent_submit` con su cuenta propia devolvió `completed`, `role=admin`, `authenticated=true`, `session_verified=true`, `user_id=e5b35f56-c01e-45e3-bab4-623085ee5728` (job `8c6ae95e-dc2f-4da7-9f6d-982b9dc60968`). El alias genérico invocó a otra cuenta y no debe confundirse con ChatGPT; el bloqueo anterior de acceso propio queda **descartado**.
3. **Catálogo real:** job `490ac210-5c72-4187-926b-c81805b02129` `completed`; contrato 4. Conexiones `totus_prestashop_context` por la misma identidad: job `4e3d9c9e-68e0-4290-9a35-34f6aeecbe4e` `completed`, Hortimatic revisión 4 y NewOldSmok revisión 3, ambas activas y autorizadas.
4. **PrestaShop real, sin escrituras:** lectura de un pedido por tienda mediante `operation=products`, `action=prestashop_read`: Hortimatic pedido 46488 (job `3cb4988a-9d55-4043-b41c-2231b3cc0eb4`) y NewOldSmok pedido 15225 (job `728ab692-0fae-4a85-9a81-41f190ff51bb`), ambas `completed`/`ok=true` con identidad propia; `possibly_more=true`, **no** acredita totales del periodo. Lecturas explícitas de moneda (jobs `109d5103-50bf-4577-9ac9-9c3210c19745`, `e1f6ed56-dac3-4e70-8708-1ddf43231652`) confirman EUR en ambos pedidos.
5. **Cajas reales, sin escrituras:** lectura de tiendas y tres cajones activos, más cierre del 09/11/2026 de cada tienda. Lecturas filtradas de sus líneas (jobs `c4b2f3ed-2c17-4c72-8530-b03daefa334e` y `5625ae84-2e38-4f4f-b54c-51f306ccc090`) `completed`, `possibly_more=false`: Hortimatic dos cajones Vape/Head; NewOldSmok uno Vape. No se reparten ni suman retiradas como ingresos; son lecturas parciales de fechas concretas, no aceptación de todo el Inicio.
6. **Revisión de seguridad en rama:** la migración `20261110103900_inicio_modular_personal_layout.sql` sigue NO instalada. Se cerró el esquema permitido para el objeto de preferencias, campos de widget/filtros y dimensiones de escritorio/tablet/móvil; se rechazan campos desconocidos, títulos excesivos, columnas no permitidas, tamaños fuera de rango, entradas incompletas. Se reforzó `tests/home-dashboard-db-qa.sql` con casos adversarios y un ejemplo completo del modelo real. GitHub Actions detectó y ayudó a corregir un bloque SQL residual duplicado y precedencia de operador JSON. Código de última reparación `26d73bbbd96488ef717a930dff62a1d370ebfa20`, CI `42846753422` **15/16 correctos, sin fallos, qa en curso** en la última lectura; releer su conclusión y la nueva cabeza tras este documento.
7. **Revisión independiente aún exigida:** la RPC pública con `SECURITY DEFINER` comprueba identidad y perfil activo y conserva revisión optimista, pero las pruebas PostgreSQL aisladas y la inspección de código no reemplazan revisión técnica competente sobre privilegios reales, RLS, permisos y despliegue. Prohibido aplicar migración sin ese control. Todavía falta prueba de preferencias guardadas/releídas entre dispositivos con usuarios reales, una vez disponible el circuito autorizado. No se ha pedido contraseña ni bypass de seguridad.
8. **Interfaz:** las pruebas de navegador de la rama pasan para editor/duplicación, alturas y móvil, y se observaron capturas reales del runner, no exportaciones de Stitch. Se corrigió lectura móvil de los formularios y la gráfica conservando tamaños fijos durante edición. No sustituye sesión real del navegador de producción ni garantiza todos los widgets de acceso descriptivo.
9. **Datos afectados:** exclusivamente archivos de código, SQL propuesto no instalado, pruebas y este relevo en GitHub. Sin cambios comerciales, pagos, stock, facturas, cierres ni documentos originales de OneDrive. El siguiente paso es comprobar CI de cabeza, revisar técnicamente la migración, coordinar prueba autenticada de la interfaz cuando proceda y solicitar aceptación antes de cualquier publicación.

## Publicación autorizada · preparación final del 10/11/2026

- Titular autorizó expresamente la publicación y las correcciones necesarias para activarla. No se han escrito ni alterado ventas, facturas, cierres, productos, stock ni documentos originales.
- GitHub PR #166 continúa abierto y listo para integrar. Revisión de código por ChatGPT registrada en el PR; la herramienta GitHub no registró aprobación independiente. Respetar cualquier protección/revisión exigida por GitHub antes de fusionar.
- Migración aplicada en Supabase mediante `apply_migration`, name `inicio_modular_personal_layout`; versión **`20261110162926`** registrada; `public.totus_home_dashboard(text,jsonb,integer)` presente, `authenticated` puede EXECUTE, `anon` no puede EXECUTE. El SQL del repositorio se renombró con esa versión exacta; la CI usa el nuevo nombre. El nombre antiguo `20261110103900` descrito arriba es histórico y **no debe aplicarse**.
- Copia previa a publicación: `ops_backup_runs.id=0576f6ed-6669-4b8c-a04b-ba255b028cc9`, estado **success**, completada `2026-11-10T16:26:14Z`, respaldo OneDrive verificado, 22 componentes; sin restauración.
- Se integró el último commit publicado de Productos (#165, `4c92c8f`) mediante commit de dos padres `09fc7d73d7ff050c50705b0d958384c486c0a5ff`, preservando el ajuste de galería completa, CSS y pruebas, así como todos los widgets del Inicio. Comparación posterior con `totus-central`: `behind_by=0`.
- **Siguiente acción estricta:** comprobar CI del último commit de esta rama y que PR sea integrable; fusionar solo PR #166 con chequeo SHA, comprobar publicación de GitHub Pages (build-info.json y frontend), probar entrada Inicio y RPC de lectura autenticada por recorrido normal, registrar versión y límites reales. Este bloque NO acredita por sí solo que la web esté publicada.

