-- Totus Central · referencias verificadas por tienda para 1S 2026.
-- Fuente: informes FINAL 1T/2T y hojas mensuales aportadas por Diego.
-- Se usa para la vista operativa por establecimiento; no sustituye el cálculo fiscal consolidado de gestoría.

with src(store_code,period_month,source_name,income_amount,expense_amount,through_date,notes) as (
 values
 ('HORTIMATIC','2026-01-01'::date,'GESTOR INGRESOS Q1',16594.28,14467.66,'2026-01-31'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-01-01'::date,'GESTOR INGRESOS Q1',10808.95,6654.87,'2026-01-31'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('HORTIMATIC','2026-02-01'::date,'GESTOR INGRESOS Q1',16414.71,12996.34,'2026-02-28'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-02-01'::date,'GESTOR INGRESOS Q1',10104.51,9377.71,'2026-02-28'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('HORTIMATIC','2026-03-01'::date,'GESTOR INGRESOS Q1',16460.52,10131.88,'2026-03-31'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-03-01'::date,'GESTOR INGRESOS Q1',10896.42,9178.94,'2026-03-31'::date,'Importe declarado por gestoría. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('HORTIMATIC','2026-04-01'::date,'EXCEL DIARIO',19674.96,14029.59,'2026-04-30'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-04-01'::date,'EXCEL DIARIO',11355.16,7610.29,'2026-04-30'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('HORTIMATIC','2026-05-01'::date,'EXCEL DIARIO',16582.08,14672.95,'2026-05-31'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-05-01'::date,'EXCEL DIARIO',12073.76,10722.77,'2026-05-31'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('HORTIMATIC','2026-06-01'::date,'EXCEL DIARIO',16589.29,16194.27,'2026-06-30'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.'),
 ('NEWOLDSMOK','2026-06-01'::date,'EXCEL DIARIO',11416.81,8900.86,'2026-06-30'::date,'Referencia calculada exactamente como el Excel diario: tarjeta + salida de caja. Gasto directo verificado en Informe FINAL 1T/2T 2026 por tienda.')
)
insert into public.ops_fiscal_reference_periods(store_id,period_month,source_name,income_amount,expense_amount,through_date,authoritative,notes)
select s.id,src.period_month,src.source_name,src.income_amount,src.expense_amount,src.through_date,true,src.notes
from src join public.ops_stores s on s.code=src.store_code
on conflict(store_id,period_month,source_name) do update set
 income_amount=excluded.income_amount,
 expense_amount=excluded.expense_amount,
 through_date=excluded.through_date,
 authoritative=true,
 notes=excluded.notes;
