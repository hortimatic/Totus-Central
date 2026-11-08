import {esc} from './utils.js';
import {textValue,productInputValue,matchExactReference} from './productos-core.js';
import {PRODUCT_CREATE_FIELDS,LOCALIZED_PRODUCT_FIELDS} from './productos-write-contract.js';
import {fieldHelp} from './components.js';
import {createProductStagesUI} from './productos-stages-ui.js';

// A small opt-in creation flow. It neither copies shop IDs nor changes existing
// products. Each destination is validated and committed separately.
export function createProductWizard({invoke,canEdit=()=>false}){
 const stages=createProductStagesUI({invoke,canEdit});
 const profiles=new Map(),categories=new Map(),relationCatalogs=new Map(),config=new Map(),previews=new Map(),requestIds=new Map(),
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
 const resourceLabels={manufacturers:'Marca',suppliers:'Proveedor',tax_rule_groups:'Grupo de impuestos',tags:'Etiquetas',product_features:'Características',product_feature_values:'Valores de características'};
 function relationsForm(shop,data,locked){
  const catalog=relationCatalogs.get(shop);
  if(!catalog)return '<div class="prd-relationships"><h5>Organización, marca y características</h5><p>Los registros se eligen por nombre desde esta tienda; sus identificadores no se copian entre destinos.</p>'+b('Consultar marcas, proveedores y características','create-load-relations',shop,locked)+'</div>';
  const select=(key,label,rows,multiple=false)=>'<label class="prd-field"><b>'+h(label)+'</b><select '+(multiple?'multiple size="5"':'')+' data-pr-create-relation="'+key+'" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'>'+(multiple?'':'<option value="">Sin asignar</option>')+rows.map(row=>'<option value="'+h(row.id)+'" '+((multiple?data.relations?.[key]||[]:[data.relations?.[key]]).includes(String(row.id))?'selected':'')+'>'+h(textValue(row.name)||textValue(row.value))+'</option>').join('')+'</select></label>';
  const cats=categories.get(shop)||[];
  const categoryName=id=>textValue(cats.find(c=>String(c.id)===String(id))?.name)||'';
  return '<fieldset class="prd-relationships"><legend>Relaciones de la tienda de destino</legend><div class="prd-fields-grid">'+
   select('manufacturer_id','Marca',catalog.manufacturers)+select('supplier_id','Proveedor',catalog.suppliers)+select('tax_rules_group_id','Grupo de impuestos',catalog.tax_rule_groups)+
   select('category_ids','Categorías asociadas',cats.map(c=>({...c,name:(categoryName(c.id_parent)?categoryName(c.id_parent)+' / ':'')+textValue(c.name)})),true)+
   select('tag_ids','Etiquetas',catalog.tags,true)+
   '<label class="prd-field"><b>Características y materiales</b><select multiple size="6" data-pr-create-features="true" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'>'+catalog.product_features.map(feature=>'<optgroup label="'+h(textValue(feature.name))+'">'+catalog.product_feature_values.filter(value=>String(value.id_feature)===String(feature.id)).map(value=>'<option value="'+h(feature.id)+':'+h(value.id)+'" '+((data.relations?.features||[]).some(f=>f.feature_id===String(feature.id)&&f.value_id===String(value.id))?'selected':'')+'>'+h(textValue(value.value))+'</option>').join('')+'</optgroup>').join('')+'</select><small>Selecciona un valor por característica. Se comprueba su pertenencia antes del alta.</small></label>'+select('related_product_ids','Productos relacionados seleccionados',catalog.related_products||[],true)+'</div><label class="prd-field"><b>Buscar producto relacionado por referencia exacta</b><input data-pr-create-field="related_reference" data-pr-create-store="'+h(shop)+'" value="'+h(data.related_reference||'')+'" '+(locked?'disabled':'')+'></label>'+b('Buscar y añadir relacionado','create-find-related',shop,locked)+'</fieldset>';
 }
 function render(plan,source){
  if(plan.operation!=='create'&&!results.get(plan.store)?.existing_product)return '';
  const shop=plan.store,profile=profiles.get(shop),result=results.get(shop);
  if(result)return '<section class="prd-creation"><h5>'+ (result.existing_product?'Etapas del producto existente':'Base del producto guardada')+'</h5><p>Producto <b>#'+h(result.record_id)+'</b>. '+(result.existing_product?'Cada etapa conserva el producto y las combinaciones anteriores.':result.active===true?'Publicación activa verificada.':'La base está verificada y permanece inactiva. Completa y revisa las etapas siguientes antes de publicarlo.')+'</p>'+stages.render(shop,result,plan,{...source,...Object.fromEntries(plan.changes.map(c=>[c.field,c.after]))},profiles.get(shop),relationCatalogs.get(shop))+'</section>';
  if(!profile)return '<section class="prd-creation"><h5>Alta en '+h(shop)+'</h5><p>Consulta primero los idiomas reales de esta tienda. No se copian los identificadores del origen.</p>'+b('Consultar idiomas de la tienda','create-load',shop)+'</section>';
  const data=draft(shop,plan,source),cats=categories.get(shop)||[],locked=attempted.has(shop),prepared=previews.get(shop),confirmation=confirmations.get(shop)||'';
  return '<section class="prd-creation"><h5>Alta individual · '+h(shop)+'</h5><p>El producto se crea inicialmente <b>inactivo</b>. Categoría e idiomas son específicos del destino.</p>'+
   (profile.product_workspace?'<details class="prd-connection-capabilities"><summary>Permisos de la conexión de productos</summary><p>Permisos anunciados por la tienda. Cada guardado necesita además verificar su resultado. Los permisos de tu usuario se comprueban por separado.</p><ul>'+profile.product_workspace.entries.map(entry=>'<li><b>'+h(entry.label)+'</b>: '+(entry.ready?'permisos disponibles':'falta '+h(entry.missing.join(', ')))+'</li>').join('')+'</ul></details>':'')+
   '<div class="prd-fields-grid">'+
   '<label class="prd-field"><b>Referencia nueva</b>'+fieldHelp('Referencia nueva','Identificador único por tienda. Una respuesta incierta no autoriza repetir el alta con otra referencia.')+'<input data-pr-create-field="reference" data-pr-create-store="'+h(shop)+'" value="'+h(data.reference)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>Precio base sin impuestos</b><input data-pr-create-field="price" data-pr-create-store="'+h(shop)+'" value="'+h(data.price)+'" '+(locked?'disabled':'')+'></label>'+
   '<label class="prd-field"><b>Categoría de destino</b>'+fieldHelp('Categoría de destino','Selecciona el nombre de una categoría de esta tienda. Los identificadores nunca se copian entre tiendas.')+'<select data-pr-create-field="category_id" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'><option value="">Selecciona una categoría</option>'+cats.map(c=>'<option value="'+h(c.id)+'" '+(data.category_id===String(c.id)?'selected':'')+'>'+h(textValue(c.name))+' · #'+h(c.id)+'</option>').join('')+'</select><small>'+cats.length+' categorías verificadas.</small></label>'+
   '</div>'+relationsForm(shop,data,locked)+'<div class="prd-fields-grid">'+profile.language_ids.map(id=>{
    const t=data.translations[id]||{name:'',link_rewrite:''};
    return '<fieldset class="prd-create-translation"><legend>Idioma de destino #'+h(id)+'</legend>'+
     '<label class="prd-field"><b>Nombre</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="name" data-pr-create-store="'+h(shop)+'" value="'+h(t.name)+'" '+(locked?'disabled':'')+'></label>'+
     '<label class="prd-field"><b>URL amigable</b><input data-pr-create-language="'+h(id)+'" data-pr-create-property="link_rewrite" data-pr-create-store="'+h(shop)+'" value="'+h(t.link_rewrite)+'" '+(locked?'disabled':'')+'></label>'+LOCALIZED_PRODUCT_FIELDS.filter(f=>!['name','link_rewrite'].includes(f)&&Object.prototype.hasOwnProperty.call(t,f)).map(f=>'<label class="prd-field"><b>'+h(({description:'Descripción completa',description_short:'Descripción breve',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',available_now:'Etiqueta con existencias',available_later:'Etiqueta sin existencias',delivery_in_stock:'Entrega con existencias',delivery_out_stock:'Entrega sin existencias'})[f])+'</b><textarea data-pr-create-language="'+h(id)+'" data-pr-create-property="'+f+'" data-pr-create-store="'+h(shop)+'" '+(locked?'disabled':'')+'>'+h(t[f])+'</textarea></label>').join('')+'</fieldset>';
   }).join('')+'</div>'+
   '<div class="inline-actions">'+b('Validar alta sin escribir','create-prepare',shop,locked)+
   (prepared?'<span class="prd-api-ok">Esquema, idiomas, categoría y duplicados validados. Todavía no se ha creado nada.</span>':'')+'</div>'+
   (prepared&&!prepared.can_commit?'<p class="prd-warning">La escritura POST aún no está habilitada en el servidor de Totus. Esta propuesta es solo consulta.</p>':'')+(prepared&&prepared.can_commit?'<div class="prd-create-confirm"><label>Para confirmar esta alta escribe <b>CREAR</b><input data-pr-create-confirm="'+h(shop)+'" autocomplete="off" value="'+h(confirmation)+'" '+(locked?'disabled':'')+'></label>'+
    b('Crear en PrestaShop (inactivo)','create-commit',shop,locked||!canEdit()||confirmation!=='CREAR')+'</div>':'')+
   (locked?'<p class="prd-warning">Petición de alta: <code>'+h(requestIds.get(shop))+'</code>. Conserva este identificador si hay un error. No cambies la referencia ni repitas el alta: comprueba primero el resultado.</p>'+b('Comprobar resultado sin repetir el alta','create-verify',shop,!canEdit())+'<details><summary>Recuperar un alta que no llegó a crearse</summary><p>Solo después de resolver el error. Totus comprobará dos veces la ausencia de la referencia, conservará esta misma solicitud y registrará el reintento. Si existe un producto, lo recuperará sin crear otro.</p><label>Escribe REINTENTAR<input data-pr-create-retry-confirm="'+h(shop)+'" value="'+h(confirmation)+'" autocomplete="off"></label>'+b('Reintentar solo si no existe','create-retry-absent',shop,!canEdit()||confirmation!=='REINTENTAR')+'</details>':'')+
   '</section>';
 }
 const reset=()=>{profiles.clear();categories.clear();relationCatalogs.clear();config.clear();previews.clear();requestIds.clear();attempted.clear();results.clear();confirmations.clear();stages.reset();};
 const invalidate=()=>{for(const [shop] of previews){if(!attempted.has(shop))previews.delete(shop);}for(const shop of confirmations.keys()){if(!attempted.has(shop))confirmations.delete(shop);}};
 function handleChange(el){
  if(stages.handleChange(el))return true;
  const shop=el?.dataset?.prCreateStore,language=el?.dataset?.prCreateLanguage,field=el?.dataset?.prCreateField;
  if(el?.dataset?.prCreateConfirm!==undefined){confirmations.set(el.dataset.prCreateConfirm,el.value);return true;}
  if(el?.dataset?.prCreateRetryConfirm!==undefined){confirmations.set(el.dataset.prCreateRetryConfirm,el.value);return true;}
  const relation=el?.dataset?.prCreateRelation,features=el?.dataset?.prCreateFeatures;
  if(!shop||(!field&&!language&&!relation&&!features))return false;
  if(attempted.has(shop))return true;
  const entry=config.get(shop);if(!entry)return false;
  if(relation){entry.relations??={};if(el.multiple)entry.relations[relation]=Array.from(el.selectedOptions).map(o=>o.value);else if(el.value)entry.relations[relation]=el.value;else delete entry.relations[relation];}
  else if(features){entry.relations??={};entry.relations.features=Array.from(el.selectedOptions).map(o=>{const [feature_id,value_id]=o.value.split(':');return {feature_id,value_id};});}
  else if(field&&['reference','price','category_id','related_reference'].includes(field)){entry[field]=productInputValue(field,el.value);if(field==='category_id'&&entry.relations)entry.relations.category_ids=[...new Set([...(entry.relations.category_ids||[]),el.value].filter(Boolean))];}
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
  const supported=new Set(['active','name','reference','price','link_rewrite',...PRODUCT_CREATE_FIELDS,...LOCALIZED_PRODUCT_FIELDS]);
  const requested=plan.changes.filter(c=>c.changed);
  if(requested.some(c=>!supported.has(c.field)&&textValue(c.after)!==''))throw Error('El alta contiene campos sin contrato de creación. Deselecciónalos: '+requested.filter(c=>!supported.has(c.field)).map(c=>c.field).join(', '));
  const fields=requested.filter(c=>PRODUCT_CREATE_FIELDS.includes(c.field)).map(c=>({field:c.field,value:productInputValue(c.field,textValue(c.after))}));
  if(fields.some(f=>f.field==='redirect_type')!==fields.some(f=>f.field==='id_type_redirected'))throw Error('Selecciona juntos el tipo y el destino de redirección.');
  return {reference:entry.reference,price:productInputValue('price',entry.price),category_id:entry.category_id,translations,...(fields.length?{fields}:{}),...(entry.relations?{relations:entry.relations}:{})};
 };
 async function perform(action,shop,plan,source,detail={}){
  if(!shop||plan.store!==shop||plan.operation!=='create'&&!results.get(shop)?.existing_product)throw Error('La operación no pertenece a esta tienda.');
  if(action.startsWith('create-stage-')){
   const result=results.get(shop);if(!result)throw Error('Guarda y verifica primero la base del producto.');
   return stages.perform(action.slice(7),shop,result,plan,{...source,...Object.fromEntries(plan.changes.map(c=>[c.field,c.after]))},profiles.get(shop),relationCatalogs.get(shop),detail);
  }
  if(plan.operation!=='create')throw Error('Este producto ya existe; utiliza sus etapas sin repetir el alta.');
  if(action==='create-find-related'){
   if(attempted.has(shop))throw Error('Las relaciones de la base ya están guardadas.');
   const entry=draft(shop,plan,source),catalog=relationCatalogs.get(shop);if(!catalog||!entry.related_reference?.trim())throw Error('Consulta los catálogos e indica la referencia exacta.');
   const response=await invoke(shop,'prestashop_read',{resource:'products',references:[entry.related_reference.trim()],page:0,page_size:100,sort:'oldest'});
   const match=matchExactReference(response.rows,entry.related_reference);if(match.status!=='matched')throw Error('No se ha encontrado una referencia única en esta tienda.');
   catalog.related_products=[...(catalog.related_products||[]).filter(row=>String(row.id)!==String(match.product.id)),match.product];entry.relations??={category_ids:[entry.category_id]};entry.relations.related_product_ids=[...new Set([...(entry.relations.related_product_ids||[]),String(match.product.id)])];entry.related_reference='';invalidate();
   return 'Producto relacionado encontrado y seleccionado: '+textValue(match.product.name)+'.';
  }
  if(action==='create-load-relations'){
   if(attempted.has(shop))throw Error('No se cambian relaciones durante una operación iniciada.');
   const catalogs={};
   for(const resource of Object.keys(resourceLabels)){
    const all=[],seen=new Set();let page=0;
    while(true){
     const response=await invoke(shop,'prestashop_read',{resource,page,page_size:100,sort:'oldest'});
     if(response.resource!==resource||!Array.isArray(response.rows))throw Error('No se pudo consultar '+resourceLabels[resource]+'.');
     for(const row of response.rows){if(seen.has(String(row.id)))throw Error('La consulta devolvió registros duplicados.');seen.add(String(row.id));all.push(row);}
     if(!response.possibly_more)break;if(!response.rows.length||++page>1000)throw Error('No se pudo completar el catálogo de '+resourceLabels[resource]+'.');
    }
    catalogs[resource]=all;
   }
   relationCatalogs.set(shop,catalogs);const data=draft(shop,plan,source);data.relations??={category_ids:data.category_id?[data.category_id]:[]};invalidate();
   return 'Relaciones consultadas en '+shop+'. Selecciona los registros de destino por su nombre.';
  }
  if(action==='create-load'){
   if(attempted.has(shop))throw Error('Esta alta ya se intentó. No se cambia el esquema de la petición.');
   const response=await invoke(shop,'prestashop_product_create_profile',{});
   if(response.persisted!==false||response.resource!=='products'||!Array.isArray(response.language_ids)||
      !response.language_ids.length||response.language_ids.some(id=>!/^[1-9]\d{0,14}$/.test(id)))
    throw Error('Los idiomas devueltos por la tienda no son verificables.');
   profiles.set(shop,{language_ids:response.language_ids,product_workspace:response.product_workspace});
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
   return 'Base guardada en '+shop+' con ID '+response.record_id+'. Completa las etapas pendientes; permanece inactivo.';
  }
  if(action==='create-verify'||action==='create-retry-absent'){
   const prepared=previews.get(shop),request_id=requestIds.get(shop);
   if(!canEdit()||!attempted.has(shop)||!prepared||!request_id)throw Error('No hay una petición de alta propia que comprobar.');
   const retry=action==='create-retry-absent';
   if(retry&&confirmations.get(shop)!=='REINTENTAR')throw Error('Escribe REINTENTAR después de revisar el error.');
   const response=await invoke(shop,'prestashop_product_create_commit',{...prepared.values,expected_fingerprint:prepared.fingerprint,request_id,confirmed:true,...(retry?{retry_absent:true}:{})});
   if(response.persisted!==true||response.verified!==true||!/^[1-9]\d{0,14}$/.test(String(response.record_id||'')))throw Error('Resultado aún no comprobado. No repitas el alta.');
   results.set(shop,{record_id:response.record_id,request_id});return 'Alta recuperada y verificada en '+shop+' · ID '+response.record_id+'. '+(response.reused?'Sin repetir el POST.':'Reintento confirmado registrado con la misma solicitud.');
  }
  throw Error('Acción de alta desconocida.');
 }
 async function openExisting(shop,source){
  if(!canEdit()||!/^\d+$/.test(String(source?.id||'')))throw Error('Selecciona un producto existente con permiso de edición.');
  const previous=results.get(shop);if(previous){if(previous.record_id!==String(source.id)||!previous.existing_product)throw Error('Hay otra operación de producto pendiente en esta tienda.');return;}
  const response=await invoke(shop,'prestashop_product_create_profile',{});
  if(response.persisted!==false||!Array.isArray(response.language_ids)||!response.language_ids.length)throw Error('No se han podido verificar los idiomas de esta tienda.');
  profiles.set(shop,{language_ids:response.language_ids,product_workspace:response.product_workspace});
  results.set(shop,{record_id:String(source.id),request_id:crypto.randomUUID(),existing_product:true});
 }
 return {result:shop=>results.get(shop),removed:stages.removed,render,reset,invalidate,handleChange,perform,openExisting,setCatalogs:(shop,catalog)=>relationCatalogs.set(shop,catalog),handleFile:stages.handleFile,snapshot:()=>({maps:[profiles,categories,relationCatalogs,config,previews,requestIds,results,confirmations].map(m=>[...m]),attempted:[...attempted],stages:stages.snapshot()}),restore:data=>{reset();if(!data)return;[profiles,categories,relationCatalogs,config,previews,requestIds,results,confirmations].forEach((m,i)=>{for(const [k,v] of data.maps[i])m.set(k,v);});for(const shop of data.attempted)attempted.add(shop);stages.restore(data.stages);},hasAttempted:shop=>attempted.has(shop)};
}
