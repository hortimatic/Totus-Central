-- TOTUS CENTRAL · INVENTARIO DE LIMPIEZA · SOLO LECTURA
-- REEMPLAZA el antiguo script destructivo en la rama staging.
-- Auditoría 2026-10-14: antiguo script contenía DROP TABLE ... CASCADE,
-- DROP FUNCTION y ALTER TABLE ... DROP COLUMN. Su versión se conserva en el historial Git.
-- Ninguna tabla, dato, vista, función o columna se elimina con este archivo.
-- No ejecutar limpiezas destructivas en staging ni producción sin inventario,
-- copia verificada, estudio de dependencias y autorización específica.
WITH candidates(name, kind) AS (
 VALUES
 ('ops_gestor_natural_rows','view'),
 ('ops_backup_archives','table'),
 ('ops_reconciliation_notes','table'),
 ('ops_import_batches','table'),
 ('ops_gestor_quarter_summary','table'),
 ('ops_gestor_source_rows','table'),
 ('ops_fiscal_reference_periods','table'),
 ('ops_legacy_daily_rows','table'),
 ('ops_historical_income_periods','table'),
 ('ops_personnel','table'),
 ('ops_entity_revisions','table'),
 ('ops_income_adjustments','table')
)
SELECT name,kind,to_regclass('public.'||name) IS NOT NULL AS exists_now
FROM candidates ORDER BY kind,name;
