// One product-level diagnostic for Inicio and PrestaShop. A warning is a review
// candidate, not proof that a variant or a physical product lacks the value.
export const CATALOG_CHECKS=Object.freeze([
 {id:'missing_reference',label:'Sin referencia',help:'La referencia de la ficha está vacía.'},
 {id:'missing_ean',label:'Sin EAN',help:'La ficha no tiene EAN; comprueba también sus combinaciones.'},
 {id:'invalid_ean',label:'EAN por revisar',help:'El EAN de la ficha no contiene exactamente 13 dígitos.'},
 {id:'duplicate_ean',label:'EAN repetidos',help:'El mismo EAN aparece en más de una ficha consultada.'},
 {id:'missing_weight',label:'Peso pendiente',help:'El peso de la ficha no es positivo; puede existir un ajuste en sus combinaciones.'},
 {id:'missing_image',label:'Sin portada',help:'PrestaShop no ha informado una imagen principal para esta ficha.'}
].map(Object.freeze));
const text=value=>String(value??'').trim();
export function catalogQualityReport(products,{complete=false,readAt=null}={}){
 const counts=new Map();
 for(const p of products){const ean=text(p.ean13);if(ean)counts.set(ean,(counts.get(ean)||0)+1);}
 const rows=products.map(product=>{
  const ean=text(product.ean13),weight=text(product.weight),image=text(product.id_default_image);
  const flags={missing_reference:!text(product.reference),missing_ean:!ean,invalid_ean:!!ean&&!/^\d{13}$/.test(ean),duplicate_ean:!!ean&&counts.get(ean)>1,missing_weight:!weight||!Number.isFinite(Number(weight))||Number(weight)<=0,missing_image:!/^\d+$/.test(image)||Number(image)<=0};
  return {...product,qualityChecks:CATALOG_CHECKS.filter(c=>flags[c.id]).map(c=>c.id)};
 });
 return {rows,count:rows.length,affected:rows.filter(p=>p.qualityChecks.length).length,complete:complete===true,readAt:Number.isFinite(Date.parse(readAt))?new Date(readAt).toISOString():null,checks:CATALOG_CHECKS.map(c=>({...c,count:rows.filter(p=>p.qualityChecks.includes(c.id)).length}))};
}
export function qualityReadLabel(report){
 const scope=report.complete?'Catálogo completo':'Lectura parcial';
 const date=report.readAt?new Intl.DateTimeFormat('es-ES',{timeZone:'Europe/Madrid',dateStyle:'short',timeStyle:'short'}).format(new Date(report.readAt)):'Fecha de lectura no disponible';
 return `${scope} · ${report.count} fichas · ${date}`;
}
