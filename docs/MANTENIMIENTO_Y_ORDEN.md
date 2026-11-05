# Mantenimiento y zonas de trabajo

Revisión: 06/11/2026. No sustituye los permisos, aprobaciones o procedimientos de negocio.

## Dónde está cada cosa

| Zona | Contenido vigente | Regla de mantenimiento |
|---|---|---|
| `src/` | Aplicación y lógica compartida usada también por servicios. | Una implementación canónica por cálculo/contrato. Separar por módulo al tocarlo; no reescribir toda la aplicación para ordenar un cambio pequeño. |
| `supabase/functions/` | Ocho servicios de ejecución; manifiesto en `supabase/functions/deployment-manifest.json`. | Mantener manifiesto de versión y fuentes, incluido código compartido. No editar solo el servicio desplegado sin reflejarlo en Git. |
| `supabase/migrations/` | Evolución histórica parcial del esquema. | Conservar trazabilidad. El inventario no acredita un instalador desde cero. |
| `supabase/review_patches/` | Cambios revisados aplicados en momentos concretos. | No aplicar indiscriminadamente. Documentar aplicación/equivalencia al consolidar una base inicial. |
| `tests/` | Recorridos, fixtures y comprobaciones aisladas. | Una prueba debe comprobar resultado, persistencia y efectos, no solo presencia de botones. Fijar dependencias para reproducibilidad. |
| `tools/audit-*.mjs` | Inventario y ejecución de recorridos de auditoría. | Solo servidor local de fixtures; nunca desplegar estos servidores como producción. |
| `docs/` | Procedimientos de operación y montaje. | Entrada corta vigente; informes fechados para antecedentes. Señalar expresamente propuestas y hechos verificados. |
| `docs/auditorias/` | Informes, matrices y límites de cada revisión. | Fecha y commit, tipo de evidencia, pendientes con criterio de cierre. |
| `artifacts/` | Resultados ficticios de pruebas y capturas. | Fuera de nuevos commits; conservar únicamente evidencia útil. No mezclar con documentos contables. |
| OneDrive `01 Documentos` / `04 Chat` | Originales y adjuntos administrados por la herramienta. | No renombrar/mover por fuera de Totus. Verificar IDs, tamaño, huella y referencias antes de retirar algo. |
| OneDrive `02 Copias de seguridad` | Diez juegos ordinarios completos por componentes. | Retirar una antigua solo cuando la nueva esté guardada y verificada. Índices pequeños son necesarios. |
| OneDrive `04 Manuales y funcionamiento` | Entrada operativa y entregas históricas. | Mantener una entrada inequívoca; actualizar manuales al cerrar cambios funcionales. |
| OneDrive archivo de retirados | Originales retirados con trazabilidad. | No confundir archivo reversible con borrado definitivo ni considerarlo «basura». |
| Evidencia operativa privada | Catálogos leídos, recuentos, referencias y notas de la auditoría. | Fuera del repositorio público. No contener contraseñas, claves ni enlaces temporales. |

La repetición actual del prefijo «04» en dos carpetas OneDrive es una cuestión de nomenclatura. No se corrige renombrando carpetas administradas, porque existen referencias y código que usan sus rutas.

## Ramas y entregas

La rama de producción es `totus-central`. Trabajar en una rama concreta, revisar el diff y ejecutar el recorrido afectado más sus consumidores. No añadir exportaciones, `node_modules`, evidencia privada o resultados temporales con `git add -A` sin revisar el listado.

Al cerrar un PR, registrar commit publicado y CI. Una rama integrada se puede retirar después de verificar su alcance y PR. Una rama con commits fuera de producción necesita contraste: puede contener una propuesta abandonada o trabajo no entregado. No decidirlo por antigüedad ni por el prefijo `fix/`.

La revisión vigente retiró 20 ramas integradas con referencia y copia recuperable; conserva 13 con diferencias únicas. Véase el inventario fechado del 06/11/2026.

## Repetir pruebas con coste acotado

1. `node tools/audit-inventory.mjs` crea el mapa de rutas, fuentes, RPC, variables y dependencias de origen. Solo lee código.
2. Instalar las dependencias de pruebas indicadas por CI en un entorno aislado y arrancar `node tools/audit-functional.mjs`. Requiere Playwright/Chromium, `xlsx-js-style`, `jszip` y `pdf-lib`; usar las versiones fijadas en CI.
3. El ejecutor inicia un servidor limitado a `127.0.0.1`, comprueba los recursos del harness y genera un registro por suite y un JSON de resultados.
4. `AUDIT_ONLY` permite repetir una suite de la lista conservando los resultados de las demás. `AUDIT_PORT`, `AUDIT_BROWSER_CHANNEL` y las rutas de importación `AUDIT_PLAYWRIGHT`, `AUDIT_PDF_LIB`, `AUDIT_JSZIP` permiten usar un runtime ya instalado. No contratar ni descargar servicios por defecto.
5. Separar fallo del entorno (servidor/dependencia ausentes) de un fallo de aplicación. No dar por buena una prueba con errores ni repetir toda la batería cuando solo falta resolver una dependencia.

`tools/audit-readonly.sql` permite repetir la comprobación acotada de catálogo, cron, última copia y vínculos. Usa una transacción de solo lectura y no devuelve contenidos documentales ni secretos; sus resultados operativos deben permanecer privados. `audit-startup-outage.mjs` y `audit-export-inputs.mjs` reproducen los hallazgos de disponibilidad y CSV sin usar datos reales.

La auditoría total no debe repetirse por cada pequeño cambio. La matriz funcional permite seleccionar las pruebas de ese cambio y de los módulos que consumen sus resultados. El CI de publicación existente sigue aplicando su batería completa.

## Qué no se ha limpiado automáticamente

No se han borrado registros de negocio, originales, índices de copias, tareas de usuario, migraciones ni credenciales. Se aplicaron los tres índices aditivos del parche 068. Los archivos retirados con trazabilidad se conservan; no se renombran rutas administradas.

## Entrada para el siguiente trabajo

- [Informe funcional y prioridades](auditorias/AUDITORIA_FUNCIONAL_2026-11-03.md).
- [Matriz por módulo y función](auditorias/MATRIZ_FUNCIONAL_2026-11-03.md).
- [Preparación de servidor privado](MIGRACION_SERVIDOR_PRIVADO.md).
- [Revisión vigente de estabilidad y limpieza](auditorias/AUDITORIA_ESTABILIDAD_2026-11-06.md). Las correcciones de arranque y CSV de la revisión anterior ya están incorporadas; esta entrega añade recuperación de esperas de acceso.
- No presentar la auditoría como una migración realizada ni como cierre de los pendientes de IA.
