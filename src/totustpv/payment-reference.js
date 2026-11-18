/** Cashier-supplied reconciliation reference, never evidence of a bank charge. */
function looksLikeCardNumber(value){
 const digits=value.replace(/\D/g,'');
 if(digits.length<13||digits.length>19)return false;
 let sum=0,double=false;
 for(let index=digits.length-1;index>=0;index--){let n=Number(digits[index]);if(double){n*=2;if(n>9)n-=9;}sum+=n;double=!double;}
 return sum%10===0;
}
export function paymentReference(value){
 if(value===undefined)return undefined;
 if(typeof value!=='string')throw Error('Escribe una referencia de operación válida.');
 const clean=value.trim();if(!clean)return undefined;
 if(clean.length>64||!/^[A-Za-z0-9][A-Za-z0-9 ._:/-]*$/.test(clean)||looksLikeCardNumber(clean))throw Error('Utiliza el número de operación del cobro, nunca el número de tarjeta ni su código de seguridad.');
 return clean;
}
export function paymentReferencePolicy(value,available=['cash','card','bizum','transfer']){
 const defaults={card:'hidden',bizum:'hidden',transfer:'hidden'};
 if(!Array.isArray(available)||!available.length||new Set(available).size!==available.length||available.some(id=>!['cash','card','bizum','transfer'].includes(id)))throw Error('Revisa la configuración de referencias de cobro.');
 if(value===undefined)value={};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(id=>id==='cash'||!Object.hasOwn(defaults,id)||!available.includes(id)))throw Error('Revisa la configuración de referencias de cobro.');
 return Object.fromEntries(Object.keys(defaults).filter(id=>available.includes(id)).map(id=>{
  const mode=Object.hasOwn(value,id)?value[id]:defaults[id];if(!['hidden','optional','required'].includes(mode))throw Error('Revisa la configuración de referencias de cobro.');return [id,mode];
 }));
}
export function referenceForTender(policy,method,value){
 const mode=policy?.[method]??'hidden',reference=paymentReference(value);
 if(!['hidden','optional','required'].includes(mode)||mode==='hidden'&&reference!==undefined)throw Error('Este medio de cobro no admite una referencia. Revisa el cálculo de la venta.');
 if(mode==='required'&&reference===undefined)throw Error('Añade la referencia de la operación antes de confirmar el cobro.');
 return reference;
}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function paymentReferenceFields(payment,values={}){
 const names={card:'tarjeta',bizum:'Bizum',transfer:'transferencia'};
 return Object.keys(names).filter(method=>(payment.paymentMethods||[]).includes(method)&&['optional','required'].includes(payment.referencePolicy?.[method])).map(method=>`<label data-tpv-reference="${method}" hidden>Referencia de ${esc(payment.paymentLabels?.[method]||names[method])}<input name="reference:${method}" maxlength="64" autocomplete="off" value="${esc(values['reference:'+method])}"><small>Número de operación, nunca número de tarjeta ni código de seguridad.</small></label>`).join('');
}
export function documentPaymentReferences(document){
 const rows=document?.payment_intent;
 if(document?.kind==='gift'||!Array.isArray(rows)||rows.length>4)return {};
 const result={},seen=new Set();
 try{for(const row of rows){
  if(!row||!['cash','card','bizum','transfer'].includes(row.method)||seen.has(row.method))return {};
  seen.add(row.method);
  if(Object.hasOwn(row,'external_reference')){
   if(row.method==='cash')return {};
   const reference=paymentReference(row.external_reference);
   if(reference===undefined||reference!==row.external_reference)return {};
   result[row.method]=reference;
  }
 }}catch{return {};}
 return result;
}
