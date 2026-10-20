import {inRange} from './utils.js';
import {matchesText} from './report-period.js';

// Tax settlement is a cash movement, never a second invoice or deductible cost.
// RETA belongs in deductible expenses; an unspecified OTRO needs explicit review.
export function informationalTaxPayments(payments=[],filters={}){
 const seen=new Set();
 return payments.filter(p=>{
  if(!p.id||seen.has(p.id)||p.status!=='pagado'||!p.payment_date||!['130','111','115','309'].includes(p.tax_type))return false;
  if(filters.store&&filters.store!=='all')return false;
  if(!inRange(p.payment_date,filters.from,filters.to)||!matchesText(filters.query,'Hacienda',taxPaymentLabel(p),p.period_label,p.notes,p.payment_date))return false;
  seen.add(p.id);return true;
 }).sort((a,b)=>String(b.payment_date).localeCompare(String(a.payment_date))||String(a.id).localeCompare(String(b.id)));
}
export function taxPaymentLabel(p){
 const labels={'130':'IRPF del autónomo','111':'Retenciones de nóminas y profesionales','115':'Retenciones del alquiler','309':'Liquidación de IVA'};
 return 'Modelo '+p.tax_type+' · '+(labels[p.tax_type]||'Pago de impuesto');
}
