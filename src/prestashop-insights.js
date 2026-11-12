// Money from the source remains separate from catalogue-quality diagnostics.
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
  if(row.valid==='0'){excluded++;continue;}
  if(row.valid!=='1'||cents===null||row.currency_code!=='EUR'||!Number.isSafeInteger(amount+cents)){unknown++;continue;}
  amount+=cents;valid++;
  const hour=Number(String(row.date_add).slice(11,13));if(Number.isInteger(hour)&&hour>=0&&hour<24)hours[hour]+=cents;
 }
 return {amount,valid,excluded,unknown,hours,average:valid?Math.round(amount/valid):null};
}
export function catalogIssues(rows){
 const ean=new Map();for(const r of rows){const key=String(r.ean13??'').trim();if(key)ean.set(key,(ean.get(key)||0)+1);}
 return rows.map(r=>({...r,issues:[!String(r.reference||'').trim()?'Sin referencia':null,!String(r.ean13||'').trim()?'Sin EAN':!/^\d{13}$/.test(String(r.ean13).trim())?'Revisar EAN':null,r.ean13&&ean.get(String(r.ean13).trim())>1?'EAN repetido en la consulta':null,r.weight==null||String(r.weight).trim()===''?'Peso no informado':!Number.isFinite(Number(r.weight))||Number(r.weight)<=0?'Peso no positivo':null,!/^\d+$/.test(String(r.id_default_image??'').trim())||Number(r.id_default_image)<=0?'Sin portada':null].filter(Boolean)}));
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

export function rotationOpportunities(products,stock,orders,lines){
 const valid=new Set(orders.filter(o=>o.valid==='1'&&o.currency_code==='EUR').map(o=>String(o.id))),sold=new Map();
 for(const l of lines){if(!valid.has(String(l.id_order)))continue;const qty=Number(l.product_quantity);if(!Number.isSafeInteger(qty)||qty<=0)continue;sold.set(String(l.product_id),(sold.get(String(l.product_id))||0)+qty);}
 const rows=[];let unknownStock=0;
 for(const p of products){if(p.active==='0')continue;const source=stock.filter(s=>String(s.id_product)===String(p.id)),parts=source.filter(s=>s.id_product_attribute!=='0'),selected=parts.length?parts:source.filter(s=>s.id_product_attribute==='0'),ids=new Set(),shops=new Set();let quantity=0,unknown=!selected.length;
  for(const r of selected){if(ids.has(r.id_product_attribute)||!/^[-]?\d+$/.test(String(r.quantity??''))||!Number.isSafeInteger(Number(r.quantity)))unknown=true;ids.add(r.id_product_attribute);shops.add(r.id_shop??'unknown');quantity+=Number(r.quantity);}
  if(shops.size>1)unknown=true;const expected=p.associations?.combinations||[];if(expected.some(id=>!ids.has(id)))unknown=true;
  if(unknown){unknownStock++;continue;}if(quantity<=0)continue;rows.push({...p,stock:quantity,units:sold.get(String(p.id))||0});
 }
 rows.sort((a,b)=>a.units-b.units||b.stock-a.stock||String(a.name).localeCompare(String(b.name),'es'));
 return {rows,unknownStock};
}
