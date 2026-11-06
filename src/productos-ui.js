import {PRODUCT_STORES,PRODUCT_SECTIONS,VARIANT_FIELDS,textValue,associationIds,normalizedProduct,matchExactReference,buildProductPlan,bulkVariantSelection} from './productos-core.js';
import {storeConnection} from './prestashop-readonly.js';
import {PRODUCT_WRITE_FIELDS,LOCALIZED_PRODUCT_FIELDS} from './productos-write-contract.js';
import {esc} from './utils.js';

export const productosWorkspacePage=()=>'<div class="page productos-page"><section id="productosRoot" aria-label="Gestión de productos"><p role="status">Cargando Productos…</p></section></div>';
const h=x=>esc(String(x??''));
const btn=(label,action,extra='',disabled=false)=>'<button type="button" class="btn secondary" data-pr-action="'+action+'" '+extra+(disabled?' disabled':'')+'>'+h(label)+'</button>';
const STORE_OPTIONS=PRODUCT_STORES.map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('');
const MODES=[['catalogo','Catálogo'],['ficha','Ficha y campos'],['variantes','Variaciones'],['comparar','Comparar y preparar'],['bulk','Cambios masivos']];
const metadata={name:'Nombre',reference:'Referencia',description_short:'Descripción breve',description:'Descripción completa',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',link_rewrite:'URL amigable',price:'Precio',wholesale_price:'Coste',ean13:'EAN',weight:'Peso',id_tax_rules_group:'Regla de impuestos',active:'Activo',visibility:'Visibilidad'};
const text=(v,max=140)=>{const s=textValue(v);return s.length>max?s.slice(0,max)+'…':s;};
const keyFor=(item)=>String(item?.id||item?.draft_key||'');
const validReference=s=>typeof s==='string'&&s.trim().length>0;
export function createProductosUI({rpc,invoke,actor,allowed,canEdit=()=>false}){
 let root=null,owner=null,epoch=0,mode='catalogo',store='hortimatic',pending=false,status='Selecciona una tienda y consulta su catálogo.',connections=[],rows=[],hasMore=false,page=0,query='',record=null,variants=[],fields=new Set(),overrides={},variantFields=new Map(),variantOverrides=new Map(),targets=new Set(['newoldsmok']),comparison=new Map(),preview=[],selection=new Set(),targetOverrides=new Map(),preflight=new Map(),targetRaw=new Map(),targetLanguages=new Map(),targetIds=new Map(),variantPreflight=new Map();
 const connection=shop=>storeConnection(connections,shop);
 const ready=shop=>{const c=connection(shop);return !!c&&c.enabled&&c.configured&&c.verified_revision===c.revision&&c.real_data_authorized===true;};
 const current=()=>!!root?.isConnected&&owner===actor()&&allowed()&&root.dataset.prEpoch===String(epoch);
 const stateSnapshot=()=>({store,mode,record:record?.id||null});
 const invalidate=()=>{preview=[];comparison.clear();preflight.clear();variantPreflight.clear();};
 function resetDraft(){
  record=null;variants=[];fields=new Set();overrides={};variantFields.clear();variantOverrides.clear();selection.clear();targetOverrides.clear();targetRaw.clear();targetLanguages.clear();targetIds.clear();invalidate();
 }
 function sectionTitle(section){return ({general:'Información y descripción',precios:'Precios e impuestos',seo:'SEO',transporte:'Transporte',inventario:'Disponibilidad',organizacion:'Organización'})[section]||section;}
 function showField(field){
  const value=Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record?.[field]);
  const large=['description','description_short','meta_description'].includes(field);
  return '<label class="prd-field"><span><input type="checkbox" data-pr-field="'+h(field)+'" '+(fields.has(field)?'checked':'')+'><b>'+h(metadata[field]||field)+'</b></span>'+(large?'<textarea data-pr-value="'+h(field)+'" rows="3" '+(!fields.has(field)?'disabled':'')+'>'+h(value)+'</textarea>':'<input data-pr-value="'+h(field)+'" value="'+h(value)+'" '+(!fields.has(field)?'disabled':'')+'>')+'</label>';
 }
 function form(){
  return '<section class="prd-fields"><p class="prd-note">Selecciona únicamente los campos que quieres preparar. El texto es editable antes de comparar o aplicar. Los campos sin seleccionar nunca entran en el plan.</p>'+priceHelp()+Object.entries(PRODUCT_SECTIONS).map(([section,names])=>'<details open class="card card-pad"><summary><strong>'+h(sectionTitle(section))+'</strong></summary><div class="prd-fields-grid">'+names.filter(n=>record&&Object.prototype.hasOwnProperty.call(record,n)||['name','reference','description','meta_title','meta_description','price','link_rewrite'].includes(n)).map(showField).join('')+'</div></details>').join('')+'</section>';
 }
 function priceHelp(){return '<p class="prd-note">PrestaShop utiliza precio base de producto sin impuestos y, en cada combinación, un impacto de precio. No es necesariamente el PVP final. No se cambia el stock desde esta pantalla.</p>';}
 function variantsPanel(){
  if(!record)return empty('Selecciona un producto','Puedes gestionar y comparar cada variación de forma independiente.');
  const add=btn('Añadir variación de borrador','new-variant','','');
  return '<section class="card card-pad"><div class="prd-heading"><div><h3>Variaciones</h3><p>Cada combinación mantiene su ID o identificador temporal, referencia y atributos propios.</p></div>'+add+'</div>'+priceHelp()+(!variants.length?empty('Sin combinaciones cargadas','Si el producto tiene combinaciones, ábrelo desde el catálogo para leerlas.'):variants.map(v=>{
   const id=keyFor(v),chosen=variantFields.get(id)||new Set(),override=variantOverrides.get(id)||{};
   return '<details class="prd-variant" data-pr-variant="'+h(id)+'"><summary><b>'+h(text(v.reference)||'Sin referencia')+'</b><small>ID '+h(v.id||'borrador')+' · atributos '+h(associationIds(v,'product_option_values').join(', ')||'sin verificar')+'</small><span>'+chosen.size+' campos seleccionados</span></summary><div class="prd-variant-fields">'+VARIANT_FIELDS.map(field=>'<label><span><input type="checkbox" data-pr-vfield="'+h(field)+'" data-pr-vid="'+h(id)+'" '+(chosen.has(field)?'checked':'')+'> '+h(metadata[field]||field)+'</span><input data-pr-vvalue="'+h(field)+'" data-pr-vid="'+h(id)+'" value="'+h(Object.prototype.hasOwnProperty.call(override,field)?override[field]:textValue(v[field]))+'" '+(!chosen.has(field)?'disabled':'')+'></label>').join('')+'</div></details>';
  }).join(''))+'</section>';
 }
 function empty(title,description){return '<div class="prd-empty"><h3>'+h(title)+'</h3><p>'+h(description)+'</p></div>';}
 function catalog(){
  const filtered=rows.filter(r=>(text(r.name)+' '+text(r.reference)+' '+text(r.ean13)).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  return '<section class="card card-pad"><div class="prd-heading"><div><h3>Seleccionar producto</h3><p>La búsqueda se aplica a lo cargado. Si quedan páginas, consulta más registros.</p></div><div class="inline-actions">'+btn('Consultar catálogo','catalog-load','',!ready(store)||pending)+btn('Crear borrador nuevo','new-product','',pending)+'</div></div><label>Buscar en productos cargados<input data-pr-search placeholder="Nombre, referencia o EAN" value="'+h(query)+'"></label><div class="prd-catalog-list">'+filtered.map(p=>'<div class="prd-catalog-row"><span><strong>'+h(text(p.name)||'Sin nombre')+'</strong><small>#'+h(p.id)+' · '+h(text(p.reference)||'Sin referencia')+' · '+h(text(p.ean13))+'</small></span>'+btn('Abrir ficha','open-product','data-id="'+h(p.id)+'"',pending)+'</div>').join('')+(filtered.length?'':empty('No hay productos visibles','Consulta la tienda o ajusta el filtro.'))+'</div><div class="prd-footer"><span>'+rows.length+' productos cargados'+(hasMore?' · consulta parcial':' · fin de consulta')+'</span>'+btn('Cargar más','catalog-more','',!hasMore||pending)+'</div></section>';
 }
 function rawPanel(){
  if(!record)return '';
  const other=Object.keys(record).filter(k=>!Object.values(PRODUCT_SECTIONS).flat().includes(k));
  return '<details class="card card-pad"><summary><b>Información adicional de la API</b> · '+other.length+' campos</summary><p>Solo lectura: campos especiales, asociaciones y datos de módulos necesitan un contrato específico para modificarse.</p><div class="prd-raw">'+other.map(k=>'<div><b>'+h(k)+'</b><span>'+h(typeof record[k]==='object'?JSON.stringify(record[k]).slice(0,350):text(record[k],350))+'</span></div>').join('')+'</div></details>';
 }
 function editor(){
  if(!record)return empty('Abre un producto o crea un borrador','El editor mostrará los datos completos y los campos seleccionables.');
  return '<header class="prd-product-name"><h3>'+h(text(record.name)||'Producto nuevo')+'</h3><span>'+(record.id?'Producto #'+h(record.id):'Borrador sin ID de PrestaShop')+'</span></header>'+form()+rawPanel();
 }
 function targetLanguageIds(dest,field){
  const value=targetRaw.get(dest)?.[field];
  const langs=Array.isArray(value)?value:Array.isArray(value?.language)?value.language:value?.language?[value.language]:[];
  return [...new Set(langs.map(x=>String(x?.id??x?.id_lang??'')).filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
 }
 function languagePicker(dest,field){
  if(!LOCALIZED_PRODUCT_FIELDS.includes(field)||!targetRaw.get(dest))return '';
  const ids=targetLanguageIds(dest,field),selected=targetLanguages.get(dest)?.[field]||'';
  return '<span class="prd-lang-label">Idioma de destino</span><select data-pr-lang-store="'+h(dest)+'" data-pr-lang-field="'+h(field)+'"><option value="">Seleccionar idioma</option>'+ids.map(id=>'<option value="'+h(id)+'" '+(selected===id?'selected':'')+'>Idioma #'+h(id)+'</option>').join('')+'</select>'+(ids.length?'':'<small>No se han detectado idiomas en esta ficha; revisión necesaria.</small>');
 }
 function comparisonPanel(){
  if(!record)return empty('Selecciona una ficha','Primero abre un producto o crea un borrador.');
  return '<section class="card card-pad"><h3>Tiendas de destino</h3><p>Selecciona una o ambas. Cada tienda conserva sus propios ID, categorías, imágenes y atributos.</p><div class="prd-targets">'+PRODUCT_STORES.map(s=>'<label><input type="checkbox" data-pr-target="'+s.key+'" '+(targets.has(s.key)?'checked':'')+'> '+h(s.label)+' '+(ready(s.key)?'':'· sin conexión verificada')+'</label>').join('')+'</div><div class="prd-target-overrides">'+[...targets].map(dest=>'<fieldset><legend>Adaptación específica · '+h(PRODUCT_STORES.find(x=>x.key===dest)?.label)+'</legend><label class="prd-field"><b>ID de producto de destino existente (opcional)</b><input inputmode="numeric" pattern="[0-9]*" data-pr-existing-id="'+h(dest)+'" placeholder="Buscar por referencia si se deja vacío" value="'+h(targetIds.get(dest)||'')+'"><small>Si las referencias no coinciden, indica el ID real del producto que quieres actualizar. Se releerá la ficha exacta.</small></label><div class="prd-fields-grid">'+[...fields].map(field=>'<label class="prd-field"><b>'+h(metadata[field]||field)+'</b><input data-pr-target-field="'+h(field)+'" data-pr-target-store="'+h(dest)+'" value="'+h(Object.prototype.hasOwnProperty.call(targetOverrides.get(dest)||{},field)?targetOverrides.get(dest)[field]:Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record[field]))+'">'+languagePicker(dest,field)+'</label>').join('')+'</div></fieldset>').join('')+'</div><div class="inline-actions">'+btn('Buscar coincidencias y preparar cambios','compare','',pending||!targets.size)+btn('Descartar propuesta','clear-preview','',pending)+'</div><div class="prd-preview">'+(preview.length?preview.map(plan=>'<section class="prd-plan"><h4>'+h(PRODUCT_STORES.find(s=>s.key===plan.store)?.label)+' · '+(plan.operation==='update'?'Actualizar #'+h(plan.target_id):'Crear producto nuevo')+'</h4><p>'+plan.changes.filter(x=>x.changed).length+' campos cambiados · '+plan.variants.length+' variaciones seleccionadas</p><ul>'+plan.changes.filter(x=>x.changed).map(change=>'<li><b>'+h(metadata[change.field]||change.field)+'</b>: '+h(text(change.before))+' → '+h(text(change.after))+'</li>').join('')+'</ul>'+((preflight.get(plan.store)?.record_id===plan.target_id)?'<p class="prd-api-ok">XML real consultado y campos seleccionados verificados, sin escribir.</p>':'')+btn('Validar contra el XML de la tienda','api-preview','data-pr-dest="'+h(plan.store)+'"',pending||!plan.target_id||!plan.changes.some(c=>c.changed))+plan.variants.filter(v=>v.changes.some(c=>c.changed)).map(v=>'<div class="prd-variant-review"><span>Variación #'+h(v.target_id||'nueva')+' · '+h(v.changes.filter(c=>c.changed).length)+' campos</span>'+((variantPreflight.has(plan.store+'|'+v.target_id))?'<small>XML comprobado</small>':'')+btn('Validar variación','variant-api-preview','data-pr-dest="'+h(plan.store)+'" data-pr-variation="'+h(v.target_id||'')+'"',pending||!v.target_id)+'</div>').join('')+plan.warnings.map(w=>'<p class="prd-warning">'+h(w)+'</p>').join('')+'</section>').join(''):'<p>Sin propuesta calculada. Primero selecciona los campos de la ficha y, si corresponde, de cada combinación.</p>')+'</div><p class="prd-note"><b>Publicación bloqueada en esta fase.</b> Preparar cambios no escribe en PrestaShop. El guardado real exigirá una operación de servidor validada y confirmación expresa.</p><button class="btn primary" type="button" disabled title="Pendiente de validar la escritura por Webservice">Publicar en tiendas seleccionadas · pendiente</button></section>';
 }
 function bulk(){
  return '<section class="card card-pad"><h3>Selección masiva por variación</h3><p>Las combinaciones no se mezclan con el producto principal. Selecciona exactamente las referencias que quieras tratar.</p>'+(!variants.length?empty('Abre un producto con variaciones','En esta fase se prepara la selección, todavía no se ejecutan actualizaciones masivas.'):variants.map(v=>'<label class="prd-bulk-row"><input type="checkbox" data-pr-bulk="'+h(keyFor(v))+'" '+(selection.has(keyFor(v))?'checked':'')+'><span>'+h(text(v.reference)||'Sin referencia')+'</span><small>ID '+h(v.id||'borrador')+'</small></label>').join(''))+'<div class="inline-actions">'+btn('Revisar selección','bulk-preview','',!selection.size)+'</div><p class="prd-note">La ejecución masiva por lotes, historial y reintentos estará disponible tras comprobar el contrato de escritura.</p></section>';
 }
 function render(){
  if(!current())return;
  const opened=[...root.querySelectorAll('.prd-variant[open]')].map(el=>el.dataset.prVariant);
  root.innerHTML='<div class="prd-shell"><header class="prd-intro"><div><span class="eyebrow">Centro independiente PrestaShop</span><h2>Productos</h2><p>Fichas completas, variaciones y transferencias selectivas entre Hortimatic y NewOldSmok.</p></div><label>Tienda de origen<select data-pr-store>'+PRODUCT_STORES.map(s=>'<option value="'+s.key+'" '+(store===s.key?'selected':'')+'>'+h(s.label)+'</option>').join('')+'</select></label></header><p role="status" class="prd-status">'+h(status)+'</p><nav class="prd-tabs" aria-label="Secciones de Productos">'+MODES.map(([id,label])=>btn(label,'mode','data-mode="'+id+'"'+(mode===id?' aria-current="page"':''),pending)).join('')+'</nav><div class="prd-body">'+(mode==='catalogo'?catalog():mode==='ficha'?editor():mode==='variantes'?variantsPanel():mode==='comparar'?comparisonPanel():bulk())+'</div></div>';
  for(const detail of root.querySelectorAll('.prd-variant'))if(opened.includes(detail.dataset.prVariant))detail.open=true;
 }
 async function invokeShop(shop,action,args){
  if(!current())throw Error('La sesión ha cambiado.');
  const c=connection(shop);if(!ready(shop))throw Error('Comprueba la conexión de '+shop+' antes de consultar.');
  const r=await invoke({action,store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),...args});
  if(!current())throw Error('La sesión ha cambiado.');
  if(r?.ok!==true||r.store!==shop)throw Error('Respuesta de tienda no verificada.');
  return r;
 }
 async function loadItem(shop,resource,id){
  const r=await invokeShop(shop,'prestashop_item_read',{resource,record_id:String(id)});
  if(r.resource!==resource||String(r.record_id)!==String(id))throw Error('Detalle ajeno a la selección.');
  return r.item;
 }
 async function combinations(shop,product){
  const ids=associationIds(product,'combinations');
  if(ids.length>75)throw Error('El producto tiene más de 75 combinaciones; ampliar lectura antes de editar.');
  const list=[];
  for(const id of ids){const item=await loadItem(shop,'combinations',id);
   if(String(item.id_product)!==String(product.id))throw Error('Combinación asociada a otro producto.');
   list.push(item);
  }
  return list;
 }
 async function work(fn){
  if(pending||!current())return;
  pending=true;render();
  try{await fn();}catch(e){if(current())status=e?.message||String(e);}
  finally{pending=false;if(current())render();}
 }
 async function loadCatalog(more){
  if(!more){rows=[];page=0;hasMore=false;}
  const r=await invokeShop(store,'prestashop_read',{resource:'products',page,page_size:100,sort:'newest'});
  if(r.resource!=='products'||r.page!==page||!Array.isArray(r.rows))throw Error('Listado no verificable.');
  const ids=new Set(rows.map(x=>String(x.id)));
  for(const p of r.rows){if(ids.has(String(p.id)))throw Error('Producto duplicado entre páginas.');ids.add(String(p.id));rows.push(p);}
  hasMore=!!r.possibly_more;page++;status='Catálogo de '+store+': '+rows.length+' productos consultados'+(hasMore?' (parcial).':'.');
 }
 async function openProduct(id){
  resetDraft();record=normalizedProduct(await loadItem(store,'products',id)).raw;
  variants=await combinations(store,record);
  mode='ficha';status='Ficha #'+id+' y '+variants.length+' combinaciones leídas de '+store+'. Selecciona campos para preparar cambios.';
 }
 function freshProduct(){
  resetDraft();record={id:null,name:'',reference:'',active:'0',description:'',description_short:'',meta_title:'',meta_description:'',link_rewrite:'',price:''};
  fields=new Set(['name','reference','price','description','meta_title','link_rewrite']);
  targets=new Set([store]);mode='ficha';status='Borrador nuevo. Prepara los campos y después selecciona la tienda de destino.';
 }
 async function prepare(){
  if(!record)throw Error('Abre una ficha o prepara un producto nuevo.');
  if(!targets.size)throw Error('Selecciona alguna tienda de destino.');
  const plans=[],readTargets=new Map();
  for(const dest of targets){
   const adapted=targetOverrides.get(dest)||{};
   const sourceRef=String(Object.prototype.hasOwnProperty.call(adapted,'reference')?adapted.reference:Object.prototype.hasOwnProperty.call(overrides,'reference')?overrides.reference:textValue(record.reference)).trim();
   let target=null,related=[];
   const explicit=String(targetIds.get(dest)||'').trim();
   if(explicit){
    if(!/^[1-9]\d{0,14}$/.test(explicit))throw Error('ID del producto de destino no válido para '+dest+'.');
    target=await loadItem(dest,'products',explicit);
    readTargets.set(dest,target);
    related=await combinations(dest,target);
   }
   if(!explicit&&validReference(sourceRef)){
    const found=await invokeShop(dest,'prestashop_read',{resource:'products',page:0,page_size:100,sort:'oldest',references:[sourceRef]});
    if(found.possibly_more)throw Error('Hay más coincidencias en '+dest+'. No se selecciona destino automáticamente.');
    const match=matchExactReference(found.rows,sourceRef);
    if(match.status==='ambiguous')throw Error('Referencia duplicada en '+dest+'. Revisión manual necesaria.');
    if(match.status==='matched'){
     target=await loadItem(dest,'products',match.product.id);
     readTargets.set(dest,target);
     related=await combinations(dest,target);
    }
   }
   const selected=variants.filter(v=>(variantFields.get(keyFor(v))?.size||0)>0).map(v=>{
    const same=related.filter(t=>validReference(textValue(v.reference))&&textValue(v.reference).trim().toLocaleLowerCase('es')===textValue(t.reference).trim().toLocaleLowerCase('es'));
    if(same.length>1)throw Error('Referencia de combinación duplicada en '+dest+'.');
    return {source:v,target:same[0]||null,fields:[...(variantFields.get(keyFor(v))||[])],overrides:variantOverrides.get(keyFor(v))||{}};
   });
   plans.push(buildProductPlan({source:record,target,store:dest,fields:[...fields],overrides:{...overrides,...(targetOverrides.get(dest)||{})},variants:selected}));
  }
  targetRaw=readTargets;comparison=new Map(plans.map(p=>[p.store,p]));preview=plans;mode='comparar';status='Propuesta preparada para '+plans.length+' tienda(s). Ningún dato se ha modificado.';
 }
 async function previewXml(dest){
  const plan=comparison.get(dest);
  if(!plan||!plan.target_id)throw Error('Solo se puede validar XML de productos existentes. La creación requiere su propio contrato.');
  // Product fields and combinations have separate previews. Do not imply full-plan validation.
  const requested=plan.changes.filter(c=>c.changed);
  if(!requested.length)throw Error('No hay cambios de campos para validar.');
  const enabled=new Set(PRODUCT_WRITE_FIELDS.products),localized=new Set(LOCALIZED_PRODUCT_FIELDS);
  if(requested.some(c=>!enabled.has(c.field)))throw Error('Hay campos cuyo contrato de escritura está pendiente. Deselecciónalos para validar los demás.');
  for(const change of requested.filter(c=>localized.has(c.field))){
   const id=targetLanguages.get(dest)?.[change.field];
   if(!id||!targetLanguageIds(dest,change.field).includes(id))throw Error('Elige el idioma real de destino para '+change.field+' antes de validar.');
  }
  if(requested.some(c=>typeof c.after!=='string'&&typeof c.after!=='number'&&typeof c.after!=='boolean'))throw Error('El campo no admite escritura automática; revisa sus idiomas o relaciones.');
  const response=await invokeShop(dest,'prestashop_product_prepare',{resource:'products',record_id:plan.target_id,
   changes:requested.map(c=>({field:c.field,value:String(c.after),...(localized.has(c.field)?{language_id:targetLanguages.get(dest)[c.field]}:{})}))});
  if(response.persisted!==false||response.record_id!==plan.target_id||!/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('La preparación del servidor no es verificable.');
  preflight.set(dest,{record_id:plan.target_id,fingerprint:response.fingerprint,fields:response.changes.map(c=>c.field)});
  status='XML del producto validado para '+dest+': '+response.changes.length+' campos. Las variaciones se comprueban aparte. Sin guardado.';
 }
 async function previewVariant(dest,id){
  const plan=comparison.get(dest),variant=plan?.variants.find(v=>v.target_id===id);
  if(!variant)throw Error('No existe una variación de destino seleccionada.');
  const changes=variant.changes.filter(c=>c.changed);
  if(!changes.length)throw Error('No hay cambios para comprobar en esta variación.');
  if(changes.some(c=>!PRODUCT_WRITE_FIELDS.combinations.includes(c.field)||typeof c.after!=='string'&&typeof c.after!=='number'))throw Error('Hay campos de variante sin contrato de escritura validado.');
  const result=await invokeShop(dest,'prestashop_product_prepare',{resource:'combinations',record_id:id,changes:changes.map(c=>({field:c.field,value:String(c.after)}))});
  if(result.persisted!==false||result.record_id!==id||!/^[a-f0-9]{64}$/.test(result.fingerprint||''))throw Error('La validación XML de la variación no es verificable.');
  variantPreflight.set(dest+'|'+id,{fingerprint:result.fingerprint,fields:changes.map(c=>c.field)});
  status='Variación #'+id+' de '+dest+' comprobada sin escribir. Pendiente de verificar atributos antes de guardar.';
 }
 function newVariant(){
  if(!record)throw Error('Crea o abre una ficha primero.');
  const item={draft_key:'draft-'+crypto.randomUUID(),reference:'',price:'',weight:'',ean13:'',minimal_quantity:'1',associations:{product_option_values:[]}};
  variants.push(item);variantFields.set(keyFor(item),new Set(['reference','price','minimal_quantity']));status='Variación de borrador añadida. Sus atributos requerirán correspondencia en destino.';
 }
 async function mount(node){
  dispose();root=node;owner=actor();const gen=++epoch;root.dataset.prEpoch=String(gen);mode='catalogo';store='hortimatic';status='Comprobando conexiones. Ningún dato se modifica.';rows=[];page=0;hasMore=false;resetDraft();
  if(!allowed()){root.textContent='No tienes permiso de consulta de PrestaShop.';return;}
  root.oninput=e=>{if(e.target.matches('[data-pr-search]')){query=e.target.value;render();const f=root.querySelector('[data-pr-search]');f?.focus();f?.setSelectionRange(query.length,query.length);}};
  root.onchange=e=>{
   if(e.target.matches('[data-pr-store]')){store=e.target.value;rows=[];page=0;hasMore=false;query='';resetDraft();status='Tienda de origen: '+store+'.';render();return;}
   if(e.target.matches('[data-pr-target]')){e.target.checked?targets.add(e.target.dataset.prTarget):targets.delete(e.target.dataset.prTarget);invalidate();render();return;}
   if(e.target.matches('[data-pr-field]')){const field=e.target.dataset.prField;e.target.checked?fields.add(field):fields.delete(field);if(!e.target.checked){delete overrides[field];for(const values of targetOverrides.values())delete values[field];}invalidate();render();return;}
   if(e.target.matches('[data-pr-value]')){overrides[e.target.dataset.prValue]=e.target.value;invalidate();return;}
   if(e.target.matches('[data-pr-existing-id]')){targetIds.set(e.target.dataset.prExistingId,e.target.value);invalidate();return;}
   if(e.target.matches('[data-pr-target-field]')){const dest=e.target.dataset.prTargetStore,field=e.target.dataset.prTargetField,values=targetOverrides.get(dest)||{};values[field]=e.target.value;targetOverrides.set(dest,values);invalidate();return;}
   if(e.target.matches('[data-pr-lang-store]')){const dest=e.target.dataset.prLangStore,field=e.target.dataset.prLangField,values=targetLanguages.get(dest)||{};values[field]=e.target.value;targetLanguages.set(dest,values);preflight.clear();return;}
   if(e.target.matches('[data-pr-vfield]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVfield,set=variantFields.get(id)||new Set();e.target.checked?set.add(field):set.delete(field);variantFields.set(id,set);invalidate();render();return;}
   if(e.target.matches('[data-pr-vvalue]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVvalue,values=variantOverrides.get(id)||{};values[field]=e.target.value;variantOverrides.set(id,values);invalidate();return;}
   if(e.target.matches('[data-pr-bulk]')){e.target.checked?selection.add(e.target.dataset.prBulk):selection.delete(e.target.dataset.prBulk);render();}
  };
  root.onclick=e=>{const b=e.target.closest('[data-pr-action]');if(!b||!current())return;const a=b.dataset.prAction;
   if(a==='mode'){mode=b.dataset.mode;render();return;}
   if(a==='new-product'){freshProduct();render();return;}
   if(a==='new-variant'){newVariant();render();return;}
   if(a==='clear-preview'){invalidate();status='Propuesta descartada; la ficha original sigue cargada.';render();return;}
   if(a==='bulk-preview'){try{bulkVariantSelection(variants,[...selection],['reference']);status='Selección comprobada: '+selection.size+' variaciones distintas. Ejecutar en lote permanece desactivado.';}catch(error){status=error.message;}render();return;}
   if(a==='catalog-load')void work(()=>loadCatalog(false));
   if(a==='catalog-more')void work(()=>loadCatalog(true));
   if(a==='open-product')void work(()=>openProduct(b.dataset.id));
   if(a==='compare')void work(prepare);
   if(a==='api-preview')void work(()=>previewXml(b.dataset.prDest));
   if(a==='variant-api-preview')void work(()=>previewVariant(b.dataset.prDest,b.dataset.prVariation));
  };
  render();
  try{const response=await rpc('totus_prestashop_context',{});if(!current())return;connections=response?.connections||[];status='Conexiones consultadas. Selecciona la tienda y carga el catálogo.';}
  catch(e){if(current())status='No se han podido comprobar las conexiones: '+(e.message||'error');}
  if(current())render();
 }
 function hasDraft(){return !!record&&(fields.size>0||[...variantFields.values()].some(s=>s.size>0));}
 function discardDraft(){resetDraft();status='Propuesta descartada.';if(current())render();}
 function dispose(){if(root){root.onclick=null;root.onchange=null;root.oninput=null;}root=null;owner=null;++epoch;pending=false;}
 return {mount,dispose,hasDraft,discardDraft,stateSnapshot};
}
