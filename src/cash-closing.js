import {parseDecimal,manualClosingReconciled,sourceClosingReconciled} from './calculations.js';
import {archiveAccepted} from './historical-acceptance.js';
export const DRAWER_MONEY_FIELDS=['opening_cash','closing_cash','card_sales','bizum_sales','online_sales','other_income','cash_withdrawals','cash_expenses_declared','cash_extra_in','cash_extra_out'];
export const DRAWER_FORM_FIELDS=[['Open','opening_cash'],['Close','closing_cash'],['Card','card_sales'],['Bizum','bizum_sales'],['Online','online_sales'],['Other','other_income'],['Withdraw','cash_withdrawals'],['CashExpense','cash_expenses_declared'],['ExtraIn','cash_extra_in'],['ExtraOut','cash_extra_out']];
export function closingMissingFields(row){
 if(row?.status!=='borrador')return {};
 try{const source=JSON.parse(row.source_ref||'{}'),map=source.draft_missing_fields;
  if(!map||Array.isArray(map)||typeof map!=='object')return {};
  return Object.fromEntries(Object.entries(map).map(([id,fields])=>[id,Array.isArray(fields)?fields.filter(f=>['opening_cash','closing_cash'].includes(f)):[]]).filter(([,fields])=>fields.length));
 }catch{return {}}
}
export const incompleteClosing=row=>Object.keys(closingMissingFields(row)).length>0;
export const closingDrawerValue=(row,drawerId,field,value)=>closingMissingFields(row)[drawerId]?.includes(field)?null:value;
export const drawerCashSales=d=>Number(d.closing_cash||0)+Number(d.cash_withdrawals||0)+Number(d.cash_expenses_declared||0)+Number(d.cash_extra_out||0)-Number(d.cash_extra_in||0)-Number(d.opening_cash||0);
export function closingStateLabel(row,settings){
 if(archiveAccepted(settings,row,'closing')||manualClosingReconciled(row)||sourceClosingReconciled(row))return 'Conciliado y aceptado';
 return row.entry_mode==='source_snapshot'?'Pendiente de conciliación':row.status==='borrador'?'Borrador':'Cerrado';
}
export function previewClosing(readings,reported=''){
 try{
  const drawers=readings.map(raw=>{const d={drawer_id:raw.drawer_id};for(const field of DRAWER_MONEY_FIELDS){const value=raw[field];d[field]=['opening_cash','closing_cash'].includes(field)&&(value==null||String(value).trim()==='')?null:parseDecimal(value);if(d[field]!=null&&d[field]<0)throw Error('No se admiten importes negativos en Cajas.')}return d});
  const complete=!!drawers.length&&drawers.every(d=>d.opening_cash!=null&&d.closing_cash!=null);
  const total=complete?drawers.reduce((s,d)=>s+drawerCashSales(d)+d.card_sales+d.bizum_sales+d.online_sales+d.other_income,0):null;
  const reference=reported==null||String(reported).trim()===''?null:parseDecimal(reported);
  if(reference!=null&&reference<0)throw Error('El total de ventas no puede ser negativo.');
  if(total!=null&&!Number.isFinite(total))throw Error('Los importes son demasiado grandes.');
  return {valid:true,complete,drawers,total,difference:complete&&reference!=null?Math.round((total-reference)*100)/100:null,negativeDrawers:drawers.filter(d=>d.opening_cash!=null&&d.closing_cash!=null&&drawerCashSales(d)<-1e-9).map(d=>d.drawer_id)};
 }catch(error){return {valid:false,complete:false,total:null,difference:null,error:error.message,drawers:[],negativeDrawers:[]}}
}
