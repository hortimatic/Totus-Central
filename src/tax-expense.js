// Tax payments use the ordinary expense form, while keeping a single canonical record.
export function taxExpenseRecord(payment){
 return {id:payment.id,_taxPayment:payment,store_id:null,expense_date:payment.payment_date,
 supplier_name:'Agencia Tributaria',invoice_number:'Modelo '+payment.tax_type+' · '+payment.quarter+'T '+payment.fiscal_year,
 document_kind:'impuesto',description:'Pago modelo '+payment.tax_type+' · '+payment.quarter+'T '+payment.fiscal_year,
 gross_expense:Number(payment.amount),accounting_amount:0,base_amount:Number(payment.amount),vat_amount:0,re_amount:0,withholding_amount:0,
 amount_paid:Number(payment.amount),paid_status:'pagado',paid_date:payment.payment_date,payment_method:'domiciliado',
 management_only:true,fiscal_reviewed:false,notes:payment.notes||'',document_id:payment.document_id||null};
}
export function validateTaxExpense({model,year,quarter,date,amount,internal,status,today}){
 if(!internal)throw new Error('Los pagos de impuestos deben quedar como solo información interna, excluidos del cálculo fiscal.');
 if(!['130','111','115','309'].includes(model))throw new Error('Selecciona un modelo válido.');
 if(!Number.isInteger(year)||year<2020||year>2100||![1,2,3,4].includes(quarter))throw new Error('Año o trimestre incorrecto.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today)throw new Error('Indica la fecha real del pago, sin fechas futuras.');
 if(status!=='pagado'||!Number.isFinite(amount)||amount<0)throw new Error('Registra el impuesto cuando esté pagado, con su importe real.');
 return {tax_type:model,fiscal_year:year,quarter,period_label:quarter+'T '+year,payment_date:date,amount,status:'pagado'};
}
