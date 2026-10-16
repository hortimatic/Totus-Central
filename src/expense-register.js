// Registro de gastos. Los encabezados conservan la nomenclatura del libro de gestoría.
export const GESTOR_EXPENSE_COLUMNS=[
 'Orden','Fecha','Nº fra. recibida','Nº fra. proveedor','Rt','NIF/CIF','Razón social','Concepto',
 'Base IVA','% IVA','Cuota IVA','Base R.E.','% R.E.','Cuota R.E.','Imputable a IRPF',
 'Base retención','% retención','Cuota retenida','Total factura','Neto pagado'
];
export function expenseRegisterLines(expenses=[],lines=[]){
 const grouped=new Map();
 for(const line of lines){const id=String(line.expense_id||'');if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(line)}
 const rows=[];
 for(const expense of expenses){
  const items=(grouped.get(String(expense.id))||[]).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0));
  const fallback={description:expense.description||'',base_amount:expense.base_amount||0,vat_rate:expense.vat_rate||0,vat_amount:expense.vat_amount||0,re_base:expense.re_base||0,re_rate:expense.re_rate||0,re_amount:expense.re_amount||0,irpf_imputable:0,withholding_base:0,withholding_rate:expense.withholding_rate||0,withholding_amount:expense.withholding_amount||0};
  for(const [i,line] of (items.length?items:[fallback]).entries()){
   const base=Number(line.base_amount||0),vat=Number(line.vat_amount??(base*Number(line.vat_rate||0)/100));
   const re=Number(line.re_amount??(Number(line.re_base||base)*Number(line.re_rate||0)/100));
   const withholding=Number(line.withholding_amount??(Number(line.withholding_base||0)*Number(line.withholding_rate||0)/100));
   const amounts=[base,vat,re,withholding];
   const total=base+vat+re,net=total-withholding;
   rows.push({expense,line,missingBreakdown:!items.length,lineNumber:i+1,
    fields:['',expense.expense_date||'','',expense.invoice_number||'','',expense.supplier_tax_id||'',
     expense.supplier_name||'',line.description||expense.description||'',base,Number(line.vat_rate||0),vat,
     Number(line.re_base||0),Number(line.re_rate||0),re,
     expense.management_only?0:Number(line.irpf_imputable||0),Number(line.withholding_base||0),
     Number(line.withholding_rate||0),withholding,total,net],
    amounts,subtotal:total,net
   });
  }
 }
 return rows.map((r,i)=>({...r,fields:[i+1,...r.fields.slice(1)]}));
}
export function expenseAttachedInvoices(expenses=[],documents=[]){
 const byId=new Map(documents.map(d=>[String(d.id),d]));
 const linked=new Set();
 const rows=expenses.map(expense=>{
   const doc=byId.get(String(expense.document_id||''));
   if(doc)linked.add(String(doc.id));
   return {expense,document:doc||null,unlinked:false,
     date:expense.expense_date||'',
     searchable:[expense.supplier_name,expense.supplier_tax_id,expense.invoice_number,expense.description,doc?.original_name].filter(Boolean).join(' ').toLocaleLowerCase('es')};
 });
 for(const document of documents){
  if(document.doc_type!=='factura_recibida'||linked.has(String(document.id)))continue;
  // No asociar documentos automáticamente por nombre: una factura puede repetir el nombre.
  if(document.linked_entity_type==='expense'&&document.linked_entity_id&&expenses.some(e=>String(e.id)===String(document.linked_entity_id)))continue;
  rows.push({expense:null,document,unlinked:true,date:document.document_date||String(document.created_at||'').slice(0,10),
    searchable:[document.supplier_or_customer,document.tax_id,document.invoice_number,document.original_name].filter(Boolean).join(' ').toLocaleLowerCase('es')});
 }
 return rows;
}
