import {quickPriceStudy} from './calculations.js';

export function parseVariantAttributes(text){
 const entries=String(text||'').split(/[;·\n]/).map(s=>s.trim()).filter(Boolean);
 const result=Object.create(null);
 for(const entry of entries){
  const i=entry.indexOf(':'),key=entry.slice(0,i).trim(),value=entry.slice(i+1).trim();
  if(i<1||!value)throw new Error('Escribe los atributos como Color: Negro; Resistencia: 0,8 Ω.');
  if(['__proto__','prototype','constructor'].includes(key))throw new Error('Nombre de atributo no permitido.');
  if(Object.hasOwn(result,key))throw new Error('Hay un atributo repetido: '+key);
  result[key]=value;
 }
 return {...result};
}
export function formatVariantAttributes(attributes){
 return Object.entries(attributes||{}).map(([key,value])=>key+': '+String(value)).join(' · ');
}
export function variantStudy(variant,settings={},discount=0){
 const cost=variant?.cost_net,pvp=variant?.pvp;
 if(cost==null||cost===''||pvp==null||pvp===''||!Number.isFinite(Number(cost))||!Number.isFinite(Number(pvp))||Number(cost)<0||Number(pvp)<0)return null;
 return quickPriceStudy({cost,pvp,discount,vat:settings.default_sales_vat_rate??21,re:settings.purchase_re_rate??5.2});
}
export function numericRange(values,format){
 const valid=values.filter(v=>v!=null&&String(v).trim()!==''&&Number.isFinite(Number(v))).map(Number);
 if(!valid.length)return '—';
 const low=Math.min(...valid),high=Math.max(...valid);
 return low===high?format(low):format(low)+' – '+format(high);
}
export function validateVariant(row,others=[],id=''){
 if(!row.name?.trim()||!row.sku?.trim())throw new Error('Indica el nombre y la referencia de la variante.');
 if(others.some(v=>v.id!==id&&v.sku?.trim().toLowerCase()===row.sku.trim().toLowerCase()))throw new Error('Ya existe una variante con esa referencia.');
 for(const key of ['cost_net','pvp','nicotine_mg_ml','volume_ml','special_tax_rate_ml','special_tax_amount']){
  if(row[key]!=null&&(!Number.isFinite(Number(row[key]))||Number(row[key])<0))throw new Error('Los importes, la nicotina y el volumen deben ser números positivos o cero.');
 }
 return row;
}

export function pricingProviderCost(row){
 return Number(row?.net_cost||0)*(1-Number(row?.provider_discount||0)/100)+Number(row?.shipping_unit||0);
}

export function pricingCompetition(rows=[]){
 const prices=rows.filter(r=>r.price!=null&&Number.isFinite(Number(r.price))&&Number(r.price)>=0&&!['no','sin stock','agotado','out of stock'].includes(String(r.stock_status||'').trim().toLowerCase())).map(r=>Number(r.price)*(1-Math.min(100,Math.max(0,Number(r.discount)||0))/100)+Math.max(0,Number(r.shipping)||0));
 return prices.length?{count:prices.length,min:Math.min(...prices),mean:prices.reduce((a,b)=>a+b,0)/prices.length,max:Math.max(...prices)}:{count:0,min:null,mean:null,max:null};
}
