import {inRange,isoToday} from './utils.js';

export const searchText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
export const matchesText=(query,...values)=>!searchText(query)||searchText(values.join(' ')).includes(searchText(query));

export function selectDocuments(data,filters){
 return (data.documents||[]).filter(row=>inRange(row.document_date||row.created_at,filters.from,filters.to)
  &&(!filters.store||filters.store==='all'||row.store_id===filters.store)
  &&(!filters.status||filters.status==='all'||row.status===filters.status)
  &&(!filters.type||filters.type==='all'||(filters.type==='control_interno'?row.category_code==='control_interno':row.doc_type===filters.type))
  &&matchesText(filters.query,row.original_name,row.supplier_or_customer,row.invoice_number,row.doc_type,row.category_code,row.status,row.notes,data.stores.find(s=>s.id===row.store_id)?.name));
}

export function reportMonths({from,to}){
 const start=String(from||to||isoToday()).slice(0,7),end=String(to||from||isoToday()).slice(0,7);
 if(start>end)return [];
 const result=[];
 for(let year=Number(start.slice(0,4)),month=Number(start.slice(5,7));`${year}-${String(month).padStart(2,'0')}`<=end;month++){
  if(month>12){month=1;year++}
  const key=`${year}-${String(month).padStart(2,'0')}`;if(key>end)break;
  result.push({year,month,key,label:new Date(year,month-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'})});
 }
 return result;
}

export function selectReportData(data,filters){
 const storeName=id=>data.stores.find(s=>s.id===id)?.name||'';
 const take=(rows,date,fields)=>(rows||[]).filter(row=>inRange(row[date],filters.from,filters.to)&&(!filters.store||filters.store==='all'||row.store_id===filters.store)&&matchesText(filters.query,storeName(row.store_id),row[date],...fields.map(key=>typeof key==='function'?key(row):row[key])));
 const incomeNote=row=>{try{const ref=JSON.parse(row.notes);if(ref.kind==='monthly_source_reference')return [ref.book,ref.criterion].join(' ')}catch{}return row.notes;};
 return {
  closings:take(data.closings,'business_date',['notes','status']),
  expenses:take(data.expenses,'expense_date',['supplier_name','supplier_tax_id','invoice_number','description','notes','payment_method']),
  invoices:take(data.invoices,'issue_date',['customer_name','customer_tax_id','display_number','external_number_text','concept','notes']),
  fiscalAdjustments:take(data.fiscalAdjustments,'adjustment_date',['description','kind']),
  incomeAdjustments:take(data.incomeAdjustments,'income_date',['concept',incomeNote]),
  monthlySourceReferences:(data.incomeAdjustments||[]).filter(row=>(!filters.store||filters.store==='all'||row.store_id===filters.store)&&(()=>{try{return JSON.parse(row.notes).kind==='monthly_source_reference'}catch{return false}})()),
  reportFilter:{from:filters.from,to:filters.to,query:filters.query}
 };
}
