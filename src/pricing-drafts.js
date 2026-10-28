import {formField,btn} from './components.js';
import {esc,n,money} from './utils.js';
import {parseVariantAttributes,validateVariant,variantStudy,numericRange} from './pricing-core.js';
export function draftVariantRow(id=crypto.randomUUID()){
 return '<section class="card card-pad pricing-draft-variant" data-draft-id="'+esc(id)+'"><div class="section-head"><h4>Nueva variante</h4>'+btn('Quitar','product-draft-remove','secondary','data-draft="'+esc(id)+'"')+'</div><div class="form-grid">'+
 formField('Nombre de variante','pdName_'+id,'')+formField('Referencia / SKU','pdSku_'+id,'')+
 formField('Atributos · Color: Negro; Resistencia: 0,8 Ω','pdAttrs_'+id,'')+
 formField('Nicotina (mg/ml), si procede','pdNic_'+id,'','number','min="0" step="0.01"')+
 formField('Volumen (ml), si procede','pdVol_'+id,'','number','min="0" step="0.01"')+
 formField('Compra sin IVA ni RE','pdCost_'+id,'','number','min="0" step="0.01"')+
 formField('PVP de esta variante','pdPvp_'+id,'','number','min="0" step="0.01"')+
 '</div><p class="note" data-draft-study>Introduce coste y PVP para calcular el beneficio.</p></section>';
}
export function readDraftVariants(root=document,existing=[]){
 const read=(prefix,id)=>root.querySelector('[id="'+prefix+'_'+id+'"]')?.value?.trim()||'';
 const nullable=(prefix,id)=>read(prefix,id)===''?null:n(read(prefix,id));
 const result=[];
 for(const el of root.querySelectorAll('.pricing-draft-variant')){
  const id=el.dataset.draftId;
  const row={id,name:read('pdName',id),sku:read('pdSku',id),attributes:parseVariantAttributes(read('pdAttrs',id)),
   nicotine_mg_ml:nullable('pdNic',id),volume_ml:nullable('pdVol',id),cost_net:nullable('pdCost',id),pvp:nullable('pdPvp',id),active:true};
  validateVariant(row,[...existing,...result],id);
  if(row.cost_net==null||row.pvp==null)throw new Error('Indica el coste y el PVP de cada nueva variante.');
  result.push(row);
 }
 return result;
}
export function refreshDraftStudies(settings,discount=0){
 const results=[];
 for(const el of document.querySelectorAll('.pricing-draft-variant')){
  const id=el.dataset.draftId,read=prefix=>document.getElementById(prefix+'_'+id)?.value??'';
  const cost=read('pdCost'),pvp=read('pdPvp');
  const r=variantStudy({cost_net:cost===''?null:cost,pvp:pvp===''?null:pvp},settings,discount);
  el.querySelector('[data-draft-study]').textContent=r?'Coste con IVA + RE: '+money(r.costReal)+' · Beneficio: '+money(r.margin)+' · Margen: '+r.marginPct.toFixed(1).replace('.',',')+' %':'Introduce coste y PVP para calcular el beneficio.';
  if(r)results.push({...r,costNet:r.cost});
 }
 return results;
}
export function draftRange(results,key){return numericRange(results.map(r=>r[key]),key==='marginPct'?v=>v.toFixed(1).replace('.',',')+' %':money)}
