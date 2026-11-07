import {buildProductRequest,renderProductRequestForm} from './productos-request.js';
import {PRODUCT_STORES,PRODUCT_SECTIONS,VARIANT_FIELDS,textValue,productInputValue,associationIds,normalizedProduct,matchExactReference,buildProductPlan,bulkVariantSelection} from './productos-core.js';
import {storeConnection} from './prestashop-readonly.js';
import {PRODUCT_WRITE_FIELDS,LOCALIZED_PRODUCT_FIELDS} from './productos-write-contract.js';
import {createProductWizard} from './productos-create-ui.js';
import {esc} from './utils.js';
import {fieldHelp} from './components.js';
import {productDraftStore} from './productos-draft-store.js';
import {productPriceStudy} from './pricing-core.js';

export const productosWorkspacePage=()=>'<div class="page productos-page"><section id="productosRoot" aria-label="Gestión de productos"><p role="status">Cargando Productos…</p></section></div>';
const h=x=>esc(String(x??''));
const btn=(label,action,extra='',disabled=false)=>'<button type="button" class="btn secondary" data-pr-action="'+action+'" '+extra+(disabled?' disabled':'')+'>'+h(label)+'</button>';
const STORE_OPTIONS=PRODUCT_STORES.map(s=>'<option value="'+s.key+'">'+s.label+'</option>').join('');
const MODES=[['catalogo','Catálogo'],['ficha','Ficha y campos'],['variantes','Variaciones'],['comparar','Fichas paralelas'],['bulk','Cambios masivos'],['encargo','Encargo para ChatGPT']];
const metadata={name:'Nombre',reference:'Referencia',description_short:'Descripción breve',description:'Descripción completa',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',link_rewrite:'URL amigable',price:'Precio',wholesale_price:'Coste',ean13:'EAN',weight:'Peso',id_tax_rules_group:'Regla de impuestos',active:'Activo',visibility:'Visibilidad',isbn:'ISBN',upc:'UPC',mpn:'Referencia del fabricante',condition:'Estado del producto',available_for_order:'Disponible para pedidos',show_price:'Mostrar precio',online_only:'Solo venta online',unit_price_ratio:'Relación precio base / precio unitario',unity:'Unidad de medida',on_sale:'En oferta',ecotax:'Ecotasa',redirect_type:'Tipo de redirección',id_type_redirected:'Destino de redirección',width:'Anchura',height:'Altura',depth:'Profundidad',additional_shipping_cost:'Suplemento de envío',minimal_quantity:'Cantidad mínima',available_date:'Fecha de disponibilidad',location:'Ubicación',low_stock_threshold:'Umbral de pocas existencias',low_stock_alert:'Aviso de pocas existencias',out_of_stock:'Pedidos sin existencias',show_condition:'Mostrar condición',additional_delivery_times:'Tipo de plazo de entrega',delivery_in_stock:'Plazo con existencias',delivery_out_stock:'Plazo sin existencias',available_now:'Etiqueta con existencias',available_later:'Etiqueta sin existencias'};
const text=(v,max=140)=>{const s=textValue(v);return s.length>max?s.slice(0,max)+'…':s;};
const keyFor=(item)=>String(item?.id||item?.draft_key||'');
const validReference=s=>typeof s==='string'&&s.trim().length>0;
export function createProductosUI({rpc,invoke,actor,allowed,canEdit=()=>false}){
 let requestBrief={operation:'url',store:'hortimatic'},requestOutput='';
 let storageReady=false,storageQueue=Promise.resolve(),storageError=null;
 let priceOptions={vat:'21',re:'5.2',discount:'0'};
 let listSize=20,listPage=0,parallelSection='general',bulkField='price',bulkValue='',bulkItems=[],bulkConfirm='';
 let root=null,owner=null,epoch=0,mode='catalogo',store='hortimatic',pending=false,status='Selecciona una tienda y consulta su catálogo.',connections=[],rows=[],hasMore=false,page=0,query='',record=null,variants=[],fields=new Set(),overrides={},variantFields=new Map(),variantOverrides=new Map(),targets=new Set(['newoldsmok']),comparison=new Map(),preview=[],selection=new Set(),targetOverrides=new Map(),preflight=new Map(),targetRaw=new Map(),targetLanguages=new Map(),targetIds=new Map(),variantPreflight=new Map();
 const connection=shop=>storeConnection(connections,shop);
 const shopRecords=new Map(),editRequests=new Map(),editConfirm=new Map();
 const ready=shop=>{const c=connection(shop);return !!c&&c.enabled&&c.configured&&c.verified_revision===c.revision&&c.real_data_authorized===true;};
 const current=()=>!!root?.isConnected&&owner===actor()&&allowed()&&root.dataset.prEpoch===String(epoch);
 const stateSnapshot=()=>({store,mode,record:record?.id||null});
 const createWizard=createProductWizard({invoke:(shop,action,args)=>invokeShop(shop,action,args),canEdit});
 const snapshotDraft=()=>({store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight,shops:shopRecords,editRequests,editConfirm,wizard:createWizard.snapshot()});
 const persistDraft=()=>{if(!storageReady||!owner)return;const key=owner,value=record?structuredClone(snapshotDraft()):null;storageError=null;storageQueue=storageQueue.catch(()=>{}).then(()=>productDraftStore(key,value)).catch(error=>{storageError=error||Error('Borrador local no disponible');if(current())status='No se ha podido conservar el borrador local. No cierres esta pestaña hasta comprobar las operaciones pendientes.';});};
 function restoreDraft(d){
  if(!d||!PRODUCT_STORES.some(s=>s.key===d.store)||!d.record)return false;
  ({store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight}=d);
  for(const [map,values] of [[shopRecords,d.shops],[editRequests,d.editRequests],[editConfirm,d.editConfirm]]){map.clear();for(const [key,value] of values||[])map.set(key,value);}
  createWizard.restore(d.wizard);return true;
 }
 const invalidate=()=>{preview=[];comparison.clear();preflight.clear();variantPreflight.clear();createWizard.invalidate();};
 function resetDraft(){
  shopRecords.clear();editRequests.clear();editConfirm.clear();bulkItems=[];bulkConfirm='';record=null;variants=[];fields=new Set();overrides={};variantFields.clear();variantOverrides.clear();selection.clear();targetOverrides.clear();targetRaw.clear();targetLanguages.clear();targetIds.clear();createWizard.reset();invalidate();
 }
 function sectionTitle(section){return ({general:'Información y descripción',precios:'Precios e impuestos',seo:'SEO',transporte:'Transporte',inventario:'Disponibilidad',organizacion:'Organización'})[section]||section;}
 function fieldControl(field,value,attrs,disabled=false){
  const enums={active:[['0','Inactivo'],['1','Activo']],available_for_order:[['0','No permitir compra'],['1','Permitir compra']],show_price:[['0','Ocultar precio'],['1','Mostrar precio']],online_only:[['0','No'],['1','Sí']],on_sale:[['0','No'],['1','Sí']],show_condition:[['0','No'],['1','Sí']],low_stock_alert:[['0','No'],['1','Sí']],visibility:[['both','Catálogo y búsqueda'],['catalog','Solo catálogo'],['search','Solo búsqueda'],['none','Oculto']],condition:[['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']],additional_delivery_times:[['0','Sin plazo'],['1','Plazo general'],['2','Plazo específico']],out_of_stock:[['0','Denegar pedidos'],['1','Permitir pedidos'],['2','Preferencia de la tienda']]};
  const locked=disabled?' disabled':'';
  if(enums[field])return '<select '+attrs+locked+'><option value="">Sin indicar</option>'+enums[field].map(([id,label])=>'<option value="'+id+'" '+(String(value)===id?'selected':'')+'>'+label+'</option>').join('')+'</select>';
  return ['description','description_short','meta_description'].includes(field)?'<textarea '+attrs+' rows="4"'+locked+'>'+h(value)+'</textarea>':'<input '+attrs+' value="'+h(value)+'"'+locked+'>';
 }
 function showField(field){
  const value=Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record?.[field]);
  return '<label class="prd-field"><span><input type="checkbox" data-pr-field="'+h(field)+'" '+(fields.has(field)?'checked':'')+'><b>'+h(metadata[field]||field)+'</b>'+fieldHelp(metadata[field]||field,'Selecciona este campo para incluirlo en la propuesta. Precio y coste se expresan sin impuestos; las categorías y relaciones se verifican en la tienda de destino.')+'</span>'+fieldControl(field,value,'data-pr-value="'+h(field)+'"',!fields.has(field))+'</label>';
 }
 function form(){
  return '<section class="prd-fields"><p class="prd-note">Selecciona únicamente los campos que quieres preparar. El texto es editable antes de comparar o aplicar. Los campos sin seleccionar nunca entran en el plan.</p>'+priceHelp()+Object.entries(PRODUCT_SECTIONS).map(([section,names])=>'<details open class="card card-pad"><summary><strong>'+h(sectionTitle(section))+'</strong></summary><div class="prd-fields-grid">'+names.filter(n=>record&&Object.prototype.hasOwnProperty.call(record,n)||['name','reference','description','meta_title','meta_description','price','link_rewrite'].includes(n)).map(showField).join('')+'</div></details>').join('')+'</section>';
 }
 function priceHelp(){return '<p class="prd-note">PrestaShop utiliza precio base de producto sin impuestos y, en cada combinación, un impacto de precio. No es necesariamente el PVP final. No se cambia el stock desde esta pantalla.</p>';}
 function priceStudy(){
  const value=field=>Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record?.[field]);
  const study=productPriceStudy({saleNet:value('price'),costNet:value('wholesale_price'),...priceOptions});
  const euro=value=>new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value),pct=value=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(value)+' %';
  return '<section class="card card-pad prd-price-study"><h3>Estudio de precio</h3><p>Cálculo compartido con Precio. Estos porcentajes son de simulación: no sustituyen el grupo de impuestos elegido en PrestaShop. El coste recuperado de la tienda es orientativo.</p><div class="prd-fields-grid">'+[['vat','IVA de compra y venta (%)'],['re','Recargo de equivalencia de compra (%)'],['discount','Descuento simulado (%)']].map(([key,label])=>'<label class="prd-field"><b>'+label+'</b><input inputmode="decimal" data-pr-price-option="'+key+'" value="'+h(priceOptions[key])+'"></label>').join('')+'</div>'+(study?'<dl class="prd-price-results"><div><dt>Venta sin impuestos</dt><dd>'+euro(study.saleNet)+'</dd></div><div><dt>Venta con impuestos</dt><dd>'+euro(study.finalSale)+'</dd></div><div><dt>Coste de compra con IVA y recargo</dt><dd>'+euro(study.costReal)+'</dd></div><div><dt>Margen sin impuestos</dt><dd>'+euro(study.netMargin)+' · '+pct(study.netMarginPct)+'</dd></div><div><dt>Margen con recargo de equivalencia</dt><dd>'+euro(study.margin)+' · '+pct(study.marginPct)+'</dd></div></dl>':'<p role="status">Completa precio de venta sin impuestos, coste y porcentajes válidos para calcular el margen.</p>')+'</section>';
 }
 function variantsPanel(){
  if(!record)return empty('Selecciona un producto','Puedes gestionar y comparar cada variación de forma independiente.');
  const add=btn('Añadir variación de borrador','new-variant','','');
  return '<section class="card card-pad"><div class="prd-heading"><div><h3>Variaciones</h3><p>Cada combinación mantiene su ID o identificador temporal, referencia y atributos propios.</p></div>'+add+'</div>'+priceHelp()+(!variants.length?empty('Sin combinaciones cargadas','Si el producto tiene combinaciones, ábrelo desde el catálogo para leerlas.'):variants.map(v=>{
   const id=keyFor(v),chosen=variantFields.get(id)||new Set(),override=variantOverrides.get(id)||{};
   return '<details class="prd-variant" data-pr-variant="'+h(id)+'"><summary><b>'+h(text(v.reference)||'Sin referencia')+'</b><small>ID '+h(v.id||'borrador')+' · atributos '+h(associationIds(v,'product_option_values').join(', ')||'sin verificar')+'</small><span>'+chosen.size+' campos seleccionados</span></summary><div class="prd-variant-fields">'+VARIANT_FIELDS.map(field=>'<label><span><input type="checkbox" data-pr-vfield="'+h(field)+'" data-pr-vid="'+h(id)+'" '+(chosen.has(field)?'checked':'')+'> '+h(metadata[field]||field)+'</span><input data-pr-vvalue="'+h(field)+'" data-pr-vid="'+h(id)+'" value="'+h(Object.prototype.hasOwnProperty.call(override,field)?override[field]:textValue(v[field]))+'" '+(!chosen.has(field)?'disabled':'')+'></label>').join('')+'</div></details>';
  }).join(''))+'</section>';
 }
 function empty(title,description){return '<div class="prd-empty"><h3>'+h(title)+'</h3><p>'+h(description)+'</p></div>';}
 function shopCards(){
  return '<section class="prd-shop-cards" aria-label="Una ficha por tienda">'+PRODUCT_STORES.map(s=>{
   const item=shopRecords.get(s.key),selected=s.key===store;
   return '<article class="card card-pad prd-shop-card"'+(selected?' aria-current="true"':'')+'><header><h3>'+s.label+'</h3><span class="badge">'+(selected?'Tienda seleccionada':ready(s.key)?'Conectada':'Revisar conexión')+'</span></header><p>'+(item?h(text(item.name))+'<br><small>#'+h(item.id)+' · '+h(text(item.reference))+'</small>':record?.id?'Correspondencia por referencia pendiente de consultar.':'Consulta su catálogo o crea una ficha nueva.')+'</p><div class="inline-actions">'+(item?btn('Abrir esta ficha','shop-open','data-pr-shop="'+s.key+'"',pending):'')+btn(record?.id?'Comprobar correspondencia':'Seleccionar tienda','shop-check','data-pr-shop="'+s.key+'"',pending||!ready(s.key))+(record?.id&&s.key!==store?btn('Copiar y adaptar aquí','shop-copy','data-pr-shop="'+s.key+'"',pending||!ready(s.key)):'')+'</div></article>';
  }).join('')+'</section>';
 }
 function catalog(){
  const filtered=rows.filter(r=>(text(r.name)+' '+text(r.reference)+' '+text(r.ean13)).toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
  const pages=Math.max(1,Math.ceil(filtered.length/listSize));listPage=Math.min(listPage,pages-1);const visible=filtered.slice(listPage*listSize,(listPage+1)*listSize);
  return '<section class="card card-pad"><div class="prd-heading"><div><h3>Seleccionar producto</h3><p>La búsqueda se aplica a lo cargado. Si quedan páginas, consulta más registros.</p></div><div class="inline-actions">'+btn('Consultar catálogo','catalog-load','',!ready(store)||pending)+btn('Crear borrador nuevo','new-product','',pending)+'</div></div><label>Buscar en productos cargados<input data-pr-search placeholder="Nombre, referencia o EAN" value="'+h(query)+'"></label><div class="prd-catalog-list">'+visible.map(p=>'<div class="prd-catalog-row"><span><strong>'+h(text(p.name)||'Sin nombre')+'</strong><small>#'+h(p.id)+' · '+h(text(p.reference)||'Sin referencia')+' · '+h(text(p.ean13))+'</small></span>'+btn('Abrir ficha','open-product','data-id="'+h(p.id)+'"',pending)+'</div>').join('')+(visible.length?'':empty('No hay productos visibles','Consulta la tienda o ajusta el filtro.'))+'</div><div class="prd-footer"><span>'+rows.length+' productos cargados'+(hasMore?' · consulta parcial':' · fin de consulta')+'</span><label>Mostrar<select data-pr-page-size>'+[20,50,100].map(n=>'<option value="'+n+'" '+(listSize===n?'selected':'')+'>'+n+'</option>').join('')+'</select></label><span>Página '+(listPage+1)+' de '+pages+'</span>'+btn('Anterior','catalog-prev','',pending||listPage===0)+btn('Siguiente','catalog-next','',pending||listPage+1>=pages&&!hasMore)+btn('Cargar más','catalog-more','',!hasMore||pending)+'</div></section>';
 }
 function rawPanel(){
  if(!record)return '';
  const other=Object.keys(record).filter(k=>!Object.values(PRODUCT_SECTIONS).flat().includes(k));
  return '<details class="card card-pad"><summary><b>Información adicional de la API</b> · '+other.length+' campos</summary><p>Solo lectura: campos especiales, asociaciones y datos de módulos necesitan un contrato específico para modificarse.</p><div class="prd-raw">'+other.map(k=>'<div><b>'+h(k)+'</b><span>'+h(typeof record[k]==='object'?JSON.stringify(record[k]).slice(0,350):text(record[k],350))+'</span></div>').join('')+'</div></details>';
 }
 function editor(){
  if(!record)return empty('Abre un producto o crea un borrador','El editor mostrará los datos completos y los campos seleccionables.');
  return '<header class="prd-product-name"><h3>'+h(text(record.name)||'Producto nuevo')+'</h3><span>'+(record.id?'Producto #'+h(record.id):'Borrador sin ID de PrestaShop')+'</span></header>'+form()+priceStudy()+rawPanel()+'<div class="prd-footer">'+btn(record.id?'Continuar: comparar campos seleccionados':'Continuar: elegir destino y validar alta','compare','',pending)+'</div>';
 }
 function targetLanguageIds(dest,field){
  const value=targetRaw.get(dest)?.[field];
  const langs=Array.isArray(value)?value:Array.isArray(value?.language)?value.language:value?.language?[value.language]:[];
  return [...new Set(langs.map(x=>String(x?.id??x?.id_lang??'')).filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
 }
 function languagePicker(dest,field){
  if(!LOCALIZED_PRODUCT_FIELDS.includes(field)||!targetRaw.get(dest))return '';
  const ids=targetLanguageIds(dest,field),selected=targetLanguages.get(dest)?.[field]||'',raw=targetRaw.get(dest)?.[field],entries=Array.isArray(raw)?raw:Array.isArray(raw?.language)?raw.language:raw?.language?[raw.language]:[];
  return '<span class="prd-lang-label">Idioma de destino</span><select data-pr-lang-store="'+h(dest)+'" data-pr-lang-field="'+h(field)+'"><option value="">Seleccionar idioma</option>'+ids.map(id=>'<option value="'+h(id)+'" '+(selected===id?'selected':'')+'>Idioma #'+h(id)+(entries.find(x=>String(x.id??x.id_lang)===id)?' · '+h(text(entries.find(x=>String(x.id??x.id_lang)===id)?.value,30)):'')+'</option>').join('')+'</select>'+(ids.length?'':'<small>No se han detectado idiomas en esta ficha; revisión necesaria.</small>');
 }
 function variantSaveControls(shop,id){
  if(!id)return '';
  const key=shop+'|'+id,prepared=variantPreflight.get(key),sent=editRequests.get(key);
  return '<label>Confirmar combinación<input data-pr-edit-confirm="'+key+'" placeholder="GUARDAR" value="'+h(editConfirm.get(key)||'')+'"></label>'+btn(sent?'Comprobar combinación enviada':'Guardar combinación','variant-edit-commit','data-pr-dest="'+shop+'" data-pr-variation="'+id+'"',pending||!canEdit()||!sent&&!prepared?.can_commit);
 }
 async function commitVariant(shop,id){
  const key=shop+'|'+id,plan=comparison.get(shop);if(!canEdit()||!plan?.target_id||editConfirm.get(key)!=='GUARDAR')throw Error('Revisa la combinación y escribe GUARDAR.');
  let args=editRequests.get(key);
  if(!args){const prepared=variantPreflight.get(key);if(!prepared?.can_commit)throw Error('Valida primero la combinación.');args={resource:'combinations',record_id:id,expected_product_id:plan.target_id,changes:prepared.changes,expected_fingerprint:prepared.fingerprint,request_id:prepared.request_id,confirmed:true};editRequests.set(key,args);}
  const response=await invokeShop(shop,'prestashop_product_commit',args);if(response.persisted!==true||response.verified!==true||String(response.record_id)!==String(id))throw Error('Combinación no verificada; conserva la solicitud para comprobarla.');
  const actual=await loadItem(shop,'combinations',id);if(String(actual.id_product)!==String(plan.target_id))throw Error('Relectura de otro producto.');
  variantPreflight.delete(key);editRequests.delete(key);editConfirm.delete(key);status='Combinación #'+id+' guardada y releída en '+shop+'.';
 }
 function editControls(plan){
  const prepared=preflight.get(plan.store),sent=editRequests.get(plan.store);
  return '<div class="prd-edit-actions"><label>Para guardar los campos seleccionados escribe GUARDAR<input data-pr-edit-confirm="'+plan.store+'" value="'+h(editConfirm.get(plan.store)||'')+'"></label>'+btn(sent?'Comprobar actualización enviada':'Guardar cambios en '+plan.store,'edit-commit','data-pr-dest="'+plan.store+'"',pending||!canEdit()||!sent&&!prepared?.can_commit)+'</div>';
 }
 async function commitEdit(shop){
  if(!canEdit()||editConfirm.get(shop)!=='GUARDAR')throw Error('Revisa los cambios y escribe GUARDAR.');
  let args=editRequests.get(shop);
  if(!args){const prepared=preflight.get(shop);if(!prepared?.can_commit)throw Error('Valida primero la ficha real.');args={resource:'products',record_id:prepared.record_id,changes:prepared.changes,expected_fingerprint:prepared.fingerprint,request_id:prepared.request_id,confirmed:true};editRequests.set(shop,args);}
  const result=await invokeShop(shop,'prestashop_product_commit',args);
  if(result.persisted!==true||result.verified!==true||String(result.record_id)!==String(args.record_id))throw Error('Guardado no verificado. Conserva la solicitud y comprueba de nuevo.');
  const saved=await loadItem(shop,'products',args.record_id);shopRecords.set(shop,saved);targetRaw.set(shop,saved);preflight.delete(shop);editRequests.delete(shop);editConfirm.delete(shop);
  status='Actualización guardada y releída en '+shop+' · #'+args.record_id+'.';
 }
 function parallelEditors(){
  const stores=[store,...PRODUCT_STORES.map(s=>s.key).filter(s=>s!==store)];
  const sections={general:PRODUCT_SECTIONS.general.filter(f=>!['description','description_short'].includes(f)),contenido:['description_short','description'],...Object.fromEntries(Object.entries(PRODUCT_SECTIONS).filter(([key])=>key!=='general'))};
  if(!sections[parallelSection])parallelSection='general';
  return '<nav class="prd-parallel-tabs" aria-label="Apartados de ambas fichas">'+Object.keys(sections).map(key=>btn(key==='contenido'?'Contenido':key==='general'?'Datos':sectionTitle(key),'parallel-section','data-pr-section="'+key+'"'+(parallelSection===key?' aria-current="page"':''),pending)).join('')+'</nav><div class="prd-parallel-editors">'+stores.map(shop=>{
   const source=shop===store,target=targetRaw.get(shop),values=targetOverrides.get(shop)||{};
   return '<fieldset><legend>'+h(PRODUCT_STORES.find(s=>s.key===shop).label)+(source?' · origen':' · destino')+'</legend><p class="small">'+(source?'Marca los campos que deseas copiar.':'Completa o adapta los campos del destino. Nada se envía hasta validar y confirmar.')+'</p>'+(!source?'<label class="prd-field"><b>ID de destino existente (opcional)</b><input data-pr-existing-id="'+shop+'" value="'+h(targetIds.get(shop)||'')+'" placeholder="Buscar por referencia si se deja vacío"></label>':'<label class="prd-field"><b>ID de origen</b><input value="'+h(record.id||'Borrador nuevo')+'" disabled></label>')+'<div class="prd-fields-grid">'+sections[parallelSection].map(field=>{
    if(source)return showField(field);
    const value=Object.prototype.hasOwnProperty.call(values,field)?values[field]:fields.has(field)?Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record[field]):textValue(target?.[field]);
    const attrs='data-pr-target-field="'+h(field)+'" data-pr-target-store="'+shop+'"';
    return '<label class="prd-field"><b>'+h(metadata[field]||field)+'</b>'+fieldControl(field,value,attrs)+languagePicker(shop,field)+'</label>';
   }).join('')+'</div></fieldset>';
  }).join('')+'</div>';
 }
 function comparisonPanel(){
  if(!record)return empty('Selecciona una ficha','Primero abre un producto o crea un borrador.');
  return '<section class="card card-pad"><h3>Tiendas de destino</h3><p>Selecciona una o ambas. Cada tienda conserva sus propios ID, categorías, imágenes y atributos.</p><div class="prd-targets">'+PRODUCT_STORES.map(s=>'<label><input type="checkbox" data-pr-target="'+s.key+'" '+(targets.has(s.key)?'checked':'')+'> '+h(s.label)+' '+(ready(s.key)?'':'· sin conexión verificada')+'</label>').join('')+'</div>'+parallelEditors()+'<div class="inline-actions">'+btn('Buscar coincidencias y preparar cambios','compare','',pending||!targets.size)+btn('Descartar propuesta','clear-preview','',pending)+'</div><div class="prd-preview">'+(preview.length?preview.map(plan=>'<section class="prd-plan"><h4>'+h(PRODUCT_STORES.find(s=>s.key===plan.store)?.label)+' · '+(plan.operation==='update'?'Actualizar #'+h(plan.target_id):'Crear producto nuevo')+'</h4><p>'+plan.changes.filter(x=>x.changed).length+' campos cambiados · '+plan.variants.length+' variaciones seleccionadas</p><ul>'+plan.changes.filter(x=>x.changed).map(change=>'<li><b>'+h(metadata[change.field]||change.field)+'</b>: '+h(text(change.before))+' → '+h(text(change.after))+'</li>').join('')+'</ul>'+((preflight.get(plan.store)?.record_id===plan.target_id)?'<p class="prd-api-ok">XML real consultado y campos seleccionados verificados, sin escribir.</p>':'')+btn('Validar contra el XML de la tienda','api-preview','data-pr-dest="'+h(plan.store)+'"',pending||!plan.target_id||!plan.changes.some(c=>c.changed))+plan.variants.filter(v=>v.changes.some(c=>c.changed)).map(v=>'<div class="prd-variant-review"><span>Variación #'+h(v.target_id||'nueva')+' · '+h(v.changes.filter(c=>c.changed).length)+' campos</span>'+((variantPreflight.has(plan.store+'|'+v.target_id))?'<small>XML comprobado</small>':'')+btn('Validar variación','variant-api-preview','data-pr-dest="'+h(plan.store)+'" data-pr-variation="'+h(v.target_id||'')+'"',pending||!v.target_id)+variantSaveControls(plan.store,v.target_id)+'</div>').join('')+plan.warnings.map(w=>'<p class="prd-warning">'+h(w)+'</p>').join('')+(plan.operation==='create'?createWizard.render(plan,record):editControls(plan))+'</section>').join(''):'<p>Sin propuesta calculada. Primero selecciona los campos de la ficha y, si corresponde, de cada combinación.</p>')+'</div><p class="prd-note"><b>El alta base tiene su propia confirmación por tienda.</b> Tras el alta base, completa combinaciones, existencias, precios e imágenes en sus etapas. Las actualizaciones de productos anteriores y los lotes se mantienen separados.</p></section>';
 }
 async function prepareBulk(){
  bulkItems=[];bulkConfirm='';bulkVariantSelection(variants,[...selection],[bulkField]);
  if(!selection.size||!bulkValue.trim())throw Error('Selecciona combinaciones y un valor nuevo.');
  const saved={fields,overrides,variantFields,variantOverrides};
  try{fields=new Set();overrides={};variantFields=new Map();variantOverrides=new Map();
   for(const id of selection){variantFields.set(id,new Set([bulkField]));variantOverrides.set(id,{[bulkField]:productInputValue(bulkField,bulkValue)});}
   await prepare();
   const items=preview.flatMap(plan=>plan.variants.filter(v=>v.changes.some(c=>c.changed)).map(v=>({shop:plan.store,id:v.target_id,parent:plan.target_id,source:v.source_id,changes:v.changes,done:false})));
   if(!items.length)throw Error('No hay diferencias que guardar.');
   if(items.some(item=>!item.id||!item.parent))throw Error('El lote incluye combinaciones inexistentes en destino. Créales primero sus atributos desde el alta individual; no se ha escrito nada.');
   bulkItems=items;bulkConfirm='';
   for(const item of items)await previewVariant(item.shop,item.id);
   status='Lote validado sin escribir: '+items.length+' combinaciones. Revisa cada cambio y confirma.';
  }finally{({fields,overrides,variantFields,variantOverrides}=saved);mode='bulk';}
 }
 async function commitBulk(){
  if(!canEdit()||bulkConfirm!=='GUARDAR LOTE'||!bulkItems.length)throw Error('Valida el lote y escribe GUARDAR LOTE.');
  for(const item of bulkItems){if(item.done)continue;editConfirm.set(item.shop+'|'+item.id,'GUARDAR');await commitVariant(item.shop,item.id);item.done=true;status='Lote: '+bulkItems.filter(row=>row.done).length+' de '+bulkItems.length+' combinaciones verificadas.';render();}
  status='Lote terminado: '+bulkItems.length+' combinaciones guardadas y releídas. No se han modificado las demás.';
 }
 function bulk(){
  return '<section class="card card-pad"><h3>Selección masiva por variación</h3><p>Las combinaciones no se mezclan con el producto principal. Selecciona exactamente las referencias que quieras tratar.</p>'+(!variants.length?empty('Abre un producto con variaciones','Selecciona sus combinaciones y prepara los cambios del lote.'):variants.map(v=>'<label class="prd-bulk-row"><input type="checkbox" data-pr-bulk="'+h(keyFor(v))+'" '+(selection.has(keyFor(v))?'checked':'')+'><span>'+h(text(v.reference)||'Sin referencia')+'</span><small>ID '+h(v.id||'borrador')+'</small></label>').join(''))+'<div class="inline-actions">'+btn('Revisar selección','bulk-preview','',!selection.size)+'</div>'+bulkForm()+'</section>';
 }
 function bulkForm(){
  const options=['price','wholesale_price','weight','minimal_quantity','low_stock_threshold','low_stock_alert'];
  return '<div class="prd-fields-grid"><label class="prd-field"><b>Campo común del lote</b><select data-pr-bulk-field>'+options.map(field=>'<option value="'+field+'" '+(bulkField===field?'selected':'')+'>'+h(metadata[field]||field)+'</option>').join('')+'</select></label><label class="prd-field"><b>Valor nuevo (precios e impactos sin impuestos)</b><input data-pr-bulk-value value="'+h(bulkValue)+'"></label></div>'+btn('Preparar y validar el lote','bulk-prepare','',pending||!selection.size)+'<div class="prd-bulk-results">'+bulkItems.map(item=>'<p><b>'+h(item.shop)+' · combinación #'+h(item.id)+'</b>: '+item.changes.filter(c=>c.changed).map(c=>h(metadata[c.field]||c.field)+': '+h(text(c.before))+' → '+h(text(c.after))).join('; ')+(item.done?' · guardada y verificada':' · pendiente')+'</p>').join('')+'</div>'+(bulkItems.length?'<label class="prd-field">Para guardar escribe GUARDAR LOTE<input data-pr-bulk-confirm value="'+h(bulkConfirm)+'"></label>'+btn('Guardar lote seleccionado','bulk-commit','',pending||!canEdit()||bulkItems.some(item=>!item.done&&!variantPreflight.get(item.shop+'|'+item.id)?.can_commit)):'')+'<p class="prd-note">Cada combinación tiene su solicitud y comprobación. Ante un fallo el lote se detiene, conserva las completadas y permite comprobar la pendiente sin repetirla. No es una transacción única entre tiendas.</p>';
 }
 function render(){
  if(!current())return;
  const opened=[...root.querySelectorAll('.prd-variant[open]')].map(el=>el.dataset.prVariant);
  root.innerHTML='<div class="prd-shell"><header class="prd-intro"><div><span class="eyebrow">Centro independiente PrestaShop</span><h2>Productos</h2><p>Fichas completas, variaciones y transferencias selectivas entre Hortimatic y NewOldSmok.</p></div><label>Tienda de origen<select data-pr-store>'+PRODUCT_STORES.map(s=>'<option value="'+s.key+'" '+(store===s.key?'selected':'')+'>'+h(s.label)+'</option>').join('')+'</select></label></header><p role="status" class="prd-status">'+h(status)+'</p>'+(mode==='comparar'?'':shopCards())+'<nav class="prd-tabs" aria-label="Secciones de Productos">'+MODES.map(([id,label])=>btn(label,'mode','data-mode="'+id+'"'+(mode===id?' aria-current="page"':''),pending)).join('')+'</nav><div class="prd-body">'+(mode==='catalogo'?catalog():mode==='ficha'?editor():mode==='variantes'?variantsPanel():mode==='comparar'?comparisonPanel():mode==='encargo'?renderProductRequestForm(requestBrief,requestOutput):bulk())+'</div></div>';
  for(const detail of root.querySelectorAll('.prd-variant'))if(opened.includes(detail.dataset.prVariant))detail.open=true;
  if(pending)for(const el of root.querySelectorAll('button,input,select,textarea'))el.disabled=true;
  persistDraft();
 }
 async function invokeShop(shop,action,args){
  if(!current())throw Error('La sesión ha cambiado.');
  const generation=epoch;
  const c=connection(shop);if(!ready(shop))throw Error('Comprueba la conexión de '+shop+' antes de consultar.');
  if(action.endsWith('_commit')){persistDraft();await storageQueue;if(storageError)throw Error('No se ha podido conservar la solicitud local. No se ha enviado a la tienda.');if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');}
  const r=await invoke({action,store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),...args});
  if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');
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
  const list=[];
  for(const id of ids){const item=await loadItem(shop,'combinations',id);
   if(String(item.id_product)!==String(product.id))throw Error('Combinación asociada a otro producto.');
   list.push(item);
  }
  return list;
 }
 async function work(fn){
  if(pending||!current())return;
  const generation=epoch;
  pending=true;render();
  try{await fn();}catch(e){if(current()&&epoch===generation)status=e?.message||String(e);}
  finally{if(epoch===generation){pending=false;if(current())render();}}
 }
 async function loadCatalog(more){
  if(!more){rows=[];page=0;hasMore=false;listPage=0;}
  const r=await invokeShop(store,'prestashop_read',{resource:'products',page,page_size:100,sort:'newest'});
  if(r.resource!=='products'||r.page!==page||!Array.isArray(r.rows))throw Error('Listado no verificable.');
  const ids=new Set(rows.map(x=>String(x.id)));
  for(const p of r.rows){if(ids.has(String(p.id)))throw Error('Producto duplicado entre páginas.');ids.add(String(p.id));rows.push(p);}
  hasMore=!!r.possibly_more;page++;status='Catálogo de '+store+': '+rows.length+' productos consultados'+(hasMore?' (parcial).':'.');
 }
 async function openProduct(id){
  resetDraft();record=normalizedProduct(await loadItem(store,'products',id)).raw;
  shopRecords.clear();shopRecords.set(store,record);
  variants=await combinations(store,record);
  mode='comparar';targets=new Set(PRODUCT_STORES.map(s=>s.key).filter(s=>s!==store));status='Ficha #'+id+' y '+variants.length+' combinaciones leídas de '+store+'. Selecciona campos para preparar cambios.';
 }
 function freshProduct(){
  resetDraft();record={...Object.fromEntries(Object.values(PRODUCT_SECTIONS).flat().map(field=>[field,''])),id:null,active:'0',minimal_quantity:'1',available_for_order:'1',show_price:'1',online_only:'0',on_sale:'0',visibility:'both',condition:'new'};
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
  for(const [shop,item] of readTargets)shopRecords.set(shop,item);
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
   changes:requested.map(c=>({field:c.field,value:productInputValue(c.field,String(c.after)),...(localized.has(c.field)?{language_id:targetLanguages.get(dest)[c.field]}:{})}))});
  if(response.persisted!==false||response.record_id!==plan.target_id||!/^[a-f0-9]{64}$/.test(response.fingerprint||''))throw Error('La preparación del servidor no es verificable.');
  preflight.set(dest,{record_id:plan.target_id,fingerprint:response.fingerprint,changes:response.changes.map(({field,value,language_id})=>({field,value,...(language_id?{language_id}:{})})),can_commit:response.can_commit===true,request_id:crypto.randomUUID(),fields:response.changes.map(c=>c.field)});
  status='XML del producto validado para '+dest+': '+response.changes.length+' campos. Las variaciones se comprueban aparte. Sin guardado.';
 }
 async function previewVariant(dest,id){
  const plan=comparison.get(dest),variant=plan?.variants.find(v=>v.target_id===id);
  if(!variant)throw Error('No existe una variación de destino seleccionada.');
  const changes=variant.changes.filter(c=>c.changed);
  if(!changes.length)throw Error('No hay cambios para comprobar en esta variación.');
  if(changes.some(c=>!PRODUCT_WRITE_FIELDS.combinations.includes(c.field)||typeof c.after!=='string'&&typeof c.after!=='number'))throw Error('Hay campos de variante sin contrato de escritura validado.');
  const result=await invokeShop(dest,'prestashop_product_prepare',{resource:'combinations',record_id:id,expected_product_id:plan.target_id,changes:changes.map(c=>({field:c.field,value:productInputValue(c.field,String(c.after))}))});
  if(result.persisted!==false||result.record_id!==id||!/^[a-f0-9]{64}$/.test(result.fingerprint||''))throw Error('La validación XML de la variación no es verificable.');
  variantPreflight.set(dest+'|'+id,{fingerprint:result.fingerprint,changes:changes.map(c=>({field:c.field,value:productInputValue(c.field,String(c.after))})),can_commit:result.can_commit===true,request_id:crypto.randomUUID(),fields:changes.map(c=>c.field)});
  status='Variación #'+id+' de '+dest+' comprobada sin escribir. Pendiente de verificar atributos antes de guardar.';
 }
 function newVariant(){
  if(!record)throw Error('Crea o abre una ficha primero.');
  const item={draft_key:'draft-'+crypto.randomUUID(),reference:'',price:'',weight:'',ean13:'',minimal_quantity:'1',associations:{product_option_values:[]}};
  variants.push(item);variantFields.set(keyFor(item),new Set(['reference','price','minimal_quantity']));status='Variación de borrador añadida. Sus atributos requerirán correspondencia en destino.';
 }
 async function mount(node){
  dispose();storageReady=false;root=node;owner=actor();const gen=++epoch;root.dataset.prEpoch=String(gen);mode='catalogo';store='hortimatic';status='Comprobando conexiones. Ningún dato se modifica.';rows=[];page=0;hasMore=false;resetDraft();
  if(!allowed()){root.textContent='No tienes permiso de consulta de PrestaShop.';return;}
  root.oninput=e=>{if(e.target.matches('[data-pr-search]')){query=e.target.value;listPage=0;render();const f=root.querySelector('[data-pr-search]');f?.focus();f?.setSelectionRange(query.length,query.length);}};
  root.onchange=e=>{
   if(e.target.matches('[data-pr-request]')){requestBrief[e.target.dataset.prRequest]=e.target.value;requestOutput='';if(['operation','store'].includes(e.target.dataset.prRequest))render();return;}
   if(e.target.matches('[data-pr-price-option]')){priceOptions[e.target.dataset.prPriceOption]=e.target.value;render();return;}
   if(pending||!current())return;
   if(e.target.matches('[data-pr-bulk-field]')){bulkField=e.target.value;bulkItems=[];bulkConfirm='';render();return;}
   if(e.target.matches('[data-pr-bulk-value]')){bulkValue=e.target.value;bulkItems=[];bulkConfirm='';persistDraft();return;}
   if(e.target.matches('[data-pr-bulk-confirm]')){bulkConfirm=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-edit-confirm]')){editConfirm.set(e.target.dataset.prEditConfirm,e.target.value);return;}
   if(e.target.matches('[data-pr-stage-file]')){const input={files:Array.from(e.target.files||[]),dataset:{...e.target.dataset}};void work(async()=>{status=await createWizard.handleFile(input);});return;}
   if(e.target.matches('[data-pr-page-size]')){listSize=Number(e.target.value);listPage=0;render();return;}
   if(createWizard.handleChange(e.target)){render();return;}
   if(e.target.matches('[data-pr-store]')){store=e.target.value;rows=[];page=0;hasMore=false;query='';resetDraft();status='Tienda de origen: '+store+'.';render();return;}
   if(e.target.matches('[data-pr-target]')){e.target.checked?targets.add(e.target.dataset.prTarget):targets.delete(e.target.dataset.prTarget);invalidate();render();return;}
   if(e.target.matches('[data-pr-field]')){const field=e.target.dataset.prField;e.target.checked?fields.add(field):fields.delete(field);if(!e.target.checked){delete overrides[field];for(const values of targetOverrides.values())delete values[field];}invalidate();render();return;}
   if(e.target.matches('[data-pr-value]')){overrides[e.target.dataset.prValue]=e.target.value;invalidate();if(['price','wholesale_price'].includes(e.target.dataset.prValue))render();return;}
   if(e.target.matches('[data-pr-existing-id]')){targetIds.set(e.target.dataset.prExistingId,e.target.value);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-target-field]')){const dest=e.target.dataset.prTargetStore,field=e.target.dataset.prTargetField,values=targetOverrides.get(dest)||{};targets.add(dest);fields.add(field);values[field]=e.target.value;targetOverrides.set(dest,values);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-lang-store]')){const dest=e.target.dataset.prLangStore,field=e.target.dataset.prLangField,values=targetLanguages.get(dest)||{};values[field]=e.target.value;targetLanguages.set(dest,values);preflight.clear();persistDraft();return;}
   if(e.target.matches('[data-pr-vfield]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVfield,set=variantFields.get(id)||new Set();e.target.checked?set.add(field):set.delete(field);variantFields.set(id,set);invalidate();render();return;}
   if(e.target.matches('[data-pr-vvalue]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVvalue,values=variantOverrides.get(id)||{};values[field]=e.target.value;variantOverrides.set(id,values);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-bulk]')){e.target.checked?selection.add(e.target.dataset.prBulk):selection.delete(e.target.dataset.prBulk);bulkItems=[];bulkConfirm='';render();}
  };
  root.onclick=e=>{const b=e.target.closest('[data-pr-action]');if(!b||!current())return;const a=b.dataset.prAction;
   if(a==='shop-open'){void work(async()=>{const shop=b.dataset.prShop,item=shopRecords.get(shop);if(!item)throw Error('Comprueba primero la correspondencia.');store=shop;await openProduct(item.id);});return;}
   if(a==='shop-check'){void work(async()=>{const shop=b.dataset.prShop;if(!record?.id){store=shop;rows=[];mode='catalogo';return;}const ref=textValue(record.reference);if(!ref.trim())throw Error('Falta referencia para comprobar la otra tienda.');const response=await invokeShop(shop,'prestashop_read',{resource:'products',references:[ref],page:0,page_size:100,sort:'oldest'});if(response.possibly_more)throw Error('Correspondencias incompletas.');const match=matchExactReference(response.rows,ref);if(match.status==='ambiguous')throw Error('Referencia duplicada; selecciona una ficha exacta.');if(match.product)shopRecords.set(shop,await loadItem(shop,'products',match.product.id));else shopRecords.delete(shop);status=match.product?'Ficha encontrada en '+shop+'.':'No existe esa referencia en '+shop+'. Puedes preparar su copia.';});return;}
   if(a==='shop-copy'){void work(async()=>{const shop=b.dataset.prShop;targets=new Set([shop]);const sourceName=PRODUCT_STORES.find(s=>s.key===store).label,destName=PRODUCT_STORES.find(s=>s.key===shop).label;const adapted=targetOverrides.get(shop)||{};for(const field of ['meta_title','meta_description','meta_keywords'])adapted[field]=textValue(record[field]).replaceAll(sourceName,destName);targetOverrides.set(shop,adapted);invalidate();mode='comparar';if(fields.size)await prepare();status='Copia selectiva preparada para '+destName+'. Revisa SEO, enlaces y relaciones; categorías y atributos se eligen en destino. Aún no se ha escrito nada.';});return;}
   if(a.startsWith('create-')){void work(async()=>{const plan=comparison.get(b.dataset.prDest);status=await createWizard.perform(a,b.dataset.prDest,plan,record,{row:b.dataset.prStageRow,tab:b.dataset.prStageTab,kind:b.dataset.prStageKind});});return;}
   if(a==='parallel-section'){parallelSection=b.dataset.prSection;render();return;}
   if(a==='mode'){mode=b.dataset.mode;render();return;}
   if(a==='request-build'){try{requestOutput=buildProductRequest(requestBrief);status='Encargo preparado. Revísalo y cópialo a tu chat con los archivos que quieras aportar.';}catch(error){status=error.message;}render();return;}
   if(a==='request-copy'){void work(async()=>{if(!requestOutput)throw Error('Prepara primero el encargo.');await navigator.clipboard.writeText(requestOutput);status='Petición copiada para pegar en ChatGPT.';});return;}
   if(a==='new-product'){freshProduct();render();return;}
   if(a==='new-variant'){newVariant();render();return;}
   if(a==='clear-preview'){invalidate();status='Propuesta descartada; la ficha original sigue cargada.';render();return;}
   if(a==='bulk-prepare'){void work(prepareBulk);return;}
   if(a==='bulk-commit'){void work(commitBulk);return;}
   if(a==='bulk-preview'){try{bulkVariantSelection(variants,[...selection],['reference']);status='Selección comprobada: '+selection.size+' variaciones distintas. Elige el campo y valor antes de validar el lote.';}catch(error){status=error.message;}render();return;}
   if(a==='catalog-prev'){listPage=Math.max(0,listPage-1);render();return;}
   if(a==='catalog-next'){void work(async()=>{if((listPage+1)*listSize>=rows.length&&hasMore)await loadCatalog(true);listPage++;});return;}
   if(a==='catalog-load')void work(()=>loadCatalog(false));
   if(a==='catalog-more')void work(()=>loadCatalog(true));
   if(a==='open-product')void work(()=>openProduct(b.dataset.id));
   if(a==='compare')void work(prepare);
   if(a==='variant-edit-commit')void work(()=>commitVariant(b.dataset.prDest,b.dataset.prVariation));
   if(a==='edit-commit')void work(()=>commitEdit(b.dataset.prDest));
   if(a==='api-preview')void work(()=>previewXml(b.dataset.prDest));
   if(a==='variant-api-preview')void work(()=>previewVariant(b.dataset.prDest,b.dataset.prVariation));
  };
  render();
  try{const response=await rpc('totus_prestashop_context',{});if(!current()||epoch!==gen)return;connections=response?.connections||[];status='Conexiones consultadas. Selecciona la tienda y carga el catálogo.';}
  catch(e){if(current()&&epoch===gen)status='No se han podido comprobar las conexiones: '+(e.message||'error');}
  if(current()&&epoch===gen){try{await storageQueue;const saved=await productDraftStore(owner);if(current()&&epoch===gen&&restoreDraft(saved))status='Borrador recuperado de esta cuenta. Comprueba las operaciones enviadas antes de repetir un guardado.';}catch{}storageReady=true;render();}
 }
 function hasDraft(){return !!record&&(fields.size>0||[...variantFields.values()].some(s=>s.size>0));}
 function discardDraft(){resetDraft();status='Propuesta descartada.';if(current())render();}
 function dispose(){persistDraft();storageReady=false;if(root){root.onclick=null;root.onchange=null;root.oninput=null;}root=null;owner=null;++epoch;pending=false;}
 return {mount,dispose,hasDraft,discardDraft,stateSnapshot};
}
