-- Totus Central · separar cifra reportada por gestoría y base fiscal usada
-- Verificado con Fuentes 1T/2T y modelos 130 presentados.
alter table public.ops_historical_income_periods
  add column if not exists gestor_reported_income numeric,
  add column if not exists fiscal_basis_income numeric;

update public.ops_historical_income_periods
set gestor_reported_income = coalesce(gestor_reported_income, official_total_income),
    fiscal_basis_income = coalesce(fiscal_basis_income, total_income)
where period_start between '2026-01-01' and '2026-06-30';

update public.ops_reconciliation_notes
set detail = 'El listado INGRESOS(1).pdf de gestoría muestra 75.929,99 € para abril-junio, mientras que la reconstrucción de ventas por tarjeta + metálico suma 87.692,06 €.',
    resolution = 'La verificación posterior con el informe fiscal final y el modelo 130 presentado confirma que la base de ventas usada en el cálculo fiscal del 2T es 87.692,06 €. Los 75.929,99 € se conservan como cifra reportada por INGRESOS(1).pdf y como anomalía documentada; no se usa para sustituir la base fiscal del modelo 130.',
    amount_difference = 11762.07
where fiscal_year=2026 and quarter=2 and issue_type='ingresos_excel_vs_gestoria';
