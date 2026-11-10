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
