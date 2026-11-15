import {esc} from './utils.js';
import {websiteKey} from './website-registry.js';
import {textValue} from './productos-core.js';
import {showProductDialog} from './productos-dialogs.js';

const nativeDate=value=>{
 if(!value)return '0000-00-00 00:00:00';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'Z'))||new Date(value+'Z').toISOString().slice(0,16)!==value)throw Error('Indica una fecha válida.');
 return value.replace('T',' ')+':00';
};
export function catalogOfferFields({percent,from='',to='',quantity='1'}){
 const raw=String(percent).trim().replace(',','.');
 if(!/^\d{1,3}(?:\.\d{1,4})?$/.test(raw)||Number(raw)<=0||Number(raw)>100)throw Error('El descuento debe ser mayor que 0 y como máximo 100 %.');
 if(!/^[1-9]\d{0,8}$/.test(String(quantity)))throw Error('La cantidad mínima debe ser un entero positivo.');
 const start=nativeDate(from),end=nativeDate(to);
 if(from&&to&&start>end)throw Error('El final de la oferta debe ser posterior al inicio.');
 return {id_product_attribute:'0',id_shop:'0',id_shop_group:'0',id_currency:'0',id_country:'0',id_group:'0',id_customer:'0',id_cart:'0',price:'-1',from_quantity:String(quantity),reduction:(Number(raw)/100).toFixed(6),reduction_tax:'1',reduction_type:'percentage',from:start,to:end};
}
const overlaps=(a,b)=>(a.from==='0000-00-00 00:00:00'||b.to==='0000-00-00 00:00:00'||a.from<=b.to)&&(b.from==='0000-00-00 00:00:00'||a.to==='0000-00-00 00:00:00'||b.from<=a.to);
// Existing native step API: one durable parent/step and verified readback per product.
export function createCatalogOfferBatch({invoke,canEdit,current,persist}){
 let items=[],epoch=0;
 const guard=(generation=epoch)=>{if(generation!==epoch||!current()||!canEdit())throw Error('La cuenta, vista o sus permisos han cambiado.');};
 const readOffers=async(item,generation)=>{
  const offers=[],seen=new Set();
  for(let page=0;page<1000;page++){
   guard(generation);const response=await invoke(item.shop,'prestashop_read',{resource:'specific_prices',product_ids:[item.id],page,page_size:100});
   guard(generation);if(response.resource!=='specific_prices'||!Array.isArray(response.rows)||response.rows.some(row=>String(row.id_product)!==item.id||seen.has(String(row.id))))throw Error('No se pudieron comprobar las ofertas existentes.');
   for(const row of response.rows){seen.add(String(row.id));offers.push(row);}
   if(!response.possibly_more)return offers;
   if(!response.rows.length)break;
  }
  throw Error('La lectura de ofertas está incompleta.');
 };
 const args=item=>({parent_request_id:item.parent,product_id:item.id,kind:'special_price',step_key:item.step,existing_product:true,fields:item.fields});
 async function prepare(rows,options,onProgress=()=>{}){
  const generation=epoch;guard(generation);if(items.some(i=>i.attempted&&!i.done))throw Error('Comprueba primero las ofertas pendientes; no se sustituirán sus solicitudes.');
  if(!rows.length||rows.length>200)throw Error('Selecciona entre 1 y 200 productos.');
  const fields=catalogOfferFields(options),seen=new Set();
  items=rows.map(row=>{const shop=String(row.__store),id=String(row.id),key=shop+'|'+id;if(!websiteKey(shop)||!/^[1-9]\d{0,14}$/.test(id)||seen.has(key))throw Error('Producto o tienda no válido o repetido.');seen.add(key);return {shop,id,name:textValue(row.name),parent:crypto.randomUUID(),step:crypto.randomUUID().replaceAll('-',''),fields:{...fields}};});
  for(const [index,item] of items.entries()){guard(generation);onProgress('Revisando oferta '+(index+1)+'/'+items.length+' · '+item.name+'…');if((await readOffers(item,generation)).some(offer=>overlaps({...offer,from:offer.from||'0000-00-00 00:00:00',to:offer.to||'0000-00-00 00:00:00'},fields)))throw Error(item.name+': ya tiene una oferta en ese periodo. Revisa su ficha; el lote no sustituye ofertas existentes.');
   const result=await invoke(item.shop,'prestashop_product_step_prepare',args(item));guard(generation);if(result.persisted!==false||!result.can_commit||!/^[a-f0-9]{64}$/.test(result.fingerprint||''))throw Error('La oferta no se puede validar para '+item.name+'.');item.fingerprint=result.fingerprint;
  }
  await persist();guard(generation);return snapshot();
 }
 async function publish(onProgress=()=>{}){
  const generation=epoch;guard(generation);if(!items.length||items.some(i=>!i.fingerprint))throw Error('Revisa el lote completo antes de publicar.');
  for(const item of items){if(item.done)continue;guard(generation);onProgress('Publicando y comprobando '+(items.filter(i=>i.done).length+1)+'/'+items.length+' · '+item.name+'…');
   if(!item.attempted&&(await readOffers(item,generation)).some(offer=>overlaps({...offer,from:offer.from||'0000-00-00 00:00:00',to:offer.to||'0000-00-00 00:00:00'},item.fields)))throw Error(item.name+': las ofertas han cambiado desde la revisión. No se ha sobrescrito ninguna.');
   item.attempted=true;await persist();guard(generation);
   const result=await invoke(item.shop,'prestashop_product_step_commit',{...args(item),expected_fingerprint:item.fingerprint,confirmed:true});guard(generation);
   if(result.persisted!==true||result.verified!==true||!/^[1-9]\d{0,14}$/.test(String(result.record_id)))throw Error('Resultado no verificado. Conserva esta solicitud y pulsa Comprobar y continuar.');
   item.done={record_id:String(result.record_id)};await persist();guard(generation);
  }
  return items.length;
 }
 const snapshot=()=>structuredClone(items);
 function open({root,trigger,rows,onState,onClose,onDone}){
  guard();const pending=items.some(i=>i.attempted&&!i.done),dialog=document.createElement('dialog');dialog.className='prd-quick-edit';
  dialog.innerHTML='<form><header><div><h3>Ofertas por lote</h3><p>Descuento temporal · conserva los precios base y los impactos de las combinaciones.</p></div><button type="button" class="btn secondary" data-offer-close aria-label="Cerrar ofertas">×</button></header><p>Se aplica a los productos seleccionados y sus combinaciones, para todos los clientes. Las fechas corresponden al horario configurado en la tienda. No se sobrescriben ofertas existentes.</p><div class="form-grid"><label>Descuento (%)<input name="percent" inputmode="decimal" required></label><label>Cantidad mínima<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Desde (opcional)<input name="from" type="datetime-local"></label><label>Hasta (opcional)<input name="to" type="datetime-local"></label></div><p data-offer-status role="status"></p><div data-offer-review></div><footer><button type="button" class="btn secondary" data-offer-close>Cerrar</button><button type="submit" class="btn secondary">Revisar ofertas</button><button type="button" class="btn primary" data-offer-publish hidden>Publicar ofertas revisadas</button></footer></form>';
  const form=dialog.querySelector('form'),output=dialog.querySelector('[data-offer-status]'),review=dialog.querySelector('[data-offer-review]'),save=dialog.querySelector('[data-offer-publish]');let busy=false;
  const lock=value=>{busy=value;onState(value);for(const el of dialog.querySelectorAll('button,input'))el.disabled=value;};
  const draw=()=>{review.innerHTML='<div class="table-wrap"><table class="data-table"><thead><tr><th>Tienda</th><th>Producto</th><th>Descuento</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead><tbody>'+items.map(i=>'<tr><td>'+esc(i.shop)+'</td><td>'+esc(i.name)+' · #'+i.id+'</td><td>'+Number(i.fields.reduction)*100+' %</td><td>'+esc(i.fields.from)+'</td><td>'+esc(i.fields.to)+'</td><td>'+(i.done?'Verificada':i.attempted?'Pendiente de comprobar':'Sin enviar')+'</td></tr>').join('')+'</tbody></table></div>';};
  dialog.addEventListener('click',e=>{if(e.target===dialog&&busy)e.stopImmediatePropagation();},true);const close=()=>{if(!busy)dialog.close();};dialog.oncancel=e=>{e.preventDefault();close();};dialog.onclick=e=>{if(e.target.closest('[data-offer-close]'))close();};dialog.addEventListener('close',()=>{onState(false);onClose();},{once:true});
  form.oninput=()=>{if(pending)return;save.hidden=true;review.replaceChildren();};
  form.onsubmit=async e=>{e.preventDefault();if(busy||pending)return;const options=Object.fromEntries(new FormData(form));lock(true);save.hidden=true;try{await prepare(rows,options,message=>output.textContent=message);draw();save.hidden=false;output.textContent='Ofertas revisadas sin escribir. Comprueba la selección y el periodo.';}catch(error){output.textContent=error.message;}finally{lock(false);}};
  save.onclick=async()=>{if(busy)return;lock(true);try{const count=await publish(message=>output.textContent=message);dialog.close();onDone(count+' ofertas guardadas y verificadas en PrestaShop.');}catch(error){draw();save.textContent='Comprobar y continuar';output.textContent=items.filter(i=>i.done).length+'/'+items.length+' guardadas. '+error.message+' El lote se ha detenido; se conserva la misma solicitud.';}finally{lock(false);}};
  if(pending){draw();save.hidden=false;save.textContent='Comprobar y continuar';for(const input of form.querySelectorAll('input'))input.readOnly=true;form.querySelector('[type=submit]').hidden=true;}
  showProductDialog(root,dialog,{label:'Ofertas por lote',trigger});return dialog;
 }
 return {prepare,publish,open,snapshot,restore:value=>{epoch++;items=Array.isArray(value)?structuredClone(value):[];},pending:()=>items.some(i=>i.attempted&&!i.done),reset:()=>{epoch++;items=[];}};
}
