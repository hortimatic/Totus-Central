import {esc} from './utils.js';
import {textValue} from './productos-core.js';

// A small opt-in creation flow. It neither copies shop IDs nor changes existing
// products. Each destination is validated and committed separately.
export function createProductWizard({invoke,canEdit=()=>false}){
 const profiles=new Map(),categories=new Map(),config=new Map(),previews=new Map(),requestIds=new Map(),
  attempted=new Set(),results=new Map(),confirmations=new Map();
 const h=v=>esc(String(v??''));
 const slug=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,128);
 const field=(plan,key,defaultValue='')=>{
  const change=plan.changes.find(c=>c.field===key);
  return change?textValue(change.after):defaultValue;
 };
 const draft=(shop,plan,source)=>{
  let saved=config.get(shop);
  if(saved)return saved;
  const name=field(plan,'name',textValue(source?.name));
  saved={category_id:'',reference:field(plan,'reference',textValue(source?.reference)),price:field(plan,'price',textValue(source?.price))||'0.00',
   translations:{}};
  for(const lang of profiles.get(shop)?.language_ids||[])saved.translations[lang]={name,link_rewrite:field(plan,'link_rewrite',slug(name))||slug(name)};
  config.set(shop,saved);return saved;
 };
 const b=(label,action,shop,disabled=false)=>
  '<button type="button" class="btn secondary" data-pr-action="'+action+'" data-pr-dest="'+h(shop)+'" '+(disabled?'disabled':'')+'>'+h(label)+'</button>';
 function render(plan,source){
  if(plan.operation!=='create')return '';
  const shop=plan.store,profile=profiles.get(shop),result=results.get(shop);
  if(result)return '<section class="prd-creation"><h5>Producto creado</h5><p>PrestaShop asignó el ID <b>#'+h(result.record_id)+'</b>. Alta comprobada por relectura; el producto permanece inactivo hasta una publicación autorizada.</p></section>';
  if(!profile)return '<section class="prd-creation"><h5>Alta en '+h(shop)+'</h5><p>Consulta primero los idiomas reales de esta tienda. No se copian los identificadores del origen.</p>'+b('Consultar idiomas de la tienda','create-load',shop)+'</section>';
  const data=draft(shop,plan,source),cats=categories.get(shop)||[],locked=attempted.has(shop),prepared=previews.get(shop),confirmation=confirmations.get(shop)||'';
  return '<section class="prd-creation"><h5>Alta individual · '+h(shop)+'</h5><p>El producto se crea inicialmente <b>inactivo</b>. Categoría e idiomas son específicos del destino.</p>'+
   '<div class="prd-fields-grid">'+
   '<label class="prd-field"><b>Referencia nueva</b><input data-pr-create-field="reference" data-pr-create-store="'+h(shop)+'" value="'+h(data.reference)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>Precio base sin impuestos</b><input data-pr-create-field="price" data-pr-create-store="'+h(shop)+'" value="'+h(data.price)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>ID de categoría de esta tienda</b><input data-pr-create-field="category_id" data-pr-create-store="'+h(shop)+'" inputmode="numeric" list="prd-category-'+h(shop)+'" placeholder="Selecciona una categoría verificada" value="'+h(data.category_id)+'" '+(locked?'disabled':'')+'><datalist id="prd-category-'+h(shop)+'">'+cats.map(c=>'<option value="'+h(c.id)+'">'+h(textValue(c.name))+'</option>').join('')+'</datalist><small>Categorías leídas: '+cats.length+(cats.length===100?' (puede haber más)':'')+'. La API verificará el ID antes de crear.</small></label>'+
   '</div><div class="prd-fields-grid">'+profile.language_ids.map(id=>{
    const t=data.translations[id]||{name:'',link_rewrite:''};
    return '<fieldset class="prd-create-translation"><legend>Idioma de destino #'+h(id)+'</legend>'+
     '<label class="prd-field"><b>Nombre</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="name" data-pr-create-store="'+h(shop)+'" value="'+h(t.name)+'" '+(locked?'disabled':'')+'></label>'+
     '<label class="prd-field"><b>URL amigable</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="link_rewrite" data-pr-create-store="'+h(shop)+'" value="'+h(t.link_rewrite)+'" '+(locked?'disabled':'')+'></label></fieldset>';
   }).join('')+'</div>'+
   '<div class="inline-actions">'+b('Validar alta sin escribir','create-prepare',shop,locked)+
   (prepared?'<span class="prd-api-ok">Esquema, idiomas, categoría y duplicados validados. Todavía no se ha creado nada.</span>':'')+'</div>'+
   (prepared&&!prepared.can_commit?'<p class="prd-warning">La escritura POST aún no está habilitada en el servidor de Totus. Esta propuesta es solo consulta.</p>':'')+(prepared&&prepared.can_commit?'<div class="prd-create-confirm"><label>Para confirmar esta alta escribe <b>CREAR</b><input data-pr-create-confirm="'+h(shop)+'" autocomplete="off" value="'+h(confirmation)+'" '+(locked?'disabled':'')+'></label>'+
    b('Crear en PrestaShop (inactivo)','create-commit',shop,locked||!canEdit()||confirmation!=='CREAR')+'</div>':'')+
   (locked?'<p class="prd-warning">Se inició una petición de alta. Su request_id se conserva durante esta sesión: no se enviará otra creación automáticamente si el resultado es incierto.</p>':'')+
   '</section>';
 }
 const reset=()=>{profiles.clear();categories.clear();config.clear();previews.clear();requestIds.clear();attempted.clear();results.clear();confirmations.clear();};
 const invalidate=()=>{for(const [shop] of previews){if(!attempted.has(shop))previews.delete(shop);}for(const shop of confirmations.keys()){if(!attempted.has(shop))confirmations.delete(shop);}};
 function handleChange(el){
  const shop=el?.dataset?.prCreateStore,language=el?.dataset?.prCreateLanguage,field=el?.dataset?.prCreateField;
  if(el?.dataset?.prCreateConfirm!==undefined){confirmations.set(el.dataset.prCreateConfirm,el.value);return true;}
  if(!shop||(!field&&!language))return false;
  if(attempted.has(shop))return true;
  const entry=config.get(shop);if(!entry)return false;
  if(field&&['reference','price','category_id'].includes(field))entry[field]=el.value;
  else if(language&&['name','link_rewrite'].includes(el.dataset.prCreateProperty)){
   entry.translations[language]??={name:'',link_rewrite:''};
   entry.translations[language][el.dataset.prCreateProperty]=el.value;
  }
  previews.delete(shop);confirmations.delete(shop);return true;
 }
 const payload=(shop,plan,source)=>{
  const profile=profiles.get(shop);if(!profile)throw Error('Consulta primero los idiomas de '+shop+'.');
  const entry=draft(shop,plan,source);
  if(!/^[1-9]\d{0,14}$/.test(entry.category_id))throw Error('Selecciona un ID de categoría válido para '+shop+'.');
  const translations=profile.language_ids.map(id=>({language_id:id,...entry.translations[id]}));
  if(translations.some(t=>!t.name||!t.link_rewrite))throw Error('Completa el nombre y la URL de todos los idiomas de '+shop+'.');
  return {reference:entry.reference,price:entry.price,category_id:entry.category_id,translations};
 };
 async function perform(action,shop,plan,source){
  if(plan.operation!=='create'||!shop||plan.store!==shop)throw Error('La operación no pertenece a esta tienda.');
  if(action==='create-load'){
   if(attempted.has(shop))throw Error('Esta alta ya se intentó. No se cambia el esquema de la petición.');
   const response=await invoke(shop,'prestashop_product_create_profile',{});
   if(response.persisted!==false||response.resource!=='products'||!Array.isArray(response.language_ids)||
      !response.language_ids.length||response.language_ids.some(id=>!/^[1-9]\d{0,14}$/.test(id)))
    throw Error('Los idiomas devueltos por la tienda no son verificables.');
   profiles.set(shop,{language_ids:response.language_ids});
   const c=await invoke(shop,'prestashop_read',{resource:'categories',page:0,page_size:100,sort:'oldest'});
   if(c.resource!=='categories'||!Array.isArray(c.rows))throw Error('No se pudieron comprobar las categorías.');
   categories.set(shop,c.rows);config.delete(shop);previews.delete(shop);
   return 'Idiomas y categorías consultados en '+shop+'. Ahora elige la categoría y valida el alta.';
  }
  if(action==='create-prepare'){
   if(attempted.has(shop))throw Error('Existe una operación iniciada que requiere conciliación.');
   const values=payload(shop,plan,source),response=await invoke(shop,'prestashop_product_create_prepare',values);
   if(response.persisted!==false||response.resource!=='products'||response.reference!==values.reference||
       !/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('La validación del servidor no es comprobable.');
   previews.set(shop,{fingerprint:response.fingerprint,values});confirmations.delete(shop);
   return 'Prevalidación de '+shop+' correcta, sin escritura. Confirma únicamente cuando hayas revisado la ficha.';
  }
  if(action==='create-commit'){
   if(plan.variants.some(v=>v.changes?.length))throw Error('El alta contiene variaciones aún sin correspondencia validada. No se creará un producto incompleto.');
   if(!canEdit())throw Error('La sesión no tiene permiso de edición.');
   if(confirmations.get(shop)!=='CREAR')throw Error('Escribe CREAR para confirmar.');
   const prepared=previews.get(shop);
   if(!prepared||attempted.has(shop))throw Error('Valida de nuevo el alta; no se repetirá una operación ya enviada.');
   const request_id=requestIds.get(shop)||crypto.randomUUID();requestIds.set(shop,request_id);
   attempted.add(shop); // Lock locally BEFORE sending: prevents uncertain duplicate clicks.
   const response=await invoke(shop,'prestashop_product_create_commit',{
    ...prepared.values,expected_fingerprint:prepared.fingerprint,request_id,confirmed:true
   });
   if(response.persisted!==true||response.verified!==true||!/^[1-9]\d{0,14}$/.test(String(response.record_id||'')))
    throw Error('PrestaShop no ha confirmado un ID verificable. Conserva el request_id para conciliación.');
   results.set(shop,{record_id:response.record_id,request_id});
   return 'Alta completada en '+shop+' con ID '+response.record_id+'. El producto permanece inactivo.';
  }
  throw Error('Acción de alta desconocida.');
 }
 return {render,reset,invalidate,handleChange,perform,hasAttempted:shop=>attempted.has(shop)};
}
