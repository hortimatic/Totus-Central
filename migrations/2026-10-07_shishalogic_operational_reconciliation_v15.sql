-- Totus Central · reconciliación operativa SHISHALOGIC.
-- Aplicada en Supabase como shishalogic_operational_reconciliation_v15.
-- No modifica raw source de gestoría: completa referencias en ops_expenses y documenta diferencias.

update public.ops_expenses
set invoice_number='SHLWEBES2026-0099',
    notes=trim(both from coalesce(notes,'') || ' · Referencia completa verificada en documentación fuente: SHLWEBES2026-0099.')
where id='5e33161b-4689-40bf-b9dd-1b7ffcc530c9'
  and invoice_number='SHLWEBES2026-';

update public.ops_expenses
set invoice_number='SHLWEBES2026-00310',
    notes=trim(both from coalesce(notes,'') || ' · Referencia completa verificada en documentación fuente: SHLWEBES2026-00310. La documentación indica 18/05; se conserva 19/05 como fecha del libro de gestoría.')
where id='d170b95d-f6ea-47cb-9594-8f02db93b1d2'
  and invoice_number='SHLWEBES2026-';

update public.ops_expenses
set invoice_number='SHLWEBES2026-00411',
    notes=trim(both from coalesce(notes,'') || ' · Referencia completa verificada en documentación fuente: SHLWEBES2026-00411. Documento visible: 412,97 €. Importe contable de gestoría: 430,72 € al incorporar 17,75 € de recargo de equivalencia.')
where id='ea8836e8-cdaa-4aa5-89f0-b6cc4172601f'
  and invoice_number='SHLWEBES2026-';

insert into public.ops_reconciliation_notes
 (id,fiscal_year,quarter,source_name,issue_type,detail,resolution,amount_difference,active)
select
 coalesce((select max(id)+1 from public.ops_reconciliation_notes),1),
 2026,2,'SHISHALOGIC · SHLWEBES2026-00411','importe_documental_vs_fiscal',
 'El documento fuente del 30/06/2026 identifica SHLWEBES2026-00411 por 412,97 €. El libro de gestoría contabiliza base 341,30 €, IVA 71,67 € y RE 17,75 €, total contable 430,72 €.',
 'Se conserva 430,72 € como importe contable/fiscal porque reproduce el libro de gestoría. La diferencia de 17,75 € corresponde al recargo de equivalencia. Se completa la referencia operativa sin modificar el raw source de gestoría.',
 17.75,true
where not exists (
 select 1 from public.ops_reconciliation_notes
 where fiscal_year=2026 and quarter=2 and source_name='SHISHALOGIC · SHLWEBES2026-00411'
);
