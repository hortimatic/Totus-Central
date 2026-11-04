// Never infer profit from the purchase costs reported as unreliable by the owner.
export function sourceCents(value){
 if(typeof value!=='string'||!/^\d{1,10}(?:\.\d{1,6})?$/.test(value))return null;
 const [whole,fraction='']=value.split('.');
 const cents=Number(whole)*100+Number((fraction+'00').slice(0,2))+(Number(fraction[2]||0)>=5?1:0);
 return Number.isSafeInteger(cents)?cents:null;
}
export function orderInsights(rows){
 const hours=Array(24).fill(0);let amount=0,valid=0,excluded=0,unknown=0;
 for(const row of rows){
  const cents=sourceCents(row.total_paid_tax_incl);
  if(!['0','1'].includes(row.valid)||cents===null){unknown++;continue;}
  if(row.valid!=='1'){excluded++;continue;}
  amount+=cents;valid++;
  const hour=Number(String(row.date_add).slice(11,13));if(Number.isInteger(hour)&&hour>=0&&hour<24)hours[hour]+=cents;
 }
 return {amount,valid,excluded,unknown,hours,average:valid?Math.round(amount/valid):null};
}
export function catalogIssues(rows){
 const ean=new Map();for(const r of rows)if(r.ean13)ean.set(r.ean13,(ean.get(r.ean13)||0)+1);
 return rows.map(r=>({...r,issues:[!String(r.reference||'').trim()?'Sin referencia':null,!String(r.ean13||'').trim()?'Sin EAN':!/^\d{13}$/.test(r.ean13)?'Revisar EAN':null,r.ean13&&ean.get(r.ean13)>1?'EAN repetido en la consulta':null,r.weight==null||r.weight===''?'Peso no informado':!Number.isFinite(Number(r.weight))||Number(r.weight)<=0?'Peso no positivo':null].filter(Boolean)}));
}
export function paymentReclassification(original,{from,to,amount,reason}){
 const methods=['cash','card','bizum','other'];
 if(!methods.includes(from)||!methods.includes(to)||from===to||!Number.isSafeInteger(amount)||amount<=0||typeof reason!=='string'||reason.trim().length<5)throw Error('Indica medios diferentes, importe y motivo de al menos cinco caracteres.');
 if(methods.some(k=>!Number.isSafeInteger(original[k])||original[k]<0)||original[from]<amount)throw Error('El importe supera el cobro original disponible.');
 const adjusted={...original,[from]:original[from]-amount,[to]:original[to]+amount};
 return {original:{...original},adjusted,reason:reason.trim(),total:methods.reduce((sum,k)=>sum+original[k],0),accounting_modified:false};
}
export function ticketSourceKey(store,order){
 if(!['hortimatic','newoldsmok'].includes(store)||!/^\d{1,15}$/.test(String(order?.id)))throw Error('Origen de pedido no válido.');
 return 'prestashop:'+store+':order:'+order.id;
}
