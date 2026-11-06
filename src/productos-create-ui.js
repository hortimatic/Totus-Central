import {esc} from './utils.js';
import {textValue} from './productos-core.js';
import {PRODUCT_CREATE_FIELDS,LOCALIZED_PRODUCT_FIELDS} from './productos-write-contract.js';
import {fieldHelp} from './components.js';

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
  for(const lang of profiles.get(shop)?.language_ids||[]){
   saved.translations[lang]={name,link_rewrite:field(plan,'link_rewrite',slug(name))||slug(name)};
   for(const key of LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)))if(plan.changes.some(c=>c.field===key))saved.translations[lang][key]=field(plan,key);
  }
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
   '<label class="prd-field"><b>Referencia nueva</b>'+fieldHelp('Referencia nueva','Identificador único por tienda. Una respuesta incierta no autoriza repetir el alta con otra referencia.')+'<input data-pr-create-field="reference" data-pr-create-store="'+h(shop)+'" value="'+h(data.reference)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>Precio base sin impuestos</b><input data-pr-create-field="price" data-pr-create-store="'+h(shop)+'" value="'+h(data.price)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>Categoría de destino</b>'+fieldHelp('Categoría de destino','Selecciona el nombre de una categoría de esta tienda. Los identificadores nunca se copian entre tiendas.')+'<select data-pr-create-field="category_id" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'><option value="">Selecciona una categoría</option>'+cats.map(c=>'<option value="'+h(c.id)+'" '+(data.category_id===String(c.id)?'selected':'')+'>'+h(textValue(c.name))+' · #'+h(c.id)+'</option>').join('')+'</select><small>'+cats.length+' categorías verificadas.</small></label>'+
   '</div><div class="prd-fields-grid">'+profile.language_ids.map(id=>{
    const t=data.translations[id]||{name:'',link_rewrite:''};
    return '<fieldset class="prd-create-translation"><legend>Idioma de destino #'+h(id)+'</legend>'+
     '<label class="prd-field"><b>Nombre</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="name" data-pr-create-store="'+h(shop)+'" value="'+h(t.name)+'" '+(locked?'disabled':'')+'></label>'+
     '<label class="prd-field"><b>URL amigable</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="link_rewrite" data-pr-create-store="'+h(shop)+'" value="'+h(t.link_rewrite)+'" '+(locked?'disabled':'')+'></label>'+LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)&&Object.prototype.hasOwnProperty.call(t,f)).map(f=>'<label class="prd-field"><b>'+h(({description:'Descripción completa',description_short:'Descripción breve',meta_title:'Título SEO',meta_description:'Descripción SEO'})[f])+'</b><textarea data-pr-create-language="'+h(id)+'" data-pr-create-property="'+f+'" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'>'+h(t[f])+'</textarea></label>').join('')+'</fieldset>';
   }).join('')+'</div>'+
   '<div class="inline-actions">'+b('Validar alta sin escribir','create-prepare',shop,locked)+
   (prepared?'<span class="prd-api-ok">Esquema, idiomas, categoría y duplicados validados. Todavía no se ha creado nada.</span>':'')+'</div>'+
   (prepared&&!prepared.can_commit?'<p class="prd-warning">La escritura POST aún no está habilitada en el servidor de Totus. Esta propuesta es solo consulta.</p>':'')+(prepared&&prepared.can_commit?'<div class="prd-create-confirm"><label>Para confirmar esta alta escribe <b>CREAR</b><input data-pr-create-confirm="'+h(shop)+'" autocomplete="off" value="'+h(confirmation)+'" '+(locked?'disabled':'')+'></label>'+
    b('Crear en PrestaShop (inactivo)','create-commit',shop,locked||!canEdit()||confirmation!=='CREAR')+'</div>':'')+
   (locked?'<p class="prd-warning">Petición de alta: <code>'+h(requestIds.get(shop))+'</code>. Conserva este identificador si hay un error. No cambies la referencia ni repitas el alta: comprueba primero el resultado.</p>'+b('Comprobar resultado sin repetir el alta','create-verify',shop,!canEdit()):'')+
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
  else if(language&&LOCALIZED_PRODUCT_FIELDS.includes(el.dataset.prCreateProperty)){
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
  const supported=new Set(['name','reference','price','link_rewrite',...PRODUCT_CREATE_FIELDS,...LOCALIZED_PRODUCT_FIELDS]);
  const requested=plan.changes.filter(c=>c.changed);
  if(requested.some(c=>!supported.has(c.field)&&textValue(c.after)!==''))throw Error('El alta contiene campos sin contrato de creación. Deselecciónalos: '+requested.filter(c=>!supported.has(c.field)).map(c=>c.field).join(', '));
  const fields=requested.filter(c=>PRODUCT_CREATE_FIELDS.includes(c.field)).map(c=>({field:c.field,value:textValue(c.after)}));
  return {reference:entry.reference,price:entry.price,category_id:entry.category_id,translations,...(fields.length?{fields}:{})};
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
   const all=[],ids=new Set();let page=0;
   while(true){
    const c=await invoke(shop,'prestashop_read',{resource:'categories',page,page_size:100,sort:'oldest'});
    if(c.resource!=='categories'||!Array.isArray(c.rows))throw Error('No se pudieron comprobar las categorías.');
    for(const row of c.rows){if(!/^[1-9]\d{0,14}$/.test(String(row.id))||ids.has(String(row.id)))throw Error('Categorías duplicadas o no verificables.');ids.add(String(row.id));all.push(row);}
    if(!c.possibly_more)break;if(!c.rows.length||++page>1000)throw Error('La consulta de categorías no puede completarse.');
   }
   categories.set(shop,all);config.delete(shop);previews.delete(shop);
   return 'Idiomas y categorías consultados en '+shop+'. Ahora elige la categoría y valida el alta.';
  }
  if(action==='create-prepare'){
   if(attempted.has(shop))throw Error('Existe una operación iniciada que requiere conciliación.');
   const values=payload(shop,plan,source),response=await invoke(shop,'prestashop_product_create_prepare',values);
   if(response.persisted!==false||response.resource!=='products'||response.reference!==values.reference||
       !/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('La validación del servidor no es comprobable.');
   previews.set(shop,{fingerprint:response.fingerprint,values,can_commit:response.can_commit===true});confirmations.delete(shop);
   return 'Prevalidación de '+shop+' correcta, sin escritura. Confirma únicamente cuando hayas revisado la ficha.';
  }
  if(action==='create-commit'){
   if(plan.variants.some(v=>v.changes?.length))throw Error('El alta contiene variaciones aún sin correspondencia validada. No se creará un producto incompleto.');
   if(!canEdit())throw Error('La sesión no tiene permiso de edición.');
   if(confirmations.get(shop)!=='CREAR')throw Error('Escribe CREAR para confirmar.');
   const prepared=previews.get(shop);
   if(!prepared||attempted.has(shop))throw Error('Valida de nuevo el alta; no se repetirá una operación ya enviada.');
   if(!prepared.can_commit)throw Error('La escritura POST sigue deshabilitada en el servidor. No se ha enviado nada.');
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
  if(action==='create-verify'){
   const prepared=previews.get(shop),request_id=requestIds.get(shop);
   if(!canEdit()||!attempted.has(shop)||!prepared||!request_id)throw Error('No hay una petición de alta propia que comprobar.');
   const response=await invoke(shop,'prestashop_product_create_commit',{...prepared.values,expected_fingerprint:prepared.fingerprint,request_id,confirmed:true});
   if(response.persisted!==true||response.verified!==true||!/^[1-9]\d{0,14}$/.test(String(response.record_id||'')))throw Error('Resultado aún no comprobado. No repitas el alta.');
   results.set(shop,{record_id:response.record_id,request_id});return 'Alta recuperada por relectura en '+shop+' · ID '+response.record_id+'. No se ha repetido el POST.';
  }
  throw Error('Acción de alta desconocida.');
 }
 return {render,reset,invalidate,handleChange,perform,hasAttempted:shop=>attempted.has(shop)};
}
