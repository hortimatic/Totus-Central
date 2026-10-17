# Auditoría de Totus Central — 17/10/2026

## Entorno verificado
- Repositorio: `hortimatic/Totus-Central`.
- Rama de trabajo: `staging`; partida de `b41ed637869da80b6be0e862807a054d8cbc61c9`.
- Corrección: `7aa4ab096169fd2e2ac8c4a5bf95e8996320c7e8`.
- `main`: `f94ccd048919de0be0df93f9d3777f0a6bb69766`, intacta tras la corrección.
- Supabase STAGING: `awmojepsasikxocoeqtu`. Producción `zwkpmjjuurgjygcrejiw` NO consultada mediante SQL ni modificada.

## Hallazgo ALM-001 (corregido en staging)
- Pantalla: Inicio → Estado del sistema.
- Reproducción: provocar error en la RPC `totus_storage_usage()`; navegar al Inicio.
- Comportamiento previo: la tarjeta de almacenamiento utilizaba `Number(usage.total_bytes || 0)` sin comprobar `usage.status`, por lo que presentaba 0,0 MB / 0,0 % pese a fallar la medición.
- Comportamiento esperado: distinguir entre lectura correcta con cero bytes y lectura fallida.
- Corrección: `src/pages/main.js` valida `status === 'ok'` y campos numéricos; cuando falla presenta «No disponible» y «Sin medir», y añade aviso para administración/gerencia.
- Regresión: `tests/storage-live-qa.mjs` ahora comprueba explícitamente que Inicio no muestra cero ficticio al fallar la RPC; sigue probando el panel Administración → Almacenamiento, las métricas simuladas y la recuperación.
- Verificación de CI:
  - QA: https://github.com/hortimatic/Totus-Central/actions/runs/39030273166 — **success**
  - Publicación independiente: https://github.com/hortimatic/Totus-Central/actions/runs/39030273202 — **success**, incluida comprobación de URL original.
- No se cambiaron tablas, datos, buckets ni funciones de Supabase.

## Almacenamiento en Supabase (lecturas no destructivas)
- `public`: 40 tablas, todas con RLS activado.
- Bucket `storage.objects` (documentos, assets y backups de Totus): 0 archivos al momento de la consulta.
- `ops_storage_usage_samples`: 1 medición. **No hay siete días de histórico para certificar previsión**.
- Cron `totus-staging-storage-snapshots`: existe un trabajo configurado. No se ha observado aún una ejecución diaria completada a través de esta auditoría.
- La RPC tiene verificación de miembro de equipo y distingue el límite interno de documentos/logos de la cuota Supabase.

## Permisos — hallazgo investigado, NO se confirmó fallo
- Al principio las reglas `is_manager/is_team_member` parecían poder eludir `totus_can`.
- La precondición de una migración de prueba falló ANTES DE APLICAR CAMBIOS: `totus_mod_*` son reglas **RESTRICTIVE**, que se combinan con las permisivas, no meros permisos OR.
- Confirmados en Gastos/Proveedores: 12 reglas `totus_mod_*` restrictivas y 9 reglas `totus_grant_*`. No se eliminó ninguna; no se aplicó ninguna migración.
- Supabase Security Advisor muestra 11 avisos sobre RPC SECURITY DEFINER accesibles a autenticados; la lectura de definiciones revela comprobaciones de equipo, administrador o `totus_can`, pero hace falta auditoría granular de cada operación.
- Supabase Auth avisa que la comprobación de contraseñas filtradas está desactivada. Pendiente de decisión/configuración.

## Fuentes originales consultadas
- `Semestre 2026.rar`: descomprimidos para lectura los tres libros Excel: libro gestor/auditoría 1S, ventas y gastos NewOldSmok 2026, ventas y gastos Hortimatic 2026.
- Comparados los 20 encabezados y su orden de `Libro gestor 1T` y `Libro gestor 2T` con `GESTOR_EXPENSE_COLUMNS` de `src/expense-register.js`: coinciden.
- Esto es una **comprobación de esquema**, no una validación de importes, fórmulas o representación visual de exportaciones completas.

## Limitaciones / pendientes expresos
1. Los workflows usan mayoritariamente datos y navegaciones mock. Su éxito NO prueba procesos autenticados con roles reales ni el funcionamiento de todas las operaciones en Supabase.
2. Staging contiene solo una cuenta activa admin en `team_members` unida a Auth; no hay cuentas operativas de gerente/encargado, de modo que las pruebas de permisos reales con esas identidades siguen pendientes.
3. No se han ensayado sobre staging secuencias persistentes de crear/editar/eliminar registros ni subida/borrado de documentos; no se han introducido datos residuales.
4. Pendiente de ampliar la auditoría funcional y visual de cajas, gastos, facturación, documentos, fiscalidad, informes y todas las subsecciones de administración, en móvil/tablet/escritorio.
5. Pendiente cotejar exportaciones XLSX/PDF/ZIP reales con importes y estructura de los originales del semestre, no solo sus encabezados.
6. Restauración integral sigue bloqueada hasta existir procedimiento recuperable verificado. No desbloquear sin pruebas.
7. No realizar promoción a main sin autorización del usuario.

## Criterio de trabajo
Hechos comprobados separados de pruebas mock y pendientes. Priorizar una sección cada vez y mantener producción intacta.
