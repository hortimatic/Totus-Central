import {normalizeProductImage} from './productos-image-editor.js';
import {productCategoryPicker,featureValueSelectors,attributeGroupSelectors} from './productos-relations-ui.js';
import {openTableViewProfiles} from './table-view-profiles.js';
import {createAttributesWorkspace} from './productos-attributes-workspace.js';
import {openProductMasters} from './productos-masters-ui.js';
import {openProductQuickEdit} from './productos-quick-edit-ui.js';
import {productBackofficeUrl,saveBackofficeLink} from './productos-backoffice.js';
import {attachProductTableLayout} from './productos-table-layout.js';
import {adaptProductTexts} from './productos-copy-text.js';
import {showProductDialog} from './productos-dialogs.js';
import {attachProductPhotoPreviews} from './productos-photo-preview.js';
import {enhanceProductSelects} from './productos-controls.js';
import {createProductTableEditor} from './productos-table-editor.js';
import {productGallery,moveProductPhoto,productGalleryDescription} from './productos-gallery.js';
import {productDraftFacts} from './productos-drafts.js';
import {productCountryTaxRate,productDisplayAmounts,productPriceForMargin,productPurchaseAmounts} from './productos-tax.js';
import {stitchHeader,stitchCatalog,stitchFiche,stitchCopy,stitchRequest,stitchSaved,ensureStitchProductFonts} from './productos-stitch-view.js';
import {PRODUCT_COLUMNS,DEFAULT_PRODUCT_COLUMNS,productColumns,productColumnWidths,moveProductColumn,catalogProductKey,productPhoto,filterProductCatalog,productCatalogCsv} from './productos-catalog.js';
import {buildProductRequest,renderProductRequestForm} from './productos-request.js';
import {PRODUCT_STORES,PRODUCT_SECTIONS,VARIANT_FIELDS,textValue,productInputValue,associationIds,normalizedProduct,matchExactReference,buildProductPlan,bulkVariantSelection,productCopyRedirect,matchVariantInStore} from './productos-core.js';
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
const metadata={name:'Nombre',reference:'Referencia',description_short:'Descripción breve',description:'Descripción completa',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',link_rewrite:'URL amigable',price:'Precio',wholesale_price:'Coste',ean13:'EAN',weight:'Peso',id_tax_rules_group:'Regla de impuestos',active:'Activo',visibility:'Visibilidad',isbn:'ISBN',upc:'UPC',mpn:'Referencia del fabricante',condition:'Estado del producto',available_for_order:'Disponible para pedidos',show_price:'Mostrar precio',online_only:'Solo venta online',unit_price_ratio:'Relación precio base / precio unitario',unity:'Unidad de medida',on_sale:'En oferta',ecotax:'Ecotasa',redirect_type:'Tipo de redirección',id_type_redirected:'Destino de redirección',width:'Anchura',height:'Altura',depth:'Profundidad',additional_shipping_cost:'Suplemento de envío',minimal_quantity:'Cantidad mínima',available_date:'Fecha de disponibilidad',location:'Ubicación',low_stock_threshold:'Umbral de pocas existencias',low_stock_alert:'Aviso de pocas existencias',out_of_stock:'Pedidos sin existencias',show_condition:'Mostrar condición',additional_delivery_times:'Tipo de plazo de entrega',delivery_in_stock:'Plazo con existencias',delivery_out_stock:'Plazo sin existencias',available_now:'Etiqueta con existencias',available_later:'Etiqueta sin existencias'};
const text=(v,max=140)=>{const s=textValue(v);return s.length>max?s.slice(0,max)+'…':s;};
const keyFor=(item)=>String(item?.id||item?.draft_key||'');
const validReference=s=>typeof s==='string'&&s.trim().length>0;
export function createProductosUI({rpc,invoke,actor,allowed,canEdit=()=>false,canCreate=canEdit,canDelete=canEdit,canExport=canEdit,tableLayout=null}){
 const draftsByShop=new Map(),draftsByProduct=new Map(),attributeNames=new Map(),attributeValues=new Map(),attributeGroups=new Map(),productLanguages=new Map();
 let draftPhotos=[],publicationScope='all',requestedProduct=null;
 let organization=null,galleryDraft={},inlineStage=false,directLanguage='',operationHistory=[];
 let copyQueue=[],catalogViews=[],catalogViewName='';
 let requestBrief={operation:'url',store:'hortimatic'},requestOutput='',requestOwner=null;
 let storageReady=false,storageQueue=Promise.resolve(),storageError=null;
 let priceOptions={vat:'21',re:'5.2',discount:'0'};
 let catalogScope='hortimatic',catalogMore=new Map(),catalogMeta=new Map();
 let catalogTaxContext={countries:[],rules:[],taxes:[]};
 const catalogKey=p=>catalogProductKey(p,store);
 let catalogColumns=[...DEFAULT_PRODUCT_COLUMNS],catalogSelected=new Set(),catalogFilters={category:'',brand:'',active:''},catalogCategories=[],catalogBrands=[],catalogStock=new Map(),editorSection='general';
 let productPickerQuery='',productPickerPage=0;
 let catalogCancel=false;let listSize=20,listPage=0,parallelSection='general',bulkField='price',bulkValue='',bulkItems=[],bulkConfirm='';
 let photoCleanup=()=>{},controlsCleanup=()=>{},layoutCleanup=()=>{};let columnWidths={},layoutSaveState='',layoutQueue=Promise.resolve(),layoutVersion=0,replacingDOM=false,renderAfterResize=false;
 let root=null,owner=null,epoch=0,mode='catalogo',store='hortimatic',pending=false,status='Selecciona una tienda y consulta su catálogo.',connections=[],rows=[],hasMore=false,page=0,query='',record=null,variants=[],fields=new Set(),overrides={},variantFields=new Map(),variantOverrides=new Map(),targets=new Set(['newoldsmok']),comparison=new Map(),preview=[],selection=new Set(),targetOverrides=new Map(),preflight=new Map(),targetRaw=new Map(),targetLanguages=new Map(),targetIds=new Map(),variantPreflight=new Map();
 const connection=shop=>storeConnection(connections,shop);
 const catalogCache=new Map();let cacheOwner=null;
 const creationMetadata=new Map();
 const shopRecords=new Map(),editRequests=new Map(),editConfirm=new Map();
 const ready=shop=>{const c=connection(shop);return !!c&&c.enabled&&c.configured&&c.verified_revision===c.revision&&c.real_data_authorized===true;};
 const current=()=>!!root?.isConnected&&owner===actor()&&allowed()&&root.dataset.prEpoch===String(epoch);
 const stateSnapshot=()=>({store,mode,record:record?.id||null});
 const tableEditor=createProductTableEditor({invoke:(shop,action,args)=>invokeShop(shop,action,args),canEdit,onSaved:(shop,item)=>{operationHistory.push({shop,kind:'Edición rápida',id:String(item.id),parent_id:String(item.id),at:new Date().toISOString(),request:tableEditor.rows.get(shop+'|'+item.id)?.request?.request_id||'',changes:tableEditor.rows.get(shop+'|'+item.id)?.prepared?.review||[]});const i=rows.findIndex(p=>catalogKey(p)===shop+'|'+item.id);if(i>=0)rows[i]={...item,__store:shop};if(store===shop&&String(record?.id)===String(item.id)){record=item;shopRecords.set(shop,item);}}});
 const createWizard=createProductWizard({invoke:(shop,action,args)=>invokeShop(shop,action,args),canEdit:()=>canEdit()||canCreate()||canDelete(),onProgress:async message=>{status=message;persistDraft();await storageQueue;if(storageError)throw storageError;if(current())render();}});
 const snapshotDraft=()=>({savedAt:Date.now(),draftPhotos,publicationScope,operationHistory,inlineStage,directLanguage,tableEdits:tableEditor.snapshot(),organization,galleryDraft,copyQueue,requestBrief,requestOutput,editorSection,catalogScope,store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight,shops:shopRecords,editRequests,editConfirm,wizard:createWizard.snapshot()});
 const persistDraft=()=>{if(!storageReady||!owner)return;const key=owner,value=record||tableEditor.rows.size||(requestBrief.url||requestBrief.product_id)||draftsByShop.size||draftsByProduct.size||copyQueue.length?structuredClone({...snapshotDraft(),shopDrafts:[...draftsByShop],productDrafts:[...draftsByProduct]}):null;storageError=null;storageQueue=storageQueue.catch(()=>{}).then(()=>productDraftStore(key,value)).catch(error=>{storageError=error||Error('Borrador local no disponible');if(current())status='No se ha podido conservar el borrador local. No cierres esta pestaña hasta comprobar las operaciones pendientes.';});};
 function restoreDraft(d,{restoreTable=false}={}){
  if(!d||!PRODUCT_STORES.some(s=>s.key===d.store)||!d.record&&!d.requestBrief?.url&&!d.requestBrief?.product_id&&!d.tableEdits?.length&&!d.shopDrafts?.length&&!d.productDrafts?.length&&!d.copyQueue?.length)return false;
  if(Array.isArray(d.productDrafts)){draftsByProduct.clear();for(const [key,value]of d.productDrafts)draftsByProduct.set(key,value);}
  copyQueue=Array.isArray(d.copyQueue)?d.copyQueue:copyQueue;
  if(Array.isArray(d.shopDrafts)){draftsByShop.clear();for(const [shop,value]of d.shopDrafts)if(PRODUCT_STORES.some(s=>s.key===shop))draftsByShop.set(shop,value);}
  requestBrief=d.requestBrief||requestBrief;requestOutput=d.requestOutput||'';editorSection=d.editorSection||'general';catalogScope=d.catalogScope||d.store;
  operationHistory=Array.isArray(d.operationHistory)?d.operationHistory:[];inlineStage=d.inlineStage===true;directLanguage=d.directLanguage||'';
  if(restoreTable)tableEditor.restore(d.tableEdits||[]);organization=d.organization||null;galleryDraft=d.galleryDraft||{};
  draftPhotos=d.draftPhotos||[];publicationScope=d.publicationScope||'all';
  ({store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight}=d);
  for(const [map,values] of [[shopRecords,d.shops],[editRequests,d.editRequests],[editConfirm,d.editConfirm]]){map.clear();for(const [key,value] of values||[])map.set(key,value);}
  createWizard.restore(d.wizard);return true;
 }
 const invalidate=()=>{for(const [shop,item]of targetRaw)if(item.__copyCompleted){delete item.__copyCompleted;createWizard.forgetCompleted(shop);comparison.delete(shop);}const retained=new Set([...comparison.keys()].filter(shop=>createWizard.hasAttempted(shop)||createWizard.result(shop)));preview=preview.filter(plan=>retained.has(plan.store));for(const shop of comparison.keys())if(!retained.has(shop))comparison.delete(shop);preflight.clear();variantPreflight.clear();createWizard.invalidate();};
 function syncWizardTextControls(el){
  const scope=el.closest('.prd-creation');if(!scope)return;
  const shop=el.dataset.prCreateStore||el.dataset.prCreateConfirm||el.dataset.prCreateRetryConfirm||scope.querySelector('[data-pr-dest]')?.dataset.prDest,plan=comparison.get(shop);if(!plan)return;
  const key=button=>JSON.stringify(['prAction','prDest','prStageRow','prStageTab','prStageKind'].map(name=>button.dataset[name]||''));
  const template=document.createElement('template');template.innerHTML=createWizard.render(plan,{...record,__sourceStore:store});
  const controls=new Map([...template.content.querySelectorAll('button[data-pr-action]')].map(button=>[key(button),button]));
  for(const button of scope.querySelectorAll('button[data-pr-action]')){const next=controls.get(key(button));button.disabled=pending||!next||next.disabled;}
  if(!el.matches('[data-pr-create-confirm],[data-pr-create-retry-confirm],[data-pr-stage-remove-confirm]')){
   scope.querySelectorAll('.prd-api-ok').forEach(note=>note.remove());
   if(!template.content.querySelector('.prd-create-confirm'))scope.querySelector('.prd-create-confirm')?.setAttribute('hidden','');
  }
  persistDraft();
 }
 function resetDraft(){
  organization=null;galleryDraft={};draftPhotos=[];publicationScope='all';inlineStage=false;directLanguage='';operationHistory=[];shopRecords.clear();editRequests.clear();editConfirm.clear();bulkItems=[];bulkConfirm='';record=null;variants=[];fields=new Set();overrides={};variantFields.clear();variantOverrides.clear();selection.clear();targetOverrides.clear();targetRaw.clear();targetLanguages.clear();targetIds.clear();createWizard.reset();invalidate();
 }
 function sectionTitle(section){return ({general:'Información y descripción',precios:'Precios e impuestos',seo:'SEO',transporte:'Transporte',inventario:'Disponibilidad',organizacion:'Organización'})[section]||section;}
 function fieldControl(field,value,attrs,disabled=false){
  const enums={redirect_type:[['404','Sin redirección (404)'],['301-product','Producto · permanente (301)'],['302-product','Producto · temporal (302)'],['301-category','Categoría · permanente (301)'],['302-category','Categoría · temporal (302)']],active:[['0','Inactivo'],['1','Activo']],available_for_order:[['0','No permitir compra'],['1','Permitir compra']],show_price:[['0','Ocultar precio'],['1','Mostrar precio']],online_only:[['0','No'],['1','Sí']],on_sale:[['0','No'],['1','Sí']],show_condition:[['0','No'],['1','Sí']],low_stock_alert:[['0','No'],['1','Sí']],visibility:[['both','Catálogo y búsqueda'],['catalog','Solo catálogo'],['search','Solo búsqueda'],['none','Oculto']],condition:[['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']],additional_delivery_times:[['0','Sin plazo'],['1','Plazo general'],['2','Plazo específico']],out_of_stock:[['0','Denegar pedidos'],['1','Permitir pedidos'],['2','Preferencia de la tienda']]};
  const locked=disabled?' disabled':'';
  if(enums[field])return '<select '+attrs+locked+'><option value="">Sin indicar</option>'+enums[field].map(([id,label])=>'<option value="'+id+'" '+(String(value)===id?'selected':'')+'>'+label+'</option>').join('')+'</select>';
  return ['description','description_short','meta_description'].includes(field)?'<textarea '+attrs+' rows="4"'+locked+'>'+h(value)+'</textarea>':'<input '+attrs+' value="'+h(value)+'"'+locked+'>';
 }
 function showField(field,selectable=true){
  const value=Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record?.[field]);
  return '<label class="prd-field"><span>'+(selectable?'<input type="checkbox" data-pr-field="'+h(field)+'" '+(fields.has(field)?'checked':'')+'>':'')+'<b>'+h(metadata[field]||field)+'</b>'+fieldHelp(metadata[field]||field,'Selecciona este campo para incluirlo en la propuesta. Precio y coste se expresan sin impuestos; las categorías y relaciones se verifican en la tienda de destino.')+'</span>'+fieldControl(field,value,'data-pr-value="'+h(field)+'"',selectable&&!fields.has(field))+'</label>';
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

 function catalogValue(p,key){
  const money=v=>v===undefined||v===null||v===''?'—':new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(Number(v));
  if(key==='creator')return creationMetadata.has(catalogKey(p))?creationMetadata.get(catalogKey(p))||'No registrado':'Sin consultar';
  if(key==='date_add'||key==='date_upd'){const v=textValue(p[key]),m=v.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})/);return m?m[3]+'/'+m[2]+'/'+m[1]+' '+m[4]:'No registrada';}
  if(key==='brand')return textValue((catalogMeta.get(p.__store||store)?.brands||catalogBrands).find(x=>String(x.id)===String(p.id_manufacturer))?.name)||(p.id_manufacturer&&p.id_manufacturer!=='0'?'Marca #'+p.id_manufacturer:'—');
  if(key==='supplier')return textValue((catalogMeta.get(p.__store||store)?.suppliers||[]).find(x=>String(x.id)===String(p.id_supplier))?.name)||(p.id_supplier&&p.id_supplier!=='0'?'Proveedor #'+p.id_supplier:'—');
  if(key==='category')return textValue((catalogMeta.get(p.__store||store)?.categories||catalogCategories).find(x=>String(x.id)===String(p.id_category_default))?.name)||(p.id_category_default?'Categoría #'+p.id_category_default:'—');
  if(key==='store')return PRODUCT_STORES.find(s=>s.key===(p.__store||store)).label;
  if(key==='gross'||key==='margin'){const a=productDisplayAmounts(p,productCountryTaxRate(p.id_tax_rules_group,catalogMeta.get(p.__store||store)?.tax||catalogTaxContext));return key==='gross'?(a.gross===null?'Sin verificar':money(a.gross)):(a.marginPct===null?'—':a.marginPct.toFixed(1)+' %');}
  if(key==='marginTotal'){const rate=productCountryTaxRate(p.id_tax_rules_group,catalogMeta.get(p.__store||store)?.tax||catalogTaxContext),purchase=productPurchaseAmounts(p.wholesale_price,rate,priceOptions.re),sale=productDisplayAmounts(p,rate);return purchase.total===null||sale.gross===null?'Sin verificar':money(sale.gross-purchase.total);}
  if(key==='costVat'||key==='costTotal'){const rate=productCountryTaxRate(p.id_tax_rules_group,catalogMeta.get(p.__store||store)?.tax||catalogTaxContext),a=productPurchaseAmounts(p.wholesale_price,rate,priceOptions.re);return a[key==='costVat'?'withVat':'total']===null?'Sin verificar':money(a[key==='costVat'?'withVat':'total']);}
  if(key==='cost')return money(p.wholesale_price);if(key==='price')return money(p.price);
  if(key==='variants')return associationIds(p,'combinations').length;
  if(key==='stock')return catalogStock.has(catalogKey(p))?catalogStock.get(catalogKey(p)):'Sin consultar';
  if(key==='active')return String(p.active)==='1'?'Activo':'Inactivo';
  return textValue(p[key])||'—';
 }
 function visibleCatalog(){return filterProductCatalog(rows,{query,...catalogFilters});}
 function saveCatalogPreferences(){++layoutVersion;const key=owner,snapshot={columns:[...catalogColumns],widths:{...columnWidths},views:structuredClone(catalogViews),viewName:catalogViewName};try{localStorage.setItem('totus-products-columns:'+key,JSON.stringify(catalogColumns));localStorage.setItem('totus-products-widths:'+key,JSON.stringify(columnWidths));localStorage.setItem('totus-products-views:'+key,JSON.stringify(catalogViews));layoutSaveState='Guardado en este equipo.';}catch{layoutSaveState='No se pudo guardar en este equipo.';}if(tableLayout){layoutSaveState='Guardando en tu cuenta…';layoutQueue=layoutQueue.catch(()=>{}).then(async()=>{if(actor()!==key)return;await tableLayout.save(snapshot,key);if(actor()===key){layoutSaveState='Guardado automáticamente en tu cuenta.';const label=root?.querySelector('[data-pr-layout-status]');if(label)label.textContent=layoutSaveState;}}).catch(()=>{if(actor()===key){layoutSaveState='Guardado local. Sincronización pendiente: pulsa Guardar distribución.';const label=root?.querySelector('[data-pr-layout-status]');if(label)label.textContent=layoutSaveState;}});}}
 function moveCatalogColumn(key,index){catalogColumns=moveProductColumn(catalogColumns,key,index);saveCatalogPreferences();render();}

 function savedDraftCards(){const saved=new Map(draftsByProduct);if(record)saved.set(store+'|'+(record.id||record.draft_key||'new'),snapshotDraft());return [...saved].map(([key,d])=>({key,shop:PRODUCT_STORES.find(s=>s.key===d.store)?.label||d.store,id:d.record?.id||'',name:textValue(d.overrides?.name??d.record?.name),reference:textValue(d.overrides?.reference??d.record?.reference),changes:d.fields?.size||0,...productDraftFacts(d)}));}
 function catalog(){
  const filtered=visibleCatalog(),pages=Math.max(1,Math.ceil(filtered.length/listSize));listPage=Math.min(listPage,pages-1);
  const visibleIds=new Set(filtered.map(catalogKey));
  const metaOptions=kind=>catalogScope==='both'?PRODUCT_STORES.flatMap(shop=>(catalogMeta.get(shop.key)?.[kind]||[]).map(r=>[shop.key+'|'+r.id,shop.label+' · '+textValue(r.name)])):(kind==='brands'?catalogBrands:catalogCategories).map(r=>[r.id,textValue(r.name)]);
  return stitchCatalog({backendLink:p=>productBackofficeUrl(p,p.__store||store,owner),canDelete:canDelete(),canCreate:canCreate(),canExport:canExport(),canEdit:canEdit(),activeKey:record?.id?store+'|'+record.id:'',tableEdits:tableEditor.rows,purchaseSurcharge:priceOptions.re,views:catalogViews,viewName:catalogViewName,columnWidths,layoutStatus:layoutSaveState,store:catalogScope,rows:rows.map(p=>({...p,__visible:visibleIds.has(catalogKey(p))})),columns:catalogColumns,selected:catalogSelected,query,filters:catalogFilters,brands:metaOptions('brands'),categories:metaOptions('categories'),page:listPage,size:listSize,hasMore,pending,ready:catalogScope==='both'?PRODUCT_STORES.every(s=>ready(s.key)):ready(store),value:catalogValue,photo:p=>photo(p,p.__store||store),rowKey:catalogKey});
 }

 function photo(p,shop,large=false){const url=productPhoto(p,shop);return url?'<img class="'+(large?'prd-product-photo':'prd-thumb')+'" src="'+h(url)+'" alt="'+h(text(p?.name)||'Producto')+'" loading="lazy">':'<span class="'+(large?'prd-product-photo':'prd-thumb')+' prd-no-photo" aria-label="Sin imagen">Sin imagen</span>';}

 function rawPanel(){
  if(!organization?.catalog?.product_features||organization.store!==store||organization.id!==String(record.id))return '<button type="button" data-pr-action="organization-load" class="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md">Editar categorías, marca, proveedor e impuestos</button>';
  const c=organization.catalog;
  const select=(key,title,rows)=>'<label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">'+h(title)+fieldHelp(title,'Selecciona el registro real de esta tienda y guarda los cambios de organización para sincronizarlo.')+'</span><select data-pr-org="'+key+'"><option value="0">Sin asignar</option>'+rows.map(row=>'<option value="'+h(row.id)+'" '+(String(row.id)===organization.fields[key]?'selected':'')+'>'+h(textValue(row.name))+'</option>').join('')+'</select></label>';
  const multiple=(kind,title,rows,selected)=>'<label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">'+h(title)+'</span><select multiple size="5" data-pr-org-list="'+kind+'">'+rows.map(row=>'<option value="'+h(row.id)+'" '+(selected.includes(String(row.id))?'selected':'')+'>'+h(textValue(row.name))+'</option>').join('')+'</select></label>';
  return '<div class="prd-relation-actions"><button type="button" data-pr-action="masters" data-pr-resource="manufacturers">Gestionar marcas</button><button type="button" data-pr-action="masters" data-pr-resource="suppliers">Gestionar proveedores</button></div><div class="prd-fields-grid">'+select('id_manufacturer','Marca',c.manufacturers)+select('id_supplier','Proveedor principal',c.suppliers)+select('id_tax_rules_group','Grupo de impuestos',c.tax_rule_groups)+'</div>'+productCategoryPicker(organization)+featureValueSelectors(organization,{canCreate:canCreate(),pending})+'<div class="prd-fields-grid">'+multiple('tags','Etiquetas',c.tags,organization.tags)+multiple('related','Productos relacionados',c.related_products,organization.related)+'<label class="prd-field"><b>Añadir relacionado por referencia exacta</b><input data-pr-org-related value="'+h(organization.relatedReference||'')+'"><button type="button" data-pr-action="organization-related">Buscar y añadir relacionado</button></label></div><button type="button" data-pr-action="organization-review" class="btn primary">Revisar y sincronizar organización</button>';
 }
 async function loadOrganization(){
  if(!record)throw Error('Crea o selecciona un producto.');const catalog={};
  for(const resource of ['manufacturers','suppliers','tax_rule_groups','categories','tags','product_features','product_feature_values']){const all=[],seen=new Set();for(let page=0;;page++){const data=await invokeShop(store,'prestashop_read',{resource,page,page_size:100});if(!Array.isArray(data.rows))throw Error('No se pudo consultar '+resource+'.');for(const row of data.rows){if(seen.has(String(row.id)))throw Error('El catálogo contiene duplicados.');seen.add(String(row.id));all.push(row);}if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Catálogo auxiliar incompleto.');}catalog[resource]=all;}
  organization={store,id:String(record.id),catalog,fields:Object.fromEntries(['id_manufacturer','id_supplier','id_tax_rules_group','id_category_default'].map(k=>[k,String(overrides[k]??record[k]??'0')])),categories:associationIds(record,'categories'),tags:associationIds(record,'tags'),related:associationIds(record,'accessories'),features:(Array.isArray(record.associations?.product_features)?record.associations.product_features:[]).map(f=>({feature_id:String(f.id),value_id:String(f.id_feature_value)})),relatedReference:''};catalog.related_products=[];for(let offset=0;offset<organization.related.length;offset+=100){const response=await invokeShop(store,'prestashop_read',{resource:'products',product_ids:organization.related.slice(offset,offset+100),page:0,page_size:100});if(response.possibly_more)throw Error('Relacionados incompletos.');catalog.related_products.push(...response.rows);}status='Organización consultada. Selecciona los cambios y revisa antes de guardar.';
 }
 let catalogSearchTimer=null,catalogSearchTerm='',prefetchVersion=0,productPickerSize=10;
 function queueCatalogSearch(term){
  clearTimeout(catalogSearchTimer);const version=++prefetchVersion;
  const run=()=>{if(!current()||version!==prefetchVersion)return;if(pending||document.querySelector('dialog[open],.prd-select-dialog')){catalogSearchTimer=setTimeout(run,100);return;}catalogSearchTerm=term.trim();query=term;productPickerQuery=term;void work(()=>loadCatalog(false));};
  catalogSearchTimer=setTimeout(run,350);
 }
 function cacheCatalogue(){if(catalogSearchTerm)return;for(const shop of catalogScope==='both'?PRODUCT_STORES.map(s=>s.key):[catalogScope]){const c=connection(shop);catalogCache.set(shop,{revision:c?.revision,id:c?.id,rows:rows.filter(p=>(p.__store||store)===shop),meta:catalogMeta.get(shop)});}}
 async function prefetchCatalog(version,scope,{refresh=false}={}){
  const repaint=()=>{const active=document.activeElement,editing=root?.contains(active)&&active.matches('input,select,textarea,[data-pr-resize-column]');if(!editing&&!document.querySelector('dialog[open],.prd-select-dialog')&&!root?.querySelector('details[open]'))render();};
  const valid=()=>current()&&prefetchVersion===version&&catalogScope===scope&&!catalogSearchTerm;
  try{for(const shop of scope==='both'?PRODUCT_STORES.map(s=>s.key):[scope]){const seen=new Set();for(let cursor=0;valid();cursor++){
   while(pending&&valid())await new Promise(resolve=>setTimeout(resolve,100));if(!valid())return;
   const data=await invokeShop(shop,'prestashop_read',{resource:'products',page:cursor,page_size:100,sort:'newest'});
   while(pending&&valid())await new Promise(resolve=>setTimeout(resolve,100));if(!valid())return;
   if(data.resource!=='products'||data.page!==cursor||!Array.isArray(data.rows))throw Error('Catálogo incompleto.');
   const existing=new Set(rows.map(catalogKey));for(const item of data.rows){const key=shop+'|'+item.id;if(seen.has(key))throw Error('La tienda repitió una página.');seen.add(key);if(!existing.has(key))rows.push({...item,__store:shop});else if(refresh){const index=rows.findIndex(p=>catalogKey(p)===key);rows[index]={...item,__store:shop};}}
   repaint();if(!data.possibly_more){if(refresh)rows=rows.filter(p=>(p.__store||store)!==shop||seen.has(catalogKey(p)));break;}if(!data.rows.length)throw Error('La tienda devolvió una página vacía incompleta.');
  }}if(valid()){hasMore=false;cacheCatalogue();repaint();}}
  catch(error){if(valid()){status='Carga en segundo plano pendiente: '+error.message;repaint();}}
 }
 function productPicker(){
  const q=productPickerQuery.trim().toLocaleLowerCase('es'),items=rows.filter(p=>(p.__store||store)===store&&(!q||(textValue(p.name)+' '+textValue(p.reference)+' '+p.id).toLocaleLowerCase('es').includes(q))),size=productPickerSize,pages=Math.max(1,Math.ceil(items.length/size));
  productPickerPage=Math.min(productPickerPage,pages-1);const visible=items.slice(productPickerPage*size,(productPickerPage+1)*size);
  return '<section class="prd-product-picker" aria-label="Cambiar producto de trabajo"><div class="prd-product-picker-tools"><b>Producto de trabajo</b><input type="search" data-pr-picker-search value="'+h(productPickerQuery)+'" placeholder="Buscar nombre, referencia o ID en todo el catálogo" aria-label="Buscar otro producto"><button type="button" data-pr-action="picker-clear">Limpiar búsqueda</button><button type="button" data-pr-action="picker-catalog">Ver catálogo</button></div><div class="prd-product-picker-cards">'+visible.map(p=>'<button type="button" data-pr-action="picker-open" data-id="'+h(p.id)+'" data-pr-shop="'+h(p.__store||store)+'" aria-pressed="'+(String(record?.id)===String(p.id))+'">'+(productPhoto(p,p.__store||store)?'<img class="prd-product-photo" src="'+h(productPhoto(p,p.__store||store))+'" alt="'+h(textValue(p.name))+'">':'<span class="prd-picker-no-photo">Sin foto</span>')+'<span><strong>'+h(textValue(p.name))+'</strong><small>'+h(p.reference||'Sin referencia')+' · #'+h(p.id)+'</small></span></button>').join('')+'</div><div class="prd-product-picker-pages"><small>'+items.length+' productos consultados'+(hasMore?' · lista parcial':'')+' · '+(productPickerPage+1)+' / '+pages+'</small><label>Mostrar <select data-pr-picker-size>'+[10,20,50,100,Number.MAX_SAFE_INTEGER].map(n=>'<option value="'+n+'" '+(size===n?'selected':'')+'>'+(n===Number.MAX_SAFE_INTEGER?'Todos':n)+'</option>').join('')+'</select></label><label>Página <input type="number" min="1" max="'+pages+'" value="'+(productPickerPage+1)+'" data-pr-picker-page aria-label="Número de página de productos"></label><button type="button" data-pr-action="picker-page" data-direction="-1" '+(!productPickerPage?'disabled':'')+' aria-label="Productos anteriores">←</button><button type="button" data-pr-action="picker-page" data-direction="1" '+(productPickerPage+1>=pages&&!hasMore?'disabled':'')+' aria-label="Productos siguientes">→</button></div></section>';
 }
 function activateCatalogProduct(id,shop){
  void work(async()=>{if(String(record?.id)!==String(id)||store!==shop)await openProduct(id,shop,{keepCatalog:true});mode='catalogo';status='Producto de trabajo: '+textValue(record.name)+' (#'+record.id+'). Disponible en Producto, Copiar y Cambios. Seleccionar varios sirve para operaciones por lote.';});
 }
 function activateSingleSelection(){
  if(catalogSelected.size===1){const [shop,id]=[...catalogSelected][0].split('|');activateCatalogProduct(id,shop);}else render();
 }
 async function openQuickEditor(shop,id,trigger,focusField,archive=false){
  let product;await work(async()=>{product=await loadItem(shop,'products',id);tableEditor.open(shop,id,product.__language_ids||[]);if(archive){for(const [field,value]of [['active','0'],['visibility','none'],['available_for_order','0']])tableEditor.change(shop,id,field,value);await tableEditor.prepare(shop,id);}});if(!product||!current())return;
  openProductQuickEdit({root,trigger,editor:tableEditor,product,shop,id,focusField,onChange:persistDraft,onSaved:()=>{status='Producto #'+id+' guardado y releído en '+shop+'.';persistDraft();render();}});
 }
 function openQuickCell(cell){void openQuickEditor(cell.dataset.prShop,cell.dataset.prId,cell,cell.dataset.prQuickField);}

 function directLanguages(){const ids=record?.__language_ids||productLanguages.get(store)||[];return [...new Set([...ids,...LOCALIZED_PRODUCT_FIELDS.flatMap(field=>{const v=record?.[field];return (Array.isArray(v)?v:Array.isArray(v?.language)?v.language:[]).map(t=>String(t.id??t.language_id??t.id_lang??''));})].filter(id=>/^[1-9]\d*$/.test(id)))];}
 function localizedValue(value){const entries=Array.isArray(value)?value:Array.isArray(value?.language)?value.language:null;return entries?textValue(entries.find(t=>String(t.id??t.language_id??t.id_lang)===directLanguage)?.value):textValue(value);}
 function historyPanel(){
  const entries=[...operationHistory,...createWizard.history()].sort((a,b)=>String(b.at).localeCompare(String(a.at)));
  const printable=value=>typeof value==='object'?JSON.stringify(value):String(value??'');
  return '<section class="prd-operation-history"><h3>Historial de sincronización</h3><p>Operaciones verificadas y sus diferencias. Para rectificar, abre la ficha y guarda una nueva revisión; el historial anterior se conserva.</p>'+(!entries.length?'<p>Sin sincronizaciones guardadas en este borrador.</p>':'<ul>'+entries.map(e=>'<li><b>'+h(e.shop)+' · '+h(e.kind)+' #'+h(e.id)+'</b><span>'+h(e.at)+' · guardado y verificado</span>'+(e.changes?.length?'<details><summary>Consultar diferencias</summary><dl>'+e.changes.map(c=>'<dt>'+h(c.field)+'</dt><dd>'+(Object.hasOwn(c,'before')?h(printable(c.before))+' → ':'')+h(printable(c.after??c.value))+'</dd>').join('')+'</dl></details>':'')+(e.parent_id?btn('Abrir ficha para rectificar','picker-open','data-id="'+h(e.parent_id)+'" data-pr-shop="'+h(e.shop)+'"'):'')+'<small>Solicitud '+h(e.request||'')+'</small></li>').join('')+'</ul>')+btn('Volver al producto','mode','data-mode="ficha"')+'</section>';
 }
 function directReview(){
  const prepared=preflight.get(store),sent=editRequests.get(store),review=prepared?.review||[],valid=prepared?.can_commit;
  return '<section class="prd-direct-save" aria-label="Sincronizar producto"><div><strong>'+h(PRODUCT_STORES.find(s=>s.key===store).label)+' · '+(record.id?'producto #'+h(record.id):'producto nuevo')+'</strong><p>Los cambios se guardan aquí. Historial conserva las operaciones y sus diferencias.</p></div>'+(directLanguages().length>1?'<label>Idioma del texto<select data-pr-fiche-language '+(Object.keys(overrides).some(k=>LOCALIZED_PRODUCT_FIELDS.includes(k))?'disabled':'')+'>'+directLanguages().map(id=>'<option value="'+id+'" '+(id===directLanguage?'selected':'')+'>Idioma #'+id+'</option>').join('')+'</select></label>':'')+(prepared?'<ul class="prd-direct-differences">'+review.filter(c=>c.changed!==false).map(c=>'<li><b>'+h(metadata[c.field]||c.field)+'</b><span>'+h(text(c.before,90))+' → '+h(text(c.after??c.value,90))+'</span></li>').join('')+'</ul>':'')+'<div class="inline-actions">'+btn('Cambiar producto','picker-focus')+btn(record.id?'Guardar cambios en PrestaShop':'Crear en PrestaShop','fiche-validate','',pending||!canEdit())+'<label>Al publicar<select data-pr-publication-scope><option value="all" '+(publicationScope==='all'?'selected':'')+'>Producto, variaciones e imágenes</option><option value="base" '+(publicationScope==='base'?'selected':'')+'>Solo producto</option></select></label>'+btn('Publicar en PrestaShop','publish-direct','',pending||!canEdit())+(!sent&&Object.keys(overrides).length?btn('Descartar cambios de ficha','fiche-discard','',pending):'')+(valid||sent?btn(sent?'Comprobar sincronización':'Aceptar y sincronizar en '+PRODUCT_STORES.find(s=>s.key===store).label,'fiche-sync','',pending||!canEdit()):'')+(sent?btn('Revisar recuperación','edit-recovery','data-pr-dest="'+store+'"',pending):'')+'</div></section>';
 }
 function editor(){
  if(!record)return productPicker()+empty('Elige un producto','Selecciona una ficha del selector o del catálogo. Será el producto de trabajo de todas las pestañas.');
  const languages=directLanguages();if(!languages.includes(directLanguage))directLanguage=languages[0]||'';
  const localized={...record,...Object.fromEntries(LOCALIZED_PRODUCT_FIELDS.map(field=>[field,localizedValue(record[field])]))};
  let html=stitchFiche({galleryDraft,record:localized,backendUrl:productBackofficeUrl(record,store,owner),store,section:editorSection,overrides,variants,variantOverrides,variantReviews:variantPreflight,metadata,fieldControl,priceHtml:priceStudy(),rawHtml:rawPanel(),organization,taxGroups:catalogMeta.get(store)?.taxGroups||[],brands:catalogBrands,categories:catalogCategories,stock:catalogStock.get(store+'|'+record.id)??null,amounts:productDisplayAmounts({...record,...overrides},productCountryTaxRate(record.id_tax_rules_group,catalogTaxContext))});
  const fragment=document.createElement('template');fragment.innerHTML=html;const panel=fragment.content.querySelector('.subtab-content:not(.hidden)');
  fragment.content.querySelector('#tab-ficha')?.insertAdjacentHTML('afterbegin',directReview());
  if(panel&&inlineStage&&comparison.get(store)){const review=createWizard.renderInline(comparison.get(store),{...record,__sourceStore:store});if(review.includes('prd-publication-scope'))fragment.content.querySelector('.prd-direct-save')?.insertAdjacentHTML('afterend',review);else panel.insertAdjacentHTML('beforeend',review);}
  if(!record.id||draftPhotos.length){if(!record.id)for(const button of fragment.content.querySelectorAll('[data-pr-action="image-stages"]'))button.dataset.prAction='draft-pick-images';const photos=fragment.content.querySelector('#sub-imagenes');if(photos)photos.insertAdjacentHTML('afterbegin','<section class="prd-draft-photos"><p>Fotos preparadas: '+draftPhotos.length+'. Se subirán al publicar.</p><input type="file" accept="image/*" multiple hidden data-pr-draft-files><div class="prd-attribute-grid">'+draftPhotos.map((image,i)=>'<figure><img style="width:100px;height:100px;object-fit:contain" alt="Foto preparada '+(i+1)+'" src="data:image/png;base64,'+image.base64+'"><button type="button" data-pr-action="draft-photo-remove" data-pr-photo="'+i+'">Quitar</button></figure>').join('')+'</div></section>');}
  return fragment.innerHTML+productPicker();
 }
 async function reviewDirectProduct(){
  if(!record?.id){targets=new Set([store]);await prepare();inlineStage=true;mode='ficha';return;}
  if(editRequests.has(store))throw Error('Comprueba la sincronización enviada antes de preparar otra.');
  const changes=Object.entries(overrides).map(([field,value])=>({field,value:productInputValue(field,value),...(LOCALIZED_PRODUCT_FIELDS.includes(field)?{language_id:directLanguage}:{})}));
  if(!changes.length)throw Error('Modifica al menos un dato de la ficha.');
  const result=await invokeShop(store,'prestashop_product_prepare',{resource:'products',record_id:String(record.id),changes});
  if(result.persisted!==false||String(result.record_id)!==String(record.id)||!Array.isArray(result.changes)||!/^[a-f0-9]{64}$/.test(result.fingerprint||''))throw Error('No se ha podido verificar la revisión de esta ficha.');
  preflight.set(store,{...result,record_id:String(record.id),changes,review:result.changes,request_id:crypto.randomUUID()});status='Revisa las diferencias y acepta la sincronización en '+store+'.';mode='ficha';
 }
 async function reviewDirectVariant(id){
  const variant=variants.find(v=>String(v.id)===String(id));if(!record?.id||!variant)throw Error('Guarda primero el producto y su combinación.');
  const changes=Object.entries(variantOverrides.get(String(id))||{}).map(([field,value])=>({field,value:productInputValue(field,value)}));if(!changes.length)throw Error('Modifica al menos un dato de esta combinación.');
  const result=await invokeShop(store,'prestashop_product_prepare',{resource:'combinations',record_id:String(id),expected_product_id:String(record.id),changes});
  if(result.persisted!==false||String(result.record_id)!==String(id)||!Array.isArray(result.changes)||!/^[a-f0-9]{64}$/.test(result.fingerprint||''))throw Error('Revisión de combinación no verificable.');
  comparison.set(store,{operation:'update',store,target_id:String(record.id),changes:[],variants:[],warnings:[]});variantPreflight.set(store+'|'+id,{...result,changes,review:result.changes,request_id:crypto.randomUUID()});status='Combinación #'+id+' revisada. Acepta para sincronizarla.';
 }

 function targetLanguageIds(dest,field){
  const value=targetRaw.get(dest)?.[field];
  const langs=Array.isArray(value)?value:Array.isArray(value?.language)?value.language:value?.language?[value.language]:[];
  return [...new Set([...(targetRaw.get(dest)?.__language_ids||[]),...langs.map(x=>String(x?.id??x?.id_lang??''))].filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
 }
 function languagePicker(dest,field){
  if(!LOCALIZED_PRODUCT_FIELDS.includes(field)||!targetRaw.get(dest))return '';
  const ids=targetLanguageIds(dest,field),selected=targetLanguages.get(dest)?.[field]||(ids.length===1?ids[0]:''),raw=targetRaw.get(dest)?.[field],entries=Array.isArray(raw)?raw:Array.isArray(raw?.language)?raw.language:raw?.language?[raw.language]:[];
  return '<span class="prd-lang-label">Idioma de destino</span><select data-pr-lang-store="'+h(dest)+'" data-pr-lang-field="'+h(field)+'"><option value="">Seleccionar idioma</option>'+ids.map(id=>'<option value="'+h(id)+'" '+(selected===id?'selected':'')+'>Idioma #'+h(id)+(entries.find(x=>String(x.id??x.id_lang)===id)?' · '+h(text(entries.find(x=>String(x.id??x.id_lang)===id)?.value,30)):'')+'</option>').join('')+'</select>'+(ids.length?'':'<small>No se han detectado idiomas en esta ficha; revisión necesaria.</small>');
 }
 function variantSaveControls(shop,id){
  if(!id)return '';
  const key=shop+'|'+id,prepared=variantPreflight.get(key),sent=editRequests.get(key);
  return '<label>Confirmar combinación<input data-pr-edit-confirm="'+key+'" placeholder="GUARDAR" value="'+h(editConfirm.get(key)||'')+'"></label>'+btn(sent?.recover_unchanged?'Reintentar combinación revisada':sent?'Comprobar combinación enviada':'Guardar combinación','variant-edit-commit','data-pr-dest="'+shop+'" data-pr-variation="'+id+'"',pending||!canEdit()||!sent&&!prepared?.can_commit)+(sent?btn('Revisar recuperación','variant-edit-recovery','data-pr-dest="'+shop+'" data-pr-variation="'+id+'"',pending||!canEdit()):'');
 }
 async function commitVariant(shop,id){
  const key=shop+'|'+id,plan=comparison.get(shop);if(!canEdit()||!plan?.target_id||editConfirm.get(key)!=='GUARDAR')throw Error('Revisa la combinación y escribe GUARDAR.');
  let args=editRequests.get(key);
  if(!args){const prepared=variantPreflight.get(key);if(!prepared?.can_commit)throw Error('Valida primero la combinación.');args={resource:'combinations',record_id:id,expected_product_id:plan.target_id,changes:prepared.changes,expected_fingerprint:prepared.fingerprint,request_id:prepared.request_id,confirmed:true};editRequests.set(key,args);}
  const response=await invokeShop(shop,'prestashop_product_commit',args);if(response.persisted!==true||response.verified!==true||String(response.record_id)!==String(id))throw Error('Combinación no verificada; conserva la solicitud para comprobarla.');
  operationHistory.push({shop,kind:'Combinación',id:String(id),at:new Date().toISOString(),request:args.request_id,changes:variantPreflight.get(key)?.review||args.changes,parent_id:String(plan.target_id)});
  const actual=await loadItem(shop,'combinations',id);if(String(actual.id_product)!==String(plan.target_id))throw Error('Relectura de otro producto.');
  if(shop===store){const index=variants.findIndex(v=>String(v.id)===String(id));if(index>=0)variants[index]={...variants[index],...actual};variantOverrides.delete(String(id));variantFields.delete(String(id));}variantPreflight.delete(key);editRequests.delete(key);editConfirm.delete(key);status='Combinación #'+id+' guardada y releída en '+shop+'.';
 }
 function editControls(plan){
  const prepared=preflight.get(plan.store),sent=editRequests.get(plan.store);
  return '<div class="prd-edit-actions"><label>Para guardar los campos seleccionados escribe GUARDAR<input data-pr-edit-confirm="'+plan.store+'" value="'+h(editConfirm.get(plan.store)||'')+'"></label>'+btn(sent?.recover_unchanged?'Reintentar solicitud revisada':sent?'Comprobar actualización enviada':'Guardar cambios en '+plan.store,'edit-commit','data-pr-dest="'+plan.store+'"',pending||!canEdit()||!sent&&!prepared?.can_commit)+(sent?btn('Revisar recuperación','edit-recovery','data-pr-dest="'+plan.store+'"',pending||!canEdit()):'')+'</div>';
 }
 async function reviewEditRecovery(shop,key=shop){
  if(!canEdit())throw Error('No tienes permiso para editar.');const args=editRequests.get(key);if(!args)throw Error('No hay una solicitud enviada para recuperar.');const prepared=await invokeShop(shop,'prestashop_product_prepare',{resource:args.resource,record_id:args.record_id,changes:args.changes,...(args.expected_product_id?{expected_product_id:args.expected_product_id}:{})});if(!prepared.can_commit||String(prepared.record_id)!==String(args.record_id)||!prepared.fingerprint)throw Error('No se pudo revisar la misma solicitud.');args.expected_fingerprint=prepared.fingerprint;args.recover_unchanged=true;if(key===shop)preflight.set(shop,{...prepared,changes:args.changes,request_id:args.request_id});else variantPreflight.set(key,{...prepared,changes:args.changes,request_id:args.request_id});editConfirm.delete(key);status='Recuperación revisada para la misma solicitud '+args.request_id+'. Comprueba las diferencias y escribe GUARDAR antes de reintentar.';
 }
 async function commitEdit(shop){
  if(!canEdit()||editConfirm.get(shop)!=='GUARDAR')throw Error('Revisa los cambios y escribe GUARDAR.');
  let args=editRequests.get(shop);
  if(!args){const prepared=preflight.get(shop);if(!prepared?.can_commit)throw Error('Valida primero la ficha real.');args={resource:'products',record_id:prepared.record_id,changes:prepared.changes,expected_fingerprint:prepared.fingerprint,request_id:prepared.request_id,confirmed:true};editRequests.set(shop,args);}
  const result=await invokeShop(shop,'prestashop_product_commit',args);
  if(result.persisted!==true||result.verified!==true||String(result.record_id)!==String(args.record_id))throw Error('Guardado no verificado. Conserva la solicitud y comprueba de nuevo.');
  operationHistory.push({shop,kind:'Producto',id:String(args.record_id),at:new Date().toISOString(),request:args.request_id,changes:preflight.get(shop)?.review||args.changes,parent_id:String(args.record_id)});
  const saved=await loadItem(shop,'products',args.record_id);shopRecords.set(shop,saved);targetRaw.set(shop,saved);preflight.delete(shop);editRequests.delete(shop);editConfirm.delete(shop);
  if(shop===store&&String(record?.id)===String(saved.id)){record=saved;for(const change of args.changes){delete overrides[change.field];fields.delete(change.field);}const index=rows.findIndex(p=>catalogKey(p)===shop+'|'+saved.id);if(index>=0)rows[index]={...saved,__store:shop};cacheCatalogue();}
  status='Actualización guardada y releída en '+shop+' · #'+args.record_id+'.';
 }
 function copyVariationChoices(){
  if(!variants.length)return '<section class="prd-copy-variant-options" aria-label="Variaciones para copiar"><h3>Variaciones</h3><p>Este producto no tiene combinaciones.</p></section>';
  const selected=variants.filter(v=>variantFields.get(keyFor(v))?.size).length;
  return '<section class="prd-copy-variant-options" aria-label="Variaciones para copiar"><div class="inline-actions"><h3>Variaciones · '+selected+' de '+variants.length+' seleccionadas</h3>'+fieldHelp('Variaciones de la copia','Selecciona las combinaciones que deseas trasladar. Se conservan los campos y se asignan los atributos propios de destino; el stock se revisa aparte.')+btn('Seleccionar todas las variaciones','copy-variants-all')+btn('Limpiar variaciones','copy-variants-none')+'</div><div class="flex flex-col gap-space-sm">'+variants.map(v=>'<label><input type="checkbox" data-pr-copy-variant="'+h(keyFor(v))+'" '+(variantFields.get(keyFor(v))?.size?'checked':'')+'>'+photo({id_default_image:associationIds(v,'images')[0]||record.id_default_image,name:v.reference},store)+'<span><b>'+h((v.__attributeNames||[]).join(' · ')||v.reference||'Combinación')+'</b><small>'+h(v.reference||'')+' · EAN '+h(v.ean13||'sin indicar')+'</small><small>Coste '+h(v.wholesale_price||'—')+' · impacto '+h(v.price||'0')+' · peso '+h(v.weight||'0')+' kg</small></span></label>').join('')+'</div><small>Se copian los campos de las combinaciones elegidas. Las fotos se preparan y revisan en la etapa Imágenes del destino.</small></section>';
 }
 function parallelEditors(){
  const stores=[store,...PRODUCT_STORES.map(s=>s.key).filter(s=>s!==store)];
  const sections={general:PRODUCT_SECTIONS.general.filter(f=>!['description','description_short'].includes(f)),contenido:['description_short','description'],...Object.fromEntries(Object.entries(PRODUCT_SECTIONS).filter(([key])=>key!=='general'))};
  sections.variaciones=[];if(!sections[parallelSection])parallelSection='general';
  return '<div class="prd-field-selection">'+btn('Seleccionar todos los campos','fields-all')+btn('Ninguno','fields-none')+'<span>'+fields.size+' campos seleccionados para copiar</span></div><nav class="prd-parallel-tabs" aria-label="Apartados de ambas fichas">'+Object.keys(sections).map(key=>btn(key==='contenido'?'Contenido':key==='general'?'Datos':key==='variaciones'?'Variaciones':sectionTitle(key),'parallel-section','data-pr-section="'+key+'"'+(parallelSection===key?' aria-current="page"':''),pending)).join('')+'</nav><div class="prd-parallel-editors">'+stores.map(shop=>{
   const source=shop===store,target=targetRaw.get(shop),values=targetOverrides.get(shop)||{};
   return '<fieldset><legend>'+h(PRODUCT_STORES.find(s=>s.key===shop).label)+(source?' · origen':' · destino')+'</legend><div class="prd-parallel-identity">'+photo(source?record:target,shop)+'<strong>'+h(text((source?record:target)?.name)||'Nueva ficha')+'</strong></div><p class="small">'+(source?'Marca los campos que deseas copiar.':'Completa o adapta los campos del destino. Nada se envía hasta validar y confirmar.')+'</p>'+(parallelSection==='variaciones'?(source?copyVariationChoices():'<section class="prd-copy-variant-destination"><h3>Variaciones de destino</h3><p>'+variants.filter(v=>variantFields.get(keyFor(v))?.size).length+' seleccionadas para copiar. Sus atributos e imágenes se relacionan con los ID de esta tienda al preparar la copia.</p></section>'):'')+(!source?'<label class="prd-field"><b>ID de destino existente (opcional)</b><input data-pr-existing-id="'+shop+'" value="'+h(targetIds.get(shop)||'')+'" placeholder="Buscar por referencia si se deja vacío"></label>':'<label class="prd-field"><b>ID de origen</b><input value="'+h(record.id||'Borrador nuevo')+'" disabled></label>')+(!source&&createWizard.hasAttempted(shop)?'<p class="prd-note">Esta copia conserva los datos validados de su alta. Completa o recupera la operación; los cambios posteriores se editan desde la ficha creada.</p>':'')+'<div class="prd-fields-grid">'+sections[parallelSection].map(field=>{
    if(source)return showField(field);
    const value=Object.prototype.hasOwnProperty.call(values,field)?values[field]:fields.has(field)?Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record[field]):textValue(target?.[field]);
    const attrs='data-pr-target-field="'+h(field)+'" data-pr-target-store="'+shop+'"';
    return '<label class="prd-field"><b>'+h(metadata[field]||field)+'</b>'+fieldControl(field,value,attrs,createWizard.hasAttempted(shop))+languagePicker(shop,field)+'</label>';
   }).join('')+'</div></fieldset>';
  }).join('')+'</div>';
 }
 function comparisonPanel(){
  if(!record)return empty('Selecciona una ficha','Primero abre un producto o crea un borrador.');
  return '<section class="card card-pad"><h3>Tiendas de destino</h3><p>Selecciona una o ambas. Cada tienda conserva sus propios ID, categorías, imágenes y atributos.</p><div class="prd-targets">'+PRODUCT_STORES.map(s=>'<label><input type="checkbox" data-pr-target="'+s.key+'" '+(targets.has(s.key)?'checked':'')+'> '+h(s.label)+' '+(ready(s.key)?'':'· sin conexión verificada')+'</label>').join('')+'</div>'+parallelEditors()+'<div class="inline-actions">'+btn('Buscar coincidencias y preparar cambios','compare','',pending||!targets.size)+btn('Descartar propuesta','clear-preview','',pending)+'</div><div class="prd-preview">'+(preview.length?preview.map(plan=>'<section class="prd-plan"><h4>'+h(PRODUCT_STORES.find(s=>s.key===plan.store)?.label)+' · '+(plan.operation==='update'?'Actualizar #'+h(plan.target_id):'Crear producto nuevo')+'</h4><p>'+plan.changes.filter(x=>x.changed).length+' campos cambiados · '+plan.variants.length+' variaciones seleccionadas</p><ul>'+plan.changes.filter(x=>x.changed).map(change=>'<li><b>'+h(metadata[change.field]||change.field)+'</b>: '+h(text(change.before))+' → '+h(text(change.after))+'</li>').join('')+'</ul>'+((preflight.get(plan.store)?.record_id===plan.target_id)?'<p class="prd-api-ok">XML real consultado y campos seleccionados verificados, sin escribir.</p>':'')+btn('Validar contra el XML de la tienda','api-preview','data-pr-dest="'+h(plan.store)+'"',pending||!plan.target_id||!plan.changes.some(c=>c.changed))+plan.variants.filter(v=>v.changes.some(c=>c.changed)).map(v=>'<div class="prd-variant-review"><span>Variación #'+h(v.target_id||'nueva')+' · '+h(v.changes.filter(c=>c.changed).length)+' campos</span>'+((variantPreflight.has(plan.store+'|'+v.target_id))?'<small>XML comprobado</small>':'')+btn('Validar variación','variant-api-preview','data-pr-dest="'+h(plan.store)+'" data-pr-variation="'+h(v.target_id||'')+'"',pending||!v.target_id)+variantSaveControls(plan.store,v.target_id)+'</div>').join('')+plan.warnings.map(w=>'<p class="prd-warning">'+h(w)+'</p>').join('')+(plan.operation==='create'?createWizard.render(plan,{...record,__sourceStore:store}):(plan.changes.some(c=>c.changed)?editControls(plan):'')+createWizard.render(plan,{...record,__sourceStore:store}))+'</section>').join(''):'<p>Sin propuesta calculada. Primero selecciona los campos de la ficha y, si corresponde, de cada combinación.</p>')+'</div><p class="prd-note"><b>El alta base tiene su propia confirmación por tienda.</b> Tras el alta base, completa combinaciones, existencias, precios e imágenes en sus etapas. Las actualizaciones de productos anteriores y los lotes se mantienen separados.</p></section>';
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
 function openMasters(resource,trigger,initialRecordId=null){openProductMasters({root,store,owner,trigger,initialRecordId,initialResource:resource,allowedResources:resource==='product_options'?['product_options','product_option_values']:[resource||'manufacturers'],invoke:invokeShop,canEdit:canEdit(),canCreate:canCreate(),hasProduct:!!record?.id,onChanged:(resource,items)=>{catalogCache.delete(store);const meta=catalogMeta.get(store);if(resource==='manufacturers'){catalogBrands=items;if(meta)meta.brands=items;}if(resource==='suppliers'&&meta)meta.suppliers=items;if(resource==='product_options')attributeGroups.set(store,new Map(items.map(row=>[String(row.id),textValue(row.name)])));if(resource==='product_option_values')for(const row of items){attributeNames.set(store+'|'+row.id,textValue(row.name));attributeValues.set(store+'|'+row.id,row);}organization=null;attributesUI.invalidate();if(mode==='atributos')void attributesUI.refresh();},onCreate:resource=>{const next={manufacturers:'manufacturer-create',suppliers:'supplier-create',product_options:'attribute-group',product_option_values:'attribute-value',product_features:'feature-create',product_feature_values:'feature-value-create'}[resource];const action=document.createElement('button');action.dataset.prAction=next;action.hidden=true;root.append(action);action.click();action.remove();}});}
 const attributesUI=createAttributesWorkspace({invoke:invokeShop,actor,contextKey:shop=>{const c=connection(shop);return shop+'|'+c?.id+'|'+c?.revision;},canEdit,canCreate,hasProduct:()=>!!record?.id,onEdit:(resource,id,trigger)=>openMasters(resource,trigger,id),onCreate:resource=>{const action=document.createElement('button');action.dataset.prAction=({product_options:'attribute-group',product_option_values:'attribute-value',product_features:'feature-create',product_feature_values:'feature-value-create'})[resource];action.hidden=true;root.append(action);action.click();action.remove();},onProduct:id=>{void work(()=>openProduct(id,store));}});
 function render(){
  if(!current())return;
  if(root.querySelector('.prd-quick-edit[open]'))return;
  if(root.classList.contains('prd-column-resizing')){renderAfterResize=true;return;}renderAfterResize=false;
  const active=document.activeElement,focus=root.contains(active)&&active.matches('input,select,textarea,button,summary')?{selector:active.id?'#'+CSS.escape(active.id):[...active.attributes].filter(a=>a.name.startsWith('data-pr-')).map(a=>'['+a.name+'="'+CSS.escape(a.value)+'"]').join(''),start:active.selectionStart,end:active.selectionEnd}:null;
  const opened=[...root.querySelectorAll('.prd-variant[open]')].map(el=>el.dataset.prVariant);
  const columnsOpen=!!root.querySelector('.prd-columns[open]'),columnSearch=root.querySelector('[data-pr-columns-search]')?.value||'';
  const tableOffset=root.querySelector('.prd-catalog-table')?.scrollLeft||0,columnMenuOffset=root.querySelector('.prd-columns>div')?.scrollTop||0;
  const content=mode==='atributos'?(catalogScope==='both'?empty('Elige una tienda','Los atributos y características pertenecen a cada PrestaShop. Selecciona Hortimatic o NewOldSmok en Tienda de trabajo.'):'<div data-pr-attributes-host></div>'):mode==='catalogo'?catalog():mode==='ficha'?editor():mode==='variantes'?variantsPanel():mode==='comparar'?productPicker()+(record?stitchCopy({store,record,canUpload:createWizard.canCommit(store==='hortimatic'?'newoldsmok':'hortimatic')||preflight.get(store==='hortimatic'?'newoldsmok':'hortimatic')?.can_commit===true,copyCreated:!!createWizard.result(store==='hortimatic'?'newoldsmok':'hortimatic')&&!createWizard.result(store==='hortimatic'?'newoldsmok':'hortimatic')?.existing_product,copyPublished:!!targetRaw.get(store==='hortimatic'?'newoldsmok':'hortimatic')?.__copyCompleted,copyImages:createWizard.copyImagesSelected(store==='hortimatic'?'newoldsmok':'hortimatic'),copyLocked:createWizard.hasAttempted(store==='hortimatic'?'newoldsmok':'hortimatic'),targetRecord:targetRaw.get(store==='hortimatic'?'newoldsmok':'hortimatic'),legacyHtml:comparisonPanel()}):comparisonPanel()):mode==='encargo'?stitchRequest({legacyHtml:renderProductRequestForm(requestBrief,requestOutput),output:requestOutput}):mode==='guardado'?stitchSaved({record,legacyHtml:record?historyPanel():'',queue:copyQueue,drafts:savedDraftCards()}):bulk();
  attributesUI.dispose();controlsCleanup();photoCleanup();layoutCleanup();
  replacingDOM=true;try{root.innerHTML='<div class="prd-shell prd-stitch prd-professional">'+stitchHeader({store:catalogScope,mode,status,count:rows.length,product:text(record?.name),draftCount:savedDraftCards().length,pending,connected:catalogScope==='both'?PRODUCT_STORES.every(s=>ready(s.key)):ready(store)})+'<div class="prd-body">'+content+'</div></div>';}finally{replacingDOM=false;}

  const attributesHost=root.querySelector('[data-pr-attributes-host]');if(attributesHost)attributesUI.mount(attributesHost,store);
  for(const detail of root.querySelectorAll('.prd-variant'))if(opened.includes(detail.dataset.prVariant))detail.open=true;
  if(columnsOpen&&root.querySelector('.prd-columns'))root.querySelector('.prd-columns').open=true;const columnSearchInput=root.querySelector('[data-pr-columns-search]');if(columnSearchInput){columnSearchInput.value=columnSearch;for(const label of root.querySelectorAll('[data-pr-column-option]'))label.hidden=!label.textContent.toLocaleLowerCase('es').includes(columnSearch.toLocaleLowerCase('es'));}
  layoutCleanup=attachProductTableLayout(root,{onWidth:(key,width)=>{if(width===null)delete columnWidths[key];else columnWidths[key]=width;saveCatalogPreferences();},onFinish:()=>{if(renderAfterResize)render();},onMove:moveCatalogColumn});if(columnsOpen&&root.querySelector('.prd-columns>div'))root.querySelector('.prd-columns>div').scrollTop=columnMenuOffset;root.querySelectorAll('[data-pr-category-branch]').forEach(node=>{node.ontoggle=()=>{if(organization){organization.categoryExpanded||={};organization.categoryExpanded[node.dataset.prCategoryBranch]=node.open;}};});controlsCleanup=enhanceProductSelects(root);photoCleanup=attachProductPhotoPreviews(root);const catalogTable=root.querySelector('.prd-catalog-table');if(catalogTable){catalogTable.scrollLeft=tableOffset;const position=root.querySelector('[data-pr-table-position]');if(position){const sync=()=>{const max=catalogTable.scrollWidth-catalogTable.clientWidth;position.disabled=max<=0;position.value=String(max>0?Math.round(catalogTable.scrollLeft/max*1000):0);};catalogTable.addEventListener('scroll',sync,{passive:true});sync();}}
  for(const cell of root.querySelectorAll('.prd-catalog-table td,.prd-catalog-table th,.prd-table-viewport td,.prd-table-viewport th'))cell.tabIndex=0;
  if(pending)for(const el of root.querySelectorAll('button,input,select,textarea'))if(!el.matches('[data-pr-action="catalog-cancel"]'))el.disabled=true;
  if(focus?.selector){const target=root.querySelector(focus.selector);if(target&&!target.disabled){target.focus({preventScroll:true});if(focus.start!==null&&['text','search','url'].includes(target.type))target.setSelectionRange(focus.start,focus.end);}}
  persistDraft();
 }
 async function invokeShop(shop,action,args){
  if(!current())throw Error('La sesión ha cambiado.');
  const permission=action.includes('_create_')&&action!=='prestashop_product_create_profile'?'create':action.includes('_step_')?(String(args.kind).startsWith('remove_')?'delete':args.existing_product!==true||['variation','attribute_group','attribute_value','feature','feature_value','manufacturer','supplier'].includes(args.kind)?'create':'edit'):['prestashop_product_prepare','prestashop_product_commit'].includes(action)?'edit':'view';
  if(permission==='edit'&&!canEdit()||permission==='create'&&!canCreate()||permission==='delete'&&!canDelete())throw Error('No tienes permiso de '+permission+' en Productos.');
  const generation=epoch;
  const c=connection(shop);if(!ready(shop))throw Error('Comprueba la conexión de '+shop+' antes de consultar.');
  if(action.endsWith('_commit')){catalogCache.delete(shop);++prefetchVersion;persistDraft();await storageQueue;if(storageError)throw Error('No se ha podido conservar la solicitud local. No se ha enviado a la tienda.');if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');}
  const r=await invoke({action,store:shop,id:c.id,revision:c.revision,call_id:crypto.randomUUID(),...args});
  if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');
  if(r?.ok!==true||r.store!==shop)throw Error('Respuesta de tienda no verificada.');
  return r;
 }
 async function switchStore(next){
  if(!['hortimatic','newoldsmok','both'].includes(next)||next===catalogScope)return;
  const requestedMode=mode;
  rememberProductDraft();if(record||requestBrief.url||requestBrief.product_id)draftsByShop.set(store,structuredClone(snapshotDraft()));
  resetDraft();catalogScope=next;if(next!=='both')store=next;
  rows=[];page=0;hasMore=false;query='';catalogSearchTerm='';catalogStock.clear();catalogSelected.clear();catalogFilters={category:'',brand:'',active:''};
  const saved=next==='both'?null:draftsByShop.get(next);if(saved){const edits=tableEditor.snapshot();restoreDraft(saved);tableEditor.restore(edits);if(record?.id&&ready(next))await refreshStoredProduct();}else mode='catalogo';
  mode=['catalogo','encargo','guardado','atributos'].includes(requestedMode)?requestedMode:record?requestedMode:'catalogo';
  if(next==='both'||ready(next))await loadCatalog(false);else status='Revisa la conexión de '+next+'.';
 }

 async function loadItem(shop,resource,id){
  const r=await invokeShop(shop,'prestashop_item_read',{resource,record_id:String(id)});
  if(r.resource!==resource||String(r.record_id)!==String(id))throw Error('Detalle ajeno a la selección.');
  if(resource==='products'){if(!productLanguages.has(shop)){const profile=await invokeShop(shop,'prestashop_product_create_profile',{});if(!Array.isArray(profile.language_ids)||!profile.language_ids.length)throw Error('No se han podido verificar los idiomas del producto.');productLanguages.set(shop,profile.language_ids.map(String));}r.item.__language_ids=productLanguages.get(shop);}
  return r.item;
 }
 async function combinations(shop,product){
  const ids=associationIds(product,'combinations');
  const list=[];
  for(const id of ids){const item=await loadItem(shop,'combinations',id);
   if(String(item.id_product)!==String(product.id))throw Error('Combinación asociada a otro producto.');
   list.push(item);
  }
  const wanted=new Set(list.flatMap(v=>associationIds(v,'product_option_values')));
  try{for(let page=0;[...wanted].some(id=>!attributeNames.has(shop+'|'+id));page++){const data=await invokeShop(shop,'prestashop_read',{resource:'product_option_values',page,page_size:100});for(const value of data.rows||[]){attributeNames.set(shop+'|'+value.id,textValue(value.name));attributeValues.set(shop+'|'+value.id,value);}if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Valores de atributos incompletos.');}}catch{/* Missing names are explicit; no substitutions. */}
  try{if(!attributeGroups.has(shop)){const groups=new Map();for(let page=0;;page++){const data=await invokeShop(shop,'prestashop_read',{resource:'product_options',page,page_size:100});for(const group of data.rows||[])groups.set(String(group.id),textValue(group.name));if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Grupos incompletos.');}attributeGroups.set(shop,groups);}}catch{/* Unknown groups do not authorize a match by attribute. */}
  for(const variant of list)variant.__attributes=associationIds(variant,'product_option_values').map(id=>{const value=attributeValues.get(shop+'|'+id);return {group:attributeGroups.get(shop)?.get(String(value?.id_attribute_group))||'',value:attributeNames.get(shop+'|'+id)||''};});
  for(const variant of list)variant.__attributeNames=associationIds(variant,'product_option_values').map(id=>attributeNames.get(shop+'|'+id)||'Atributo #'+id);
  try{const stock=[];for(let page=0;;page++){const data=await invokeShop(shop,'prestashop_read',{resource:'stock_availables',product_ids:[String(product.id)],page,page_size:100});if(data.rows.some(row=>String(row.id_product)!==String(product.id)))throw Error('Existencias ajenas.');stock.push(...data.rows);if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Existencias incompletas.');}for(const variant of list){const matches=stock.filter(row=>String(row.id_product_attribute)===String(variant.id)&&(!product.id_shop_default||['0',String(product.id_shop_default)].includes(String(row.id_shop))));if(matches.length===1&&String(matches[0].quantity).trim()!==''&&Number.isFinite(Number(matches[0].quantity)))variant.__stock=matches[0];}}catch{/* A failed read is never zero. */}
  return list;
 }
 async function work(fn){
  if(pending||!current())return;
  const generation=epoch;
  pending=true;render();
  try{await fn();}catch(e){if(current()&&epoch===generation)status=e?.message||String(e);}
  finally{if(epoch===generation){pending=false;if(current())render();}}
 }
 async function loadCreationMetadata(){
  if(!catalogColumns.includes('creator'))return;
  const visible=visibleCatalog().slice(listPage*listSize,(listPage+1)*listSize);
  for(const shop of PRODUCT_STORES.map(s=>s.key)){const ids=visible.filter(p=>(p.__store||store)===shop).map(p=>String(p.id)).filter(id=>!creationMetadata.has(shop+'|'+id));for(let n=0;n<ids.length;n+=100){const batch=ids.slice(n,n+100),data=await rpc('totus_products_creation_metadata',{p_store:shop,p_product_ids:batch});if(!Array.isArray(data))throw Error('Autoría no verificable.');for(const id of batch)creationMetadata.set(shop+'|'+id,'');for(const item of data)if(batch.includes(String(item.product_id)))creationMetadata.set(shop+'|'+item.product_id,item.creator||'Usuario retirado');}}
 }
 async function loadCatalogStock(){
  await loadCreationMetadata();
  const visible=visibleCatalog().slice(listPage*listSize,(listPage+1)*listSize);
  for(const shop of [...new Set(visible.map(p=>p.__store||store))]){
   const products=visible.filter(p=>(p.__store||store)===shop),ids=products.map(p=>String(p.id)),totals=new Map();if(!ids.length)continue;
   for(let page=0;page<=1000;page++){
    const response=await invokeShop(shop,'prestashop_read',{resource:'stock_availables',product_ids:ids,page,page_size:100});
    for(const row of response.rows){
     if(!ids.includes(String(row.id_product)))throw Error('Existencias de otro producto.');
     const product=products.find(p=>String(p.id)===String(row.id_product)),variants=associationIds(product,'combinations').length>0;
     if(product?.id_shop_default&&String(row.id_shop)!=='0'&&String(row.id_shop)!==String(product.id_shop_default))continue;
     if(!Number.isFinite(Number(row.quantity)))throw Error('Existencias no verificables.');
     if(variants?String(row.id_product_attribute)!=='0':String(row.id_product_attribute)==='0')totals.set(shop+'|'+row.id_product,(totals.get(shop+'|'+row.id_product)||0)+Number(row.quantity));
    }
    if(!response.possibly_more){for(const [id,quantity]of totals)catalogStock.set(id,quantity);break;}
    if(page===1000)throw Error('Consulta de existencias incompleta.');
   }
  }
 }
 async function loadCatalog(more,{stock=true}={}){
  if(!more){++prefetchVersion;rows=[];page=0;hasMore=false;listPage=0;catalogMore.clear();catalogSelected.clear();catalogStock.clear();}
  const shops=catalogScope==='both'?PRODUCT_STORES.map(s=>s.key):[catalogScope];
  if(!more&&!catalogSearchTerm&&shops.every(shop=>catalogCache.has(shop))){const generation=epoch,context=await rpc('totus_products_context',{});if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');connections=context?.connections||[];
   if(shops.every(shop=>{const saved=catalogCache.get(shop),c=connection(shop);return ready(shop)&&saved.id===c.id&&saved.revision===c.revision;})){for(const shop of shops){const saved=catalogCache.get(shop);rows.push(...saved.rows);if(saved.meta)catalogMeta.set(shop,saved.meta);}const meta=catalogMeta.get(store);catalogCategories=meta?.categories||[];catalogBrands=meta?.brands||[];catalogTaxContext=meta?.tax||{countries:[],rules:[],taxes:[]};hasMore=false;status='Catálogo en caché de sesión: '+rows.length+' productos. Actualizar consulta de nuevo la tienda.';if(stock)await loadCatalogStock();const version=prefetchVersion,scope=catalogScope;queueMicrotask(()=>{void prefetchCatalog(version,scope,{refresh:true});});return;}}
  for(const shop of shops){
   if(more&&catalogMore.get(shop)===false)continue;
   const channels=catalogSearchTerm?['name','reference','ean13',...(/^\d+$/.test(catalogSearchTerm)?['id']:[])]:['all'];
   const responses=[];for(const channel of channels){const key=shop+'|'+channel;if(more&&catalogMore.get(key)===false)continue;const readPage=more&&!catalogSearchTerm?Math.floor(rows.filter(p=>(p.__store||store)===shop).length/Math.min(100,listSize)):page;const data=await invokeShop(shop,'prestashop_read',{resource:'products',page:readPage,page_size:Math.min(100,listSize),sort:'newest',...(channel==='all'?{}:channel==='id'?{product_ids:[catalogSearchTerm]}:{search:catalogSearchTerm,search_field:channel})});if(data.resource!=='products'||data.page!==readPage||!Array.isArray(data.rows))throw Error('Listado no verificable.');catalogMore.set(key,!!data.possibly_more);responses.push(data);}
   const response={resource:'products',page,rows:responses.flatMap(r=>r.rows),possibly_more:channels.some(channel=>catalogMore.get(shop+'|'+channel))};
   if(response.resource!=='products'||response.page!==page||!Array.isArray(response.rows))throw Error('Listado no verificable.');
   const keys=new Set(rows.map(catalogKey)),pageKeys=new Set();
   for(const product of response.rows){const row={...product,__store:shop},key=catalogKey(row);if(pageKeys.has(key)&&!catalogSearchTerm)throw Error('Producto repetido en una misma página.');pageKeys.add(key);if(keys.has(key))continue;keys.add(key);rows.push(row);}
   catalogMore.set(shop,!!response.possibly_more);
   if(!more&&(!catalogMeta.has(shop)||catalogMeta.get(shop).warnings?.length)){
    const meta={categories:[],brands:[],suppliers:[],taxGroups:[],warnings:[],tax:{countries:[],rules:[],taxes:[]}};
    const auxiliaryRead=async args=>{try{return await invokeShop(shop,'prestashop_read',args);}catch(error){if(!/connection closed|network|fetch failed|timed? ?out|timeout|HTTP (502|503|504)/i.test(String(error.message)))throw error;return invokeShop(shop,'prestashop_read',args);}};
    for(const [resource,key]of [['categories','categories'],['manufacturers','brands'],['suppliers','suppliers'],['tax_rule_groups','taxGroups'],['countries','countries'],['tax_rules','rules']]){
     try{const all=[];for(let p=0;p<=1000;p++){
      const data=await auxiliaryRead({resource,page:p,page_size:100});if(!Array.isArray(data.rows))throw Error('Respuesta incompleta');all.push(...data.rows);
      if(!data.possibly_more){if(['categories','brands','suppliers','taxGroups'].includes(key))meta[key]=all;else meta.tax[key]=all;break;}
      if(!data.rows.length||p===1000)throw Error('Catálogo auxiliar incompleto');
     }}catch{meta.warnings.push(resource);}
    }
    const country=meta.tax.countries.find(c=>String(c.iso_code).toUpperCase()==='ES'&&String(c.active)==='1');
    const taxIds=[...new Set(meta.tax.rules.filter(r=>country&&String(r.id_country)===String(country.id)).map(r=>String(r.id_tax)).filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
    for(const record_id of taxIds){try{const data=await auxiliaryRead({resource:'taxes',record_id,page:0,page_size:100});if(!Array.isArray(data.rows))throw Error('Respuesta incompleta');meta.tax.taxes.push(...data.rows);}catch{meta.warnings.push('taxes');}}
    catalogMeta.set(shop,meta);
   }
  }
  const selected=catalogMeta.get(store);catalogCategories=selected?.categories||[];catalogBrands=selected?.brands||[];catalogTaxContext=selected?.tax||{countries:[],rules:[],taxes:[]};
  hasMore=shops.some(shop=>catalogMore.get(shop));page++;
  if(stock)try{await loadCatalogStock();}catch{/* A failed read is not zero stock. */}
  status='Catálogo de '+(catalogScope==='both'?'ambas tiendas':catalogScope)+': '+rows.length+' productos consultados'+(hasMore?' (parcial).':'.');
  if(!catalogSearchTerm&&!hasMore)cacheCatalogue();
  if(!more&&!catalogSearchTerm&&hasMore){const version=prefetchVersion,scope=catalogScope;setTimeout(()=>{void prefetchCatalog(version,scope);},0);}
  const missing=[...new Set(shops.flatMap(shop=>catalogMeta.get(shop)?.warnings||[]))];if(missing.length)status+=' Lecturas auxiliares pendientes: '+missing.map(key=>({categories:'categorías',manufacturers:'marcas',suppliers:'proveedores',tax_rule_groups:'grupos de impuestos',countries:'países',tax_rules:'reglas de impuestos',taxes:'tipos de IVA'}[key]||key)).join(', ')+'. Los datos no comprobados figuran como Sin verificar; pulsa Actualizar para repetir la lectura.';
 }

 function rememberProductDraft(){
  if(record)draftsByProduct.set(store+'|'+(record.id||record.draft_key||textValue(record.reference)||'new'),structuredClone(snapshotDraft()));
 }
 async function refreshStoredProduct(){
  if(!record?.id)return true;
  const activeStore=store,activeId=String(record.id),activeEpoch=epoch;
  const fresh=normalizedProduct(await loadItem(activeStore,'products',activeId)).raw;
  const freshVariants=await combinations(activeStore,fresh);
  if(!current()||epoch!==activeEpoch||store!==activeStore||String(record?.id)!==activeId)return false;
  record=fresh;variants=freshVariants;shopRecords.set(activeStore,record);return true;
 }
 async function openProduct(id,shop=store,{keepCatalog=false}={}){
  rememberProductDraft();
  if(shop!==store||catalogScope==='both'){store=shop;if(!keepCatalog){catalogScope=shop;await loadCatalog(false);}else{const meta=catalogMeta.get(shop);catalogCategories=meta?.categories||[];catalogBrands=meta?.brands||[];catalogTaxContext=meta?.tax||{countries:[],rules:[],taxes:[]};}}
  const saved=draftsByProduct.get(store+'|'+id),queue=copyQueue;
  if(saved){restoreDraft(saved);copyQueue=queue;if(!await refreshStoredProduct())return;mode='ficha';status='Borrador del producto #'+id+' recuperado; ficha y '+variants.length+' combinaciones releídas.';return;}
  resetDraft();record=normalizedProduct(await loadItem(store,'products',id)).raw;
  shopRecords.clear();shopRecords.set(store,record);
  variants=await combinations(store,record);
  mode='ficha';targets=new Set(PRODUCT_STORES.map(s=>s.key).filter(s=>s!==store));status='Ficha #'+id+' y '+variants.length+' combinaciones leídas de '+store+'. Selecciona campos para preparar cambios.';
 }
 function freshProduct(){
  rememberProductDraft();
  if(catalogScope==='both'){catalogScope=store;rows=[];page=0;hasMore=false;}
  resetDraft();editorSection='general';record={draft_key:'draft-'+crypto.randomUUID(),...Object.fromEntries(Object.values(PRODUCT_SECTIONS).flat().map(field=>[field,''])),id:null,redirect_type:'404',id_type_redirected:'0',active:'0',minimal_quantity:'1',available_for_order:'0',show_price:'1',online_only:'0',on_sale:'0',visibility:'both',condition:'new'};
  fields=new Set(['name','reference','price','description','meta_title','link_rewrite']);
  targets=new Set([store]);mode='ficha';status='Borrador nuevo. Prepara los campos y después selecciona la tienda de destino.';
 }
 async function prepare(){
  if(!record)throw Error('Abre una ficha o prepara un producto nuevo.');
  if(!targets.size)throw Error('Selecciona alguna tienda de destino.');
  const plans=[],readTargets=new Map(),copyNotices=[];
  for(const dest of targets){
   if(createWizard.hasAttempted(dest)&&comparison.has(dest)){plans.push(comparison.get(dest));if(targetRaw.has(dest))readTargets.set(dest,targetRaw.get(dest));copyNotices.push(dest+': se conserva la copia ya iniciada');continue;}
   const adapted={...(targetOverrides.get(dest)||{})};
   if(dest!==store)for(const change of adaptProductTexts({...record,...overrides},store,dest).changes)if(fields.has(change.field)&&!Object.prototype.hasOwnProperty.call(adapted,change.field))adapted[change.field]=textValue(change.after);

   const redirect=productCopyRedirect({fields,source:record,overrides,adapted,crossStore:dest!==store});if(redirect.notice)copyNotices.push(dest+': '+redirect.notice);
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
   const matchedVariantIds=new Set();
   const selected=variants.filter(v=>(variantFields.get(keyFor(v))?.size||0)>0).map(v=>{
    const match=matchVariantInStore(v,related);if(match.status==='ambiguous')throw Error('Referencia o atributos de combinación ambiguos en '+dest+'.');if(match.variant){if(matchedVariantIds.has(String(match.variant.id)))throw Error('Dos combinaciones de origen coinciden con la misma combinación de destino. Revisa la selección.');matchedVariantIds.add(String(match.variant.id));}
    return {source:v,target:match.variant,fields:[...(variantFields.get(keyFor(v))||[])],overrides:variantOverrides.get(keyFor(v))||{}};
   });
   plans.push(buildProductPlan({source:record,target,store:dest,fields:redirect.fields,overrides:redirect.overrides,variants:selected}));
  }
  for(const [shop,item] of readTargets)shopRecords.set(shop,item);
  targetRaw=readTargets;comparison=new Map(plans.map(p=>[p.store,p]));preview=plans;mode='comparar';status='Propuesta preparada para '+plans.length+' tienda(s). Ningún dato se ha modificado.'+(copyNotices.length?' '+copyNotices.join(' '):'');
 }
 async function chooseCopyLanguage(dest){
  const ids=targetLanguageIds(dest,'name'),chosen=targetLanguages.get(dest)||{};if(LOCALIZED_PRODUCT_FIELDS.every(field=>chosen[field]))return;
  let languageId=ids.length===1?ids[0]:null,sourceId=null;
  if(!languageId){const original=await readShopCatalog(store,'languages'),destination=await readShopCatalog(dest,'languages'),sourceIds=record.__language_ids||[],active=original.filter(row=>String(row.active)==='1'&&sourceIds.includes(String(row.id))),sourceLanguage=sourceIds.length===1?original.find(row=>String(row.id)===sourceIds[0]):active.length===1?active[0]:null,matches=destination.filter(row=>row.iso_code&&row.iso_code===sourceLanguage?.iso_code&&ids.includes(String(row.id)));if(matches.length===1){languageId=String(matches[0].id);sourceId=String(sourceLanguage.id);}}
  if(languageId){for(const field of LOCALIZED_PRODUCT_FIELDS)if(!chosen[field])chosen[field]=languageId;targetLanguages.set(dest,chosen);
   if(sourceId){const plan=comparison.get(dest);for(const change of plan?.changes||[]){if(!LOCALIZED_PRODUCT_FIELDS.includes(change.field)||Object.hasOwn(overrides,change.field))continue;const raw=record[change.field],translations=Array.isArray(raw)?raw:raw?.language,translation=Array.isArray(translations)?translations.find(row=>String(row.id??row.language_id)===sourceId)?.value:raw;if(translation===undefined)continue;const adapted=adaptProductTexts({...record,[change.field]:translation},store,dest).changes.find(row=>row.field===change.field);change.after=adapted?textValue(adapted.after):textValue(translation);}}
  }
 }
 async function previewXml(dest){
  await chooseCopyLanguage(dest);
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
 async function readShopCatalog(shop,resource){const all=[];for(let page=0;;page++){const response=await invokeShop(shop,'prestashop_read',{resource,page,page_size:100,sort:'oldest'});if(!Array.isArray(response.rows))throw Error('No se pudo consultar '+resource);all.push(...response.rows);if(!response.possibly_more)return all;if(!response.rows.length||page>=1000)throw Error('Catálogo incompleto: '+resource);}}
 async function editDraftAttributes(id){
  const variant=variants.find(v=>keyFor(v)===id);if(!variant||variant.id)throw Error('Selecciona una variación nueva.');
  const shop=store,product=record.draft_key;let groups,values;await work(async()=>{groups=await readShopCatalog(shop,'product_options');values=await readShopCatalog(shop,'product_option_values');});if(store!==shop||record?.draft_key!==product||!groups||!values)return;const dialog=document.createElement('dialog');dialog.className='prd-select-dialog';dialog.innerHTML='<h3>Atributos de la variación</h3>'+attributeGroupSelectors(groups,values,associationIds(variant,'product_option_values'),{rowId:id})+'<button type="button" data-draft-attributes-done>Guardar selección</button>';
  dialog.onchange=event=>{event.stopPropagation();const group=event.target.dataset.prStageAttributeGroup;if(!group)return;const groupIds=new Set(values.filter(v=>String(v.id_attribute_group)===group).map(v=>String(v.id))),chosen=associationIds(variant,'product_option_values').filter(v=>!groupIds.has(v));if(event.target.value)chosen.push(event.target.value);variant.associations.product_option_values=chosen.map(id=>({id}));variant.__attributes=chosen.map(id=>{const value=values.find(v=>String(v.id)===id),group=groups.find(g=>String(g.id)===String(value.id_attribute_group));return {group:textValue(group.name),value:textValue(value.name)};});variant.__attributeNames=variant.__attributes.map(v=>v.group+': '+v.value);persistDraft();};
  dialog.querySelector('[data-draft-attributes-done]').onclick=()=>{dialog.close();render();};showProductDialog(root,dialog,{label:'Atributos de la variación'});
 }
 async function prepareDraftPhotos(files){
  const types=await readShopCatalog(store,'image_types'),type=types.find(t=>t.name==='large_default'&&String(t.products)==='1');if(!type)throw Error('No se ha verificado el tamaño de imagen de esta tienda.');
  for(const file of files)draftPhotos.push({_draftKey:crypto.randomUUID(),...await normalizeProductImage(file,{removeBackground:true,canvasSize:{width:Number(type.width),height:Number(type.height)}})});
  status=draftPhotos.length+' fotos preparadas; se enviarán al publicar.';
 }
 async function publishCurrent(){
  if(!canEdit())throw Error('No tienes permiso para publicar.');
  const includeVariants=publicationScope==='all',source={...record,...overrides,...(organization?.store===store?organization.fields:{}),__sourceStore:store};let plan;
  if(!record.id){
   const selected=includeVariants?variants.filter(v=>!v.id):[];
   for(const v of selected)if(!associationIds(v,'product_option_values').length)throw Error('Selecciona los atributos de '+(v.reference||'cada variación')+' antes de publicar.');
   plan=comparison.get(store);if(createWizard.hasAttempted(store)&&!createWizard.result(store))await createWizard.perform('create-verify',store,plan,source);if(!createWizard.result(store)){
    plan=buildProductPlan({source,target:null,store,fields:Object.values(PRODUCT_SECTIONS).flat().filter(key=>source[key]!==undefined&&source[key]!==''),variants:selected.map(v=>({source:{...v,...variantOverrides.get(keyFor(v)),...((variantOverrides.get(keyFor(v))?.quantity??'')!==''?{__stock:{quantity:String(variantOverrides.get(keyFor(v)).quantity),out_of_stock:'0',depends_on_stock:'0',location:''}}:{})},fields:VARIANT_FIELDS.filter(key=>(variantOverrides.get(keyFor(v))?.[key]??v[key])!==undefined&&(variantOverrides.get(keyFor(v))?.[key]??v[key])!=='')}))});
    comparison.set(store,plan);preview=[plan];targets=new Set([store]);if(!createWizard.hasProfile(store))await createWizard.perform('create-load',store,plan,source);if(organization?.store===store)createWizard.configureOrganization(store,plan,source,organization);await createWizard.perform('create-prepare',store,plan,source);await createWizard.perform('create-accept',store,plan,source);
   }

  }else{
   if(Object.keys(overrides).length){await reviewDirectProduct();editConfirm.set(store,'GUARDAR');await commitEdit(store);}
   if(includeVariants)for(const variant of variants.filter(v=>v.id&&Object.keys(variantOverrides.get(String(v.id))||{}).length)){await reviewDirectVariant(String(variant.id));editConfirm.set(store+'|'+variant.id,'GUARDAR');await commitVariant(store,String(variant.id));}
   await createWizard.openExisting(store,record);plan=comparison.get(store)||{operation:'update',store,target_id:String(record.id),changes:[],variants:[],warnings:[]};comparison.set(store,plan);
  }
  if(includeVariants){
   for(const stored of draftPhotos){const {_draftKey,...image}=stored;await createWizard.perform('create-stage-add',store,plan,source,{kind:'image',image,draftImageKey:_draftKey});}
   for(const variant of variants.filter(v=>!v.id)){const values={...variant,...variantOverrides.get(keyFor(variant))};await createWizard.perform('create-stage-add',store,plan,source,{kind:'variation',draftVariantKey:variant.draft_key,draftFields:Object.fromEntries(VARIANT_FIELDS.filter(field=>values[field]!==undefined&&values[field]!=='').map(field=>[field,values[field]])),attributes:associationIds(variant,'product_option_values'),draftImageKeys:variant.__draftImageKeys,sourceStock:values.quantity!==undefined&&values.quantity!==''?{quantity:String(values.quantity),out_of_stock:'0',depends_on_stock:'0',location:''}:null});}
  }
  if(record.id&&organization?.store===store){await createWizard.perform('create-stage-add',store,plan,source,{kind:'finish',finishFields:organization.fields,finishAssociations:{categories:organization.categories,tags:organization.tags,accessories:organization.related,product_features:organization.features}});}
  status=await createWizard.perform('create-stage-publish',store,plan,source,{includeVariants});
  const remainingDrafts=includeVariants?[]:variants.filter(v=>!v.id),saved=createWizard.result(store);record=await loadItem(store,'products',saved.record_id);variants=[...await combinations(store,record),...remainingDrafts];overrides={};if(includeVariants){draftPhotos=[];variantOverrides.clear();}targetRaw.set(store,record);shopRecords.set(store,record);inlineStage=false;mode='ficha';status='Producto #'+record.id+' publicado en '+store+' y releído; '+variants.length+' combinaciones verificadas.';
 }
 function newVariant(){
  if(!record)throw Error('Crea o abre una ficha primero.');
  const item={draft_key:'draft-'+crypto.randomUUID(),reference:'',price:'',weight:'',ean13:'',minimal_quantity:'1',associations:{product_option_values:[]}};
  variants.push(item);variantFields.set(keyFor(item),new Set(['reference','price','minimal_quantity']));status='Variación de borrador añadida. Sus atributos requerirán correspondencia en destino.';
 }
 async function mount(node){
  ensureStitchProductFonts();
  dispose();tableEditor.restore([]);draftsByShop.clear();draftsByProduct.clear();copyQueue=[];storageReady=false;root=node;productPickerQuery='';productPickerPage=0;owner=actor();if(cacheOwner!==owner){catalogCache.clear();cacheOwner=owner;}if(requestOwner!==owner){requestBrief={operation:'url',store:'hortimatic'};requestOutput='';requestOwner=owner;}const gen=++epoch;root.dataset.prEpoch=String(gen);mode='catalogo';store='hortimatic';catalogScope='hortimatic';catalogMeta.clear();creationMetadata.clear();productLanguages.clear();catalogMore.clear();catalogSelected.clear();catalogStock.clear();catalogFilters={category:'',brand:'',active:''};try{catalogColumns=productColumns(JSON.parse(localStorage.getItem('totus-products-columns:'+owner)||'null'));}catch{catalogColumns=[...DEFAULT_PRODUCT_COLUMNS];}try{columnWidths=productColumnWidths(JSON.parse(localStorage.getItem('totus-products-widths:'+owner)||'null'));}catch{columnWidths={};}layoutSaveState='Distribución personal: los cambios se guardan automáticamente.';catalogViewName='';try{catalogViews=JSON.parse(localStorage.getItem('totus-products-views:'+owner)||'[]').filter(v=>v&&typeof v.name==='string'&&Array.isArray(v.columns)&&[10,20,50,100,Number.MAX_SAFE_INTEGER].includes(v.size)).map(v=>({...v,columns:productColumns(v.columns),filters:{category:v.filters?.category||'',brand:v.filters?.brand||'',active:['0','1'].includes(v.filters?.active)?v.filters.active:''}}));}catch{catalogViews=[];}status='Comprobando conexiones. Ningún dato se modifica.';rows=[];page=0;hasMore=false;resetDraft();
  if(!allowed()){root.textContent='No tienes permiso de consulta de PrestaShop.';return;}
  root.ondblclick=e=>{const cell=e.target.closest('[data-pr-quick-field]');if(cell&&!e.target.closest('input,select,textarea,button,a'))openQuickCell(cell);};
  root.ondragover=e=>{if(e.target.closest('[data-pr-image-drop]')){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';}};
  root.ondrop=e=>{if(!e.target.closest('[data-pr-image-drop]'))return;e.preventDefault();const files=Array.from(e.dataTransfer?.files||[]);if(!files.length)return;void work(async()=>{
   if(!record?.id){await prepareDraftPhotos(files);return;}
   const fresh=await loadItem(store,'products',String(record.id));await createWizard.openExisting(store,fresh);
   const plan={operation:'update',store,source_id:String(record.id),target_id:String(record.id),changes:[],variants:[],warnings:[]};comparison.set(store,plan);preview=[plan];targetRaw.set(store,fresh);targets=new Set([store]);
   await createWizard.perform('create-stage-tab',store,plan,fresh,{tab:'image'});inlineStage=true;mode='ficha';editorSection='imagenes';
   for(const file of files){await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'image'});render();const input=[...root.querySelectorAll('[data-pr-stage-file]')].at(-1);status=await createWizard.handleFile({files:[file],dataset:{...input.dataset}});}
   status=files.length+' fotos preparadas. Revisa, valida y guarda cada imagen antes de enviarla a la tienda.';
  });};
  root.oninput=e=>{if(e.target.matches('[data-pr-category-search]')&&organization){organization.categoryQuery=e.target.value;organization.categoryPage=0;persistDraft();render();return;}
   if(replacingDOM)return;
   if(e.target.matches('[data-pr-columns-search]')){for(const label of root.querySelectorAll('[data-pr-column-option]'))label.hidden=!label.textContent.toLocaleLowerCase('es').includes(e.target.value.toLocaleLowerCase('es'));return;}
   if(e.target.matches('[data-pr-request]')){requestBrief[e.target.dataset.prRequest]=e.target.value;requestOutput='';const prompt=root.querySelector('[aria-label="Encargo completo para ChatGPT"]');if(prompt){prompt.value='';prompt.textContent='';}const copy=root.querySelector('[data-pr-action="request-copy"]');if(copy)copy.disabled=true;persistDraft();return;}
   if(e.target.matches('[data-pr-picker-search]')){productPickerQuery=e.target.value;productPickerPage=0;render();queueCatalogSearch(productPickerQuery);return;}
   if(e.target.matches('[data-pr-create-language],[data-pr-create-field="reference"],[data-pr-create-field="related_reference"]')&&createWizard.handleChange(e.target)){persistDraft();root.querySelectorAll('.prd-create-confirm').forEach(n=>n.hidden=true);return;}
   if(e.target.matches('[data-pr-table-position]')){const viewport=root.querySelector('.prd-catalog-table');if(viewport)viewport.scrollLeft=(viewport.scrollWidth-viewport.clientWidth)*Number(e.target.value)/1000;return;}if(e.target.matches('[data-pr-create-confirm],[data-pr-create-retry-confirm],[data-pr-stage-remove-confirm]')&&createWizard.handleChange(e.target)){syncWizardTextControls(e.target);return;}if(e.target.matches('[data-pr-search]')){query=e.target.value;listPage=0;render();queueCatalogSearch(query);const f=root.querySelector('[data-pr-search]');f?.focus();f?.setSelectionRange(query.length,query.length);}};
  root.onchange=e=>{
   if(e.target.matches('[data-pr-publication-scope]')){publicationScope=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-draft-files]')){const files=[...e.target.files];void work(()=>prepareDraftPhotos(files));return;}

   if(replacingDOM)return;
   if(e.target.matches('[data-pr-column-position]')){moveCatalogColumn(e.target.dataset.prColumnPosition,Number(e.target.value));return;}
   if(e.target.matches('[data-pr-picker-size]')){productPickerSize=Number(e.target.value);productPickerPage=0;render();return;}
   if(e.target.matches('[data-pr-picker-page]')){productPickerPage=Math.max(0,Number(e.target.value)-1);render();return;}
   if(e.target.matches('[data-pr-page-number]')){listPage=Math.max(0,Math.min(Number(e.target.value)-1,Math.ceil(visibleCatalog().length/listSize)-1));void work(loadCatalogStock);return;}

   if(e.target.matches('[data-pr-fiche-language]')){directLanguage=e.target.value;preflight.delete(store);render();return;}
   if(e.target.matches('[data-pr-table-field]')){try{tableEditor.change(e.target.dataset.prShop,e.target.dataset.prId,e.target.dataset.prTableField,e.target.value);persistDraft();}catch(err){status=err.message;render();}return;}
   if(e.target.matches('[data-pr-table-language]')){try{tableEditor.language(e.target.dataset.prShop,e.target.dataset.prId,e.target.value);persistDraft();}catch(err){status=err.message;render();}return;}
   if(e.target.matches('[data-pr-org-list]')&&organization){organization[e.target.dataset.prOrgList]=[...e.target.selectedOptions].map(o=>o.value);persistDraft();return;}
   if(e.target.matches('[data-pr-category-size]')&&organization){organization.categorySize=Number(e.target.value);organization.categoryPage=0;persistDraft();render();return;}
   if(e.target.matches('[data-pr-feature]')&&organization){const feature_id=e.target.dataset.prFeature;organization.features=organization.features.filter(row=>row.feature_id!==feature_id);if(e.target.value)organization.features.push({feature_id,value_id:e.target.value});persistDraft();return;}
   if(e.target.matches('[data-pr-org-features]')&&organization){organization.features=[...e.target.selectedOptions].map(o=>{const [feature_id,value_id]=o.value.split(':');return {feature_id,value_id};});persistDraft();return;}
   if(e.target.matches('[data-pr-org-related]')&&organization){organization.relatedReference=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-margin]')){try{const cost=productInputValue('price',overrides.wholesale_price??textValue(record.wholesale_price)),margin=productInputValue('price',e.target.value);overrides.price=productPriceForMargin(cost,margin).toFixed(6);fields.add('price');invalidate();status='Precio base preparado con el margen sobre venta solicitado. El coste y el margen son aproximados; revisa antes de guardar.';}catch(error){status=error.message;}render();return;}
   if(e.target.matches('[data-pr-tax-group],[data-pr-fiche-organization]')){const id=e.target.value,field=e.target.dataset.prFicheOrganization||'id_tax_rules_group';if(!record?.id){overrides[field]=id;persistDraft();render();return;}void work(async()=>{const fresh=await loadItem(store,'products',String(record.id));record=normalizedProduct(fresh).raw;shopRecords.set(store,record);if(!organization||organization.store!==store||organization.id!==String(record.id))await loadOrganization();organization.fields[field]=id;await createWizard.openExisting(store,record);const plan={operation:'update',store,source_id:String(record.id),target_id:String(record.id),changes:[],variants:[],warnings:[]};comparison.set(store,plan);preview=[plan];targetRaw.set(store,record);targets=new Set([store]);await createWizard.perform('create-stage-tab',store,plan,record,{tab:'finish'});status=await createWizard.perform('create-stage-add',store,plan,record,{kind:'finish',finishFields:{[field]:id}});inlineStage=true;mode='ficha';status+=' Revisa y guarda el cambio seleccionado antes de aplicarlo.';});return;}
   if(e.target.matches('[data-pr-gross]')){const rate=productCountryTaxRate(record.id_tax_rules_group,catalogTaxContext),gross=Number(productInputValue('price',e.target.value));if(!e.target.value.trim()||rate===null||productDisplayAmounts(record,rate).gross===null||!Number.isFinite(gross)||gross<0){status='Indica un PVP válido y verifica el grupo de impuestos.';render();return;}overrides.price=(gross/(1+rate/100)).toFixed(6);fields.add('price');invalidate();status='PVP convertido a precio base usando el impuesto verificado de la tienda. Revisa antes de guardar.';render();return;}
   if(e.target.matches('[data-pr-org]')&&organization){organization.fields[e.target.dataset.prOrg]=e.target.value;if(e.target.dataset.prOrg==='id_category_default'&&!organization.categories.includes(e.target.value))organization.categories.push(e.target.value);persistDraft();render();return;}
   if(e.target.matches('[data-pr-org-category]')&&organization){const id=e.target.dataset.prOrgCategory;organization.categories=e.target.checked?[...new Set([...organization.categories,id])]:organization.categories.filter(x=>x!==id);if(!e.target.checked&&organization.fields.id_category_default===id)organization.fields.id_category_default='0';persistDraft();render();return;}
   if(e.target.matches('[data-pr-view-name]')){catalogViewName=e.target.value.trim().slice(0,60);return;}
   if(e.target.matches('[data-pr-catalog-view]')){const v=catalogViews.find(v=>v.name===e.target.value);if(v){void work(async()=>{if(['hortimatic','newoldsmok','both'].includes(v.scope)&&v.scope!==catalogScope)await switchStore(v.scope);catalogColumns=productColumns(v.columns);if(v.widths)columnWidths=productColumnWidths(v.widths);catalogFilters={...v.filters};query=v.query||'';listSize=v.size;listPage=0;catalogViewName=v.name;saveCatalogPreferences();await loadCatalogStock();});}return;}
   if(e.target.matches('[data-pr-request]')){requestBrief[e.target.dataset.prRequest]=e.target.value;requestOutput='';if(['operation','store'].includes(e.target.dataset.prRequest))render();else persistDraft();return;}
   if(e.target.matches('[data-pr-price-option]')){priceOptions[e.target.dataset.prPriceOption]=e.target.value;render();return;}
   if(pending||!current())return;
   if(e.target.matches('[data-pr-bulk-field]')){bulkField=e.target.value;bulkItems=[];bulkConfirm='';render();return;}
   if(e.target.matches('[data-pr-bulk-value]')){bulkValue=e.target.value;bulkItems=[];bulkConfirm='';persistDraft();return;}
   if(e.target.matches('[data-pr-bulk-confirm]')){bulkConfirm=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-edit-confirm]')){editConfirm.set(e.target.dataset.prEditConfirm,e.target.value);return;}
   if(e.target.matches('[data-pr-stage-file]')){const input={files:Array.from(e.target.files||[]),dataset:{...e.target.dataset}};void work(async()=>{status=await createWizard.handleFile(input);});return;}
   if(e.target.matches('[data-pr-column]')){const key=e.target.dataset.prColumn;catalogColumns=productColumns(e.target.checked?[...catalogColumns,key]:catalogColumns.filter(k=>k!==key));saveCatalogPreferences();if(key==='creator'&&e.target.checked)setTimeout(()=>{void work(loadCreationMetadata);},0);else render();return;}
   if(e.target.matches('[data-pr-filter]')){catalogFilters[e.target.dataset.prFilter]=e.target.value;listPage=0;void work(()=>loadCatalogStock());return;}
   if(e.target.matches('[data-pr-catalog-select]')){const id=e.target.dataset.prCatalogSelect;e.target.checked?catalogSelected.add(id):catalogSelected.delete(id);activateSingleSelection();return;}
   if(e.target.matches('[data-pr-catalog-loaded]')){for(const r of visibleCatalog())e.target.checked?catalogSelected.add(catalogKey(r)):catalogSelected.delete(catalogKey(r));activateSingleSelection();return;}
   if(e.target.matches('[data-pr-catalog-all]')){for(const r of visibleCatalog().slice(listPage*listSize,(listPage+1)*listSize))e.target.checked?catalogSelected.add(catalogKey(r)):catalogSelected.delete(catalogKey(r));activateSingleSelection();return;}
   if(e.target.matches('[data-pr-page-size]')){listSize=Number(e.target.value);listPage=0;void work(async()=>{await loadCatalog(false);if(listSize===Number.MAX_SAFE_INTEGER)while(hasMore)await loadCatalog(true,{stock:false});await loadCatalogStock();});return;}
   if(createWizard.handleChange(e.target)){if(e.target.matches('input:not([type=checkbox]):not([type=radio]):not([type=file]),textarea'))syncWizardTextControls(e.target);else render();return;}
   if(e.target.matches('[data-pr-store]')){const next=e.target.value;void work(()=>switchStore(next));return;}
   if(e.target.matches('[data-pr-target]')){e.target.checked?targets.add(e.target.dataset.prTarget):targets.delete(e.target.dataset.prTarget);invalidate();render();return;}
   if(e.target.matches('[data-pr-field]')){const field=e.target.dataset.prField;e.target.checked?fields.add(field):fields.delete(field);if(!e.target.checked){delete overrides[field];for(const values of targetOverrides.values())delete values[field];}invalidate();render();return;}
   if(e.target.matches('[data-pr-value]')){fields.add(e.target.dataset.prValue);overrides[e.target.dataset.prValue]=productInputValue(e.target.dataset.prValue,e.target.value);for(const dest of targets)if(!Object.hasOwn(targetOverrides.get(dest)||{},e.target.dataset.prValue))createWizard.syncField(dest,e.target.dataset.prValue,overrides[e.target.dataset.prValue]);invalidate();if(['price','wholesale_price'].includes(e.target.dataset.prValue))render();else persistDraft();return;}
   if(e.target.matches('[data-pr-existing-id]')){targetIds.set(e.target.dataset.prExistingId,e.target.value);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-target-field]')){const dest=e.target.dataset.prTargetStore,field=e.target.dataset.prTargetField,values=targetOverrides.get(dest)||{};targets.add(dest);fields.add(field);values[field]=e.target.value;targetOverrides.set(dest,values);createWizard.syncField(dest,field,e.target.value);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-lang-store]')){const dest=e.target.dataset.prLangStore,field=e.target.dataset.prLangField,values=targetLanguages.get(dest)||{};values[field]=e.target.value;targetLanguages.set(dest,values);preflight.clear();persistDraft();return;}
   if(e.target.matches('[data-pr-copy-variant]')){const id=e.target.dataset.prCopyVariant,variant=variants.find(v=>keyFor(v)===id);if(variant){variantFields.set(id,new Set(e.target.checked?VARIANT_FIELDS.filter(f=>variant[f]!==undefined&&variant[f]!==null):[]));invalidate();render();persistDraft();}return;}
   if(e.target.matches('[data-pr-vfield]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVfield,set=variantFields.get(id)||new Set();e.target.checked?set.add(field):set.delete(field);variantFields.set(id,set);invalidate();render();return;}
   if(e.target.matches('[data-pr-vvalue]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVvalue,values=variantOverrides.get(id)||{},chosen=variantFields.get(id)||new Set();chosen.add(field);variantFields.set(id,chosen);values[field]=e.target.value;variantOverrides.set(id,values);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-bulk]')){e.target.checked?selection.add(e.target.dataset.prBulk):selection.delete(e.target.dataset.prBulk);bulkItems=[];bulkConfirm='';render();}
  };
  root.onkeydown=e=>{
   if(e.target.closest('[data-pr-resize-column]'))return;
   if(e.key==='Enter'&&e.target.matches('[data-pr-quick-field]')){e.preventDefault();openQuickCell(e.target);return;}
   const cell=e.target.closest('.prd-catalog-table td,.prd-catalog-table th,.prd-table-viewport td,.prd-table-viewport th');if(cell&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)&&(!e.target.matches('input,textarea,select')||e.altKey)&&!e.ctrlKey&&!e.metaKey){const row=cell.parentElement,table=row.closest('table'),rs=[...table.rows],cells=[...row.cells];let y=rs.indexOf(row),x=cells.indexOf(cell);if(e.key==='ArrowLeft')x--;if(e.key==='ArrowRight')x++;if(e.key==='ArrowUp')y--;if(e.key==='ArrowDown')y++;if(e.key==='Home')x=0;if(e.key==='End')x=cells.length-1;const target=rs[Math.max(0,Math.min(y,rs.length-1))]?.cells[Math.max(0,Math.min(x,cells.length-1))];if(target){e.preventDefault();target.focus();target.scrollIntoView({block:'nearest',inline:'nearest'});if(['Home','End'].includes(e.key)){const viewport=table.closest('.prd-catalog-table,.prd-table-viewport');if(viewport){if(e.key==='Home')viewport.scrollLeft=0;else if(viewport.matches('.prd-catalog-table'))viewport.scrollLeft+=(target.querySelector('button,a,input,select')||target).getBoundingClientRect().left-viewport.getBoundingClientRect().left;}}}return;}
if(['Enter',' '].includes(e.key)&&e.target.matches('[data-pr-action="photo-zoom"], [data-pr-image-drop]')){e.preventDefault();e.target.click();return;}if(e.key==='Escape'){for(const panel of root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]')){panel.open=false;panel.querySelector('summary')?.focus();}}};
  root.onclick=e=>{if(!e.target.closest('.prd-columns,.prd-row-menu'))root.querySelectorAll('.prd-columns[open],.prd-row-menu[open]').forEach(d=>d.open=false);const b=e.target.closest('[data-pr-action]');if(!b||!current())return;const a=b.dataset.prAction;
   if(a==='backend-config'){const shop=b.dataset.prShop,id=b.dataset.prId,dialog=document.createElement('dialog');dialog.className='prd-photo-dialog prd-backoffice-dialog';dialog.innerHTML='<form><h3>Administración · '+h(PRODUCT_STORES.find(s=>s.key===shop).label)+'</h3><p>PrestaShop protege sus enlaces de edición con un token de navegación. Abre Catálogo → Productos en su administración y pega la dirección completa. El enlace de Inicio no sirve.</p><label>Enlace del catálogo o de una ficha<input type="url" name="link" required autocomplete="off" placeholder="https://'+(shop==='hortimatic'?'hortimatic.com':'newoldsmok.com')+'/admin777/index.php/sell/catalog/products?..."></label><p>Se conserva solo en esta sesión del navegador y esta cuenta. No se guarda en los productos, el servidor ni las exportaciones. Al caducar tu sesión de PrestaShop, actualízalo aquí.</p><p role="status" data-link-error></p><div class="inline-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Guardar enlace de esta sesión</button></div></form>';dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{event.preventDefault();try{saveBackofficeLink(new FormData(event.target).get('link'),shop,owner);dialog.close();status='Acceso de administración vinculado para esta sesión. Pulsa de nuevo Abrir en administración.';render();}catch(error){dialog.querySelector('[data-link-error]').textContent=error.message;}};showProductDialog(root,dialog,{label:'Acceso a la administración de '+shop,trigger:b});return;}
   if(a==='catalog-columns-prices'||a==='catalog-columns-default'||a==='catalog-columns-all'){catalogColumns=a==='catalog-columns-all'?PRODUCT_COLUMNS.map(([key])=>key):a==='catalog-columns-prices'?['image','name','id','reference','cost','costVat','costTotal','price','gross','marginTotal','margin']:[...DEFAULT_PRODUCT_COLUMNS];saveCatalogPreferences();render();if(catalogColumns.includes('creator'))void work(loadCreationMetadata);return;}
   if(a==='picker-focus'){root.querySelector('[data-pr-picker-search]')?.focus();return;}
   if(a==='picker-clear'){clearTimeout(catalogSearchTimer);productPickerQuery='';query='';productPickerPage=0;catalogSearchTerm='';void work(()=>loadCatalog(false));root.querySelector('[data-pr-picker-search]')?.focus();return;}
   if(a==='picker-page'){void work(async()=>{const next=Math.max(0,productPickerPage+Number(b.dataset.direction));if(next*productPickerSize>=rows.filter(p=>(p.__store||store)===store).length&&hasMore)await loadCatalog(true);productPickerPage=next;});return;}
   if(a==='picker-catalog'){mode='catalogo';render();return;}
   if(a==='picker-open'){const nextMode=mode==='comparar'?'comparar':'ficha';void work(async()=>{await openProduct(b.dataset.id,b.dataset.prShop,{keepCatalog:true});mode=nextMode;});return;}
   if(a==='catalog-activate'){catalogSelected=new Set([b.dataset.prShop+'|'+b.dataset.id]);activateCatalogProduct(b.dataset.id,b.dataset.prShop);return;}
   if(a==='catalog-cancel'){catalogCancel=true;status='Se detendrá la consulta al terminar la página actual.';return;}
   if(a==='variant-scroll'){root.querySelector('.prd-table-viewport')?.scrollBy({left:Number(b.dataset.direction)*Math.max(240,root.querySelector('.prd-table-viewport').clientWidth*.7),behavior:'smooth'});return;}
   if(a==='catalog-clear-filters'){clearTimeout(catalogSearchTimer);query='';productPickerQuery='';catalogSearchTerm='';catalogFilters={category:'',brand:'',active:''};listPage=0;void work(()=>loadCatalog(false));return;}
   if(a==='catalog-find'){void work(async()=>{const exact=query.trim();if(!exact)throw Error('Escribe un ID o una referencia exacta en el buscador.');const shops=catalogScope==='both'?PRODUCT_STORES.map(s=>s.key):[catalogScope];let found=0;for(const shop of shops){const data=await invokeShop(shop,'prestashop_read',{resource:'products',page:0,page_size:100,...(/^\d+$/.test(exact)?{product_ids:[exact]}:{references:[exact]})});if(data.possibly_more)throw Error('La referencia tiene más resultados; consulta el catálogo completo.');for(const item of data.rows){const row={...item,__store:shop},i=rows.findIndex(p=>catalogKey(p)===catalogKey(row));if(i<0)rows.push(row);else rows[i]=row;found++;}}listPage=0;await loadCatalogStock();status=found?found+' productos encontrados en la tienda por ID o referencia exacta.':'No hay coincidencias por ID o referencia exacta. Para buscar por nombre, consulta todo el catálogo.';});return;}
   if(a==='catalog-complete'){void work(async()=>{catalogCancel=false;while(hasMore&&!catalogCancel){await loadCatalog(true,{stock:false});status=rows.length+' productos consultados. Puedes detener la consulta después de esta página.';render();const cancel=document.createElement('button');cancel.type='button';cancel.dataset.prAction='catalog-cancel';cancel.textContent='Detener consulta';root.querySelector('.prd-catalog-loading')?.append(cancel);}await loadCatalogStock();status=catalogCancel?'Consulta detenida: '+rows.length+' productos cargados; quedan páginas.':'Catálogo completo consultado: '+rows.length+' productos.';});return;}
   if(a==='catalog-scroll'){const table=root.querySelector('.prd-catalog-table');if(table)table.scrollBy({left:Number(b.dataset.direction)*Math.max(240,table.clientWidth*.7),behavior:'smooth'});return;}
   if(a==='table-archive'){void openQuickEditor(b.dataset.prShop,b.dataset.prId,b,null,true);return;}
   if(a==='table-open'){void openQuickEditor(b.dataset.prShop,b.dataset.prId,b);return;}
   if(a.startsWith('table-')){const shop=b.dataset.prShop,id=b.dataset.prId;void work(async()=>{if(a==='table-discard'){tableEditor.discard(shop,id);status='Cambios de la fila descartados.';}if(a==='table-prepare'){await tableEditor.prepare(shop,id);status='Cambios de la fila revisados. Puedes guardarlos.';}if(a==='table-recover'){await tableEditor.reviewRecovery(shop,id);status='Recuperación revisada con la misma solicitud. Comprueba los cambios antes de reintentar.';}if(a==='table-save'){await tableEditor.save(shop,id);status='Producto #'+id+' guardado y releído en '+shop+'.';}});return;}
   if(a==='product-duplicate'){void work(async()=>{if(!canCreate())throw Error('No tienes permiso para crear productos.');await openProduct(b.dataset.prId,b.dataset.prShop);fields=new Set(Object.values(PRODUCT_SECTIONS).flat().filter(f=>record[f]!==undefined&&record[f]!==null));for(const v of variants)variantFields.set(keyFor(v),new Set(VARIANT_FIELDS.filter(f=>v[f]!==undefined&&v[f]!==null)));const newRef=(textValue(record.reference).slice(0,42)||'PRODUCTO')+'-COPIA';overrides.reference=newRef;overrides.name=textValue(record.name)+' · copia';overrides.active='0';overrides.available_for_order='0';targets=new Set([store]);mode='comparar';invalidate();status='Duplicado preparado en borrador. Cambia la referencia por una nueva y revisa los campos y combinaciones antes de crear.';});return;}
   if(a==='product-remove'){void work(async()=>{if(!canDelete())throw Error('No tienes permiso para borrar productos.');await openProduct(b.dataset.prId,b.dataset.prShop);await createWizard.openExisting(store,record);const plan={operation:'update',store,source_id:String(record.id),target_id:String(record.id),changes:[],variants:[],warnings:[]};comparison.set(store,plan);preview=[plan];targets=new Set([store]);await createWizard.perform('create-stage-tab',store,plan,record,{tab:'remove_product'});status=await createWizard.perform('create-stage-add',store,plan,record,{kind:'remove_product',record_id:String(record.id)});inlineStage=true;mode='ficha';});return;}
   if(a==='catalog-column-move'){moveCatalogColumn(b.dataset.prColumnKey,catalogColumns.indexOf(b.dataset.prColumnKey)+Number(b.dataset.prDirection));return;}
   if(a==='catalog-widths-reset'){columnWidths={};saveCatalogPreferences();render();return;}
   if(a==='catalog-team-views'){const account=owner;void openTableViewProfiles({root,trigger:b,rpc,table:'products',current:()=>current()&&owner===account,layout:()=>({columns:[...catalogColumns],widths:{...columnWidths}}),onApply:async(layout,name)=>{catalogColumns=productColumns(layout.columns);columnWidths=productColumnWidths(layout.widths);catalogViewName=name;catalogViews=catalogViews.filter(v=>v.name!==name);catalogViews.push({name,columns:[...catalogColumns],widths:{...columnWidths},scope:catalogScope,filters:{...catalogFilters},query,size:listSize});saveCatalogPreferences();await layoutQueue;render();}});return;}
   if(a==='catalog-layout-sync'){saveCatalogPreferences();render();return;}
   if(a==='catalog-view-save'){const name=(root.querySelector('[data-pr-view-name]')?.value||'').trim().slice(0,60);if(!name){status='Escribe un nombre para guardar la vista.';render();return;}const v={name,columns:[...catalogColumns],widths:{...columnWidths},scope:catalogScope,filters:{...catalogFilters},query,size:listSize};catalogViews=catalogViews.filter(v=>v.name!==name);catalogViews.push(v);catalogViewName=name;saveCatalogPreferences();status='Vista «'+name+'» guardada para esta cuenta.';render();return;}
   if(a==='catalog-view-delete'){catalogViews=catalogViews.filter(v=>v.name!==catalogViewName);catalogViewName='';saveCatalogPreferences();render();return;}
   if(a==='draft-delete'){const key=b.dataset.prDraftKey,candidate=savedDraftCards().find(d=>d.key===key);if(!candidate||candidate.sent){status='Este registro contiene operaciones enviadas y conserva su historial.';render();return;}if(!confirm('Eliminar este borrador local sin enviar. El producto de la tienda no se borra.'))return;draftsByProduct.delete(key);for(const [shop,d]of draftsByShop){if(shop+'|'+(d.record?.id||d.record?.draft_key||textValue(d.record?.reference)||'new')===key)draftsByShop.delete(shop);}if(record&&store+'|'+(record.id||record.draft_key||'new')===key)resetDraft();status='Borrador local eliminado. La tienda no ha cambiado.';render();return;}
   if(a==='draft-purge'){const candidates=savedDraftCards().filter(d=>d.canPurge);if(!candidates.length){status='No hay borradores antiguos sin operaciones enviadas.';render();return;}if(!confirm('Eliminar '+candidates.length+' borradores locales de más de 30 días, sin operaciones enviadas: '+candidates.map(d=>d.name||d.reference||d.key).join(', ')+'. No borra productos ni datos de tienda.'))return;for(const candidate of candidates){draftsByProduct.delete(candidate.key);for(const [shop,d]of draftsByShop){const key=shop+'|'+(d.record?.id||d.record?.draft_key||textValue(d.record?.reference)||'new');if(key===candidate.key)draftsByShop.delete(shop);}}status=candidates.length+' borradores antiguos retirados. Los productos y operaciones de tienda se conservan.';render();return;}
   if(a==='draft-open'){void work(async()=>{rememberProductDraft();const key=b.dataset.prDraftKey,saved=draftsByProduct.get(key);if(!saved)throw Error('Este borrador ya no está disponible.');const queue=copyQueue;restoreDraft(structuredClone(saved));copyQueue=queue;catalogScope=store;await loadCatalog(false);if(record?.id&&!await refreshStoredProduct())return;mode='ficha';status='Borrador recuperado; se conservan sus solicitudes y cambios pendientes.';});return;}
   if(a==='copy-reverse'){void work(async()=>{if(!record?.id)throw Error('Selecciona primero una ficha guardada.');const dest=PRODUCT_STORES.find(s=>s.key!==store).key,ref=textValue(record.reference);if(!ref)throw Error('Falta referencia para buscar la ficha de la otra tienda.');const result=await invokeShop(dest,'prestashop_read',{resource:'products',references:[ref],page:0,page_size:100});if(result.possibly_more)throw Error('La búsqueda de correspondencia está incompleta.');const match=matchExactReference(result.rows,ref);if(!match.product)throw Error('No existe una ficha única en la otra tienda para usarla como origen.');await openProduct(match.product.id,dest);mode='comparar';});return;}
   if(a==='draft-save'){persistDraft();void storageQueue.then(()=>{if(current()){status=storageError?'No se ha podido guardar el borrador local.':'Borrador guardado para esta cuenta.';render();}});return;}
   if(a==='organization-related'){void work(async()=>{if(!organization?.relatedReference?.trim())throw Error('Indica la referencia exacta del producto relacionado.');const response=await invokeShop(store,'prestashop_read',{resource:'products',references:[organization.relatedReference.trim()],page:0,page_size:100});if(response.possibly_more)throw Error('Consulta de referencia incompleta.');const match=matchExactReference(response.rows,organization.relatedReference);if(!match.product||String(match.product.id)===String(record.id))throw Error('Selecciona una referencia única de otro producto de esta tienda.');organization.related=[...new Set([...organization.related,String(match.product.id)])];organization.catalog.related_products=[...organization.catalog.related_products.filter(p=>String(p.id)!==String(match.product.id)),match.product];organization.relatedReference='';status='Producto relacionado añadido al borrador.';});return;}
   if(a==='category-page'){if(organization)organization.categoryPage=Math.max(0,Number(b.dataset.prPage)||0);render();return;}
   if(a==='category-clear'){if(organization)organization.categoryQuery='';render();return;}
   if(a==='organization-primary'){void work(async()=>{const id=b.dataset.prCategory;if(!organization||organization.store!==store||organization.id!==String(record.id))await loadOrganization();if(!organization.categories.includes(id))throw Error('La categoría no está asociada a este producto.');organization.fields.id_category_default=id;status='Categoría principal seleccionada en el borrador. Revisa y guarda organización para aplicarla.';});return;}
   if(a==='organization-load'){void work(loadOrganization);return;}
   if(a==='description-format'){
    const input=root.querySelector('#sub-desc [data-pr-value="description"]');if(!input)return;
    let start=input.selectionStart,end=input.selectionEnd;const value=input.value,format=b.dataset.prFormat;if(format==='plain'&&start===end){start=0;end=value.length;}const selected=value.slice(start,end);
    const inserted=format==='bold'?'<strong>'+selected+'</strong>':format==='list'?'<ul>'+selected.split(/\n/).filter(Boolean).map(line=>'<li>'+h(line)+'</li>').join('')+'</ul>':selected.replace(/<[^>]*>/g,'');
    input.setRangeText(inserted,start,end,'select');input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();return;
   }
   if(a==='description-preview'){
    const body=textValue(overrides.description??record?.description),dialog=document.createElement('dialog');dialog.className='prd-description-dialog';
    const close=document.createElement('button');close.type='button';close.textContent='Cerrar vista previa';close.onclick=()=>dialog.close();
    const frame=document.createElement('iframe');frame.title='Descripción del producto';frame.setAttribute('sandbox','');frame.referrerPolicy='no-referrer';frame.srcdoc='<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src https: data:; style-src \'unsafe-inline\';"><style>body{font:15px/1.6 Arial;padding:20px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%}</style></head><body>'+body+'</body></html>';
    dialog.append(close,frame);showProductDialog(root,dialog,{label:'Vista previa de la descripción',trigger:b});return;
   }
   if(a==='photo-zoom'){const id=b.dataset.prImage;if(!associationIds(record,'images').includes(id))return;const dialog=document.createElement('dialog');dialog.className='prd-photo-dialog';const close=document.createElement('button');close.type='button';close.textContent='Cerrar imagen';close.className='btn secondary';close.onclick=()=>dialog.close();const img=document.createElement('img');img.src=productPhoto({id_default_image:id},store).replace('-home_default/','-large_default/');img.alt=textValue(record.name);dialog.append(close,img);showProductDialog(root,dialog,{label:'Imagen del producto',trigger:b});return;}
   if(a==='photo-view'){const id=b.dataset.prPhoto;if(!associationIds(record,'images').includes(id))return;const url=productPhoto({id_default_image:id},store),img=root.querySelector('#sticky-main-img'),header=root.querySelector('#sticky-header-thumb');if(img){img.src=url.replace('-home_default/','-large_default/');img.dataset.prImage=id;}if(header)header.src=url;for(const thumb of root.querySelectorAll('.sticky-thumb-btn')){const active=thumb.dataset.prPhoto===id;thumb.classList.toggle('ring-2',active);thumb.classList.toggle('ring-primary',active);thumb.setAttribute('aria-pressed',String(active));}const label=root.querySelector('[data-pr-photo-label]');if(label)label.textContent='Foto '+(associationIds(record,'images').indexOf(id)+1)+' de '+associationIds(record,'images').length;return;}
   if(a==='draft-pick-images'){root.querySelector('[data-pr-draft-files]')?.click();return;}
   if(a==='publish-direct'){void work(publishCurrent);return;}
   if(a==='draft-photo-remove'){draftPhotos.splice(Number(b.dataset.prPhoto),1);persistDraft();render();return;}
   if(a==='variation-images'&&!variants.find(v=>keyFor(v)===b.dataset.prVid)?.id){const variant=variants.find(v=>keyFor(v)===b.dataset.prVid),dialog=document.createElement('dialog');dialog.className='prd-select-dialog';dialog.innerHTML='<h3>Imágenes de esta variación</h3><p>Se asociarán a los ID reales después de subirlas al publicar.</p>'+draftPhotos.map(photo=>'<label><input type="checkbox" data-draft-photo-key="'+photo._draftKey+'" '+((variant.__draftImageKeys||[]).includes(photo._draftKey)?'checked':'')+'><img style="width:90px;height:90px;object-fit:contain" src="data:image/png;base64,'+photo.base64+'"></label>').join('')+(!draftPhotos.length?'<p>Añade primero las fotos en Galería.</p>':'')+'<button type="button" data-close-draft-images>Guardar selección</button>';dialog.querySelector('[data-close-draft-images]').onclick=()=>{variant.__draftImageKeys=[...dialog.querySelectorAll('input:checked')].map(input=>input.dataset.draftPhotoKey);persistDraft();dialog.close();};showProductDialog(root,dialog,{label:'Imágenes de esta variación'});return;}
   if(a==='draft-attributes'){void editDraftAttributes(b.dataset.prVid).catch(error=>{status=error.message;render();});return;}
   if(a==='fiche-validate'){void work(reviewDirectProduct);return;}
   if(a==='catalog-publish'){void (async()=>{await work(async()=>{await openProduct(b.dataset.prId,b.dataset.prShop,{keepCatalog:true});mode='ficha';});root.querySelector('[data-pr-action=publication-review]')?.click();})();return;}
   if(a==='fiche-discard'){if(editRequests.has(store)){status='Comprueba la solicitud enviada antes de descartar.';render();return;}overrides={};fields.clear();preflight.delete(store);persistDraft();render();return;}
   if(a==='fiche-sync'){void work(async()=>{editConfirm.set(store,'GUARDAR');await commitEdit(store);mode='ficha';});return;}
   if(a==='variant-direct-review'){void work(()=>reviewDirectVariant(b.dataset.prVid));return;}
   if(a==='variant-direct-sync'){void work(async()=>{editConfirm.set(store+'|'+b.dataset.prVid,'GUARDAR');await commitVariant(store,b.dataset.prVid);});return;}
   if(a==='create-stage-close'){inlineStage=false;render();return;}
   if(a==='image-position'){try{galleryDraft=moveProductPhoto(associationIds(record,'images'),galleryDraft,b.dataset.prImage,Number(b.dataset.prPosition));status='Orden de trabajo guardado en el borrador de Totus. No cambia la galería principal de PrestaShop.';persistDraft();render();}catch(error){status=error.message;render();}return;}
   if(a==='image-metadata'){
    const id=b.dataset.prImage;if(!associationIds(record,'images').includes(id))return;const local=productGallery(associationIds(record,'images'),galleryDraft),dialog=document.createElement('dialog');dialog.className='prd-photo-dialog prd-caption-dialog';dialog.innerHTML='<form><h3>Texto de imagen en Totus</h3><p>Se conserva en tu borrador. Puedes incluir la galería ordenada y sus textos en la descripción del producto mediante la API oficial. No altera el texto alternativo de la galería principal de PrestaShop 1.7.</p><label>Texto alternativo<input name="caption" maxlength="128" value="'+h(local.captions[id])+'"></label><div class="inline-actions"><button type="button" data-cancel>Cancelar</button><button type="submit">Guardar texto en Totus</button></div></form>';dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=event=>{event.preventDefault();galleryDraft=productGallery(associationIds(record,'images'),galleryDraft);galleryDraft.captions[id]=new FormData(event.target).get('caption');persistDraft();dialog.close();status='Texto de imagen guardado en el borrador de Totus.';render();};showProductDialog(root,dialog,{label:'Texto de imagen en Totus',trigger:b});return;
   }
   if(a==='gallery-description'){overrides.description=textValue(overrides.description??record.description)+productGalleryDescription(store,associationIds(record,'images'),galleryDraft,textValue(record.name));fields.add('description');invalidate();status='Galería con orden y textos añadida al borrador de descripción. Revisa y guarda para enviarla por la API oficial.';persistDraft();editorSection='contenido';render();return;}
   if(['feature-create','feature-value-create','attribute-group','attribute-value','image-stages','variation-stages','stock-stages','organization-review','variation-attributes','variation-images','variation-upload','variation-remove','image-remove','image-replace','image-cover','variation-default','publication-review','manufacturer-create','supplier-create'].includes(a)){void work(async()=>{
    if(!record?.id||(['variation-remove','variation-default'].includes(a)&&!variants.find(v=>keyFor(v)===b.dataset.prVid)?.id)){
     if(a==='variation-remove'){const id=b.dataset.prVid;variants=variants.filter(v=>keyFor(v)!==id);variantFields.delete(id);variantOverrides.delete(id);selection.delete(id);invalidate();status='Variación retirada del borrador. No se ha enviado ninguna eliminación a la tienda.';return;}
     if(a!=='variation-default')throw Error('Guarda primero la base del producto nuevo.');
     for(const variant of variants){const id=keyFor(variant),values=variantOverrides.get(id)||{},chosen=variantFields.get(id)||new Set();values.default_on=id===b.dataset.prVid?'1':'0';chosen.add('default_on');variantOverrides.set(id,values);variantFields.set(id,chosen);}
     invalidate();status='Variación predeterminada seleccionada en el borrador.';return;
    }
    const fresh=await loadItem(store,'products',record.id);
    await createWizard.openExisting(store,fresh);
    const plan={operation:'update',store,source_id:String(record.id),target_id:String(record.id),changes:[],variants:[],warnings:[]};
    comparison.set(store,plan);preview=[plan];targetRaw.set(store,fresh);targets=new Set([store]);
    const finishFields=a==='organization-review'?organization?.fields:a==='image-cover'?{id_default_image:b.dataset.prImage}:a==='variation-default'?{id_default_combination:b.dataset.prVid}:null;
    const tab=a==='manufacturer-create'?'manufacturer':a==='supplier-create'?'supplier':finishFields||a==='publication-review'?'finish':a==='feature-create'?'feature':a==='feature-value-create'?'feature_value':a==='attribute-group'?'attribute_group':a==='attribute-value'?'attribute_value':a==='image-replace'?'image_replace':a==='image-stages'||a==='variation-upload'?'image':a==='stock-stages'?'stock':['variation-images','variation-attributes'].includes(a)?'variation_edit':a==='variation-remove'?'remove_variation':a==='image-remove'?'remove_image':['image-position','image-metadata','image-replace'].includes(a)?'image_metadata':'variation';
    status=await createWizard.perform('create-stage-tab',store,plan,fresh,{tab});
    if(['attribute-group','attribute-value','feature-create','feature-value-create'].includes(a)){status=await createWizard.perform('create-stage-load',store,plan,fresh);status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:tab});}
    if(a==='image-stages'||a==='variation-upload')status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'image',...(a==='variation-upload'?{assignVariantId:b.dataset.prVid}:{})});
    if(['manufacturer-create','supplier-create'].includes(a))status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:tab});
    if(a==='publication-review')status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'finish',publicationOnly:true,publicationChanges:[...Object.entries(overrides).map(([field,value])=>({field,value})),...variants.filter(v=>v.id).flatMap(v=>Object.entries(variantOverrides.get(String(v.id))||{}).map(([field,value])=>({field:'Combinación #'+v.id+' · '+field,value})))]});
    if(a==='variation-stages'){await createWizard.perform('create-stage-load',store,plan,fresh);status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'variation'});}
    if(a==='image-replace')status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'image_replace',record_id:b.dataset.prImage});
    if(['variation-remove','image-remove'].includes(a)){status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:tab,record_id:a==='variation-remove'?b.dataset.prVid:b.dataset.prImage});}
    if(['variation-images','variation-attributes'].includes(a)){const variant=variants.find(v=>keyFor(v)===b.dataset.prVid);if(!variant?.id)throw Error('Guarda primero esta combinación.');status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'variation_edit',variant_id:String(variant.id),imageIds:associationIds(variant,'images'),attributes:associationIds(variant,'product_option_values')});}
    if(a==='stock-stages'&&b.dataset.prVid){const variant=variants.find(v=>keyFor(v)===b.dataset.prVid);if(!variant?.__stock)throw Error('No se pudieron verificar las existencias de esta combinación. Actualiza la ficha antes de ajustarlas.');const stock=variant.__stock;status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'stock',stockFields:{id_product_attribute:String(variant.id),quantity:String(stock.quantity),out_of_stock:String(stock.out_of_stock??'2'),depends_on_stock:String(stock.depends_on_stock??'0'),location:String(stock.location||'')}});}
    if(a==='organization-review'){if(!organization||organization.id!==String(record.id)||organization.store!==store)throw Error('Consulta primero la organización de esta ficha.');if(!organization.categories.includes(organization.fields.id_category_default))throw Error('Incluye la categoría principal entre las asociadas.');createWizard.setCatalogs(store,organization.catalog);}
    if(finishFields){status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'finish',finishFields,...(a==='organization-review'?{finishAssociations:{categories:organization.categories,tags:organization.tags,accessories:organization.related,product_features:organization.features}}:{})});status+=' Valida y guarda la revisión para enviarla a la tienda.';}
    inlineStage=true;mode='ficha';if(a==='publication-review')editorSection='general';if(['manufacturer-create','supplier-create','feature-create','feature-value-create'].includes(a))editorSection='organizacion';else if(a.startsWith('image'))editorSection='imagenes';else if(a.startsWith('variation')||a.startsWith('attribute'))editorSection='variaciones';
   });return;}

   if(a==='editor-section'){editorSection=b.dataset.prSection;render();return;}
   if(a==='copy-variants-all'||a==='copy-variants-none'){for(const variant of variants)variantFields.set(keyFor(variant),new Set(a==='copy-variants-all'?VARIANT_FIELDS.filter(f=>variant[f]!==undefined&&variant[f]!==null):[]));invalidate();render();persistDraft();return;}
   if(a==='copy-open'){void work(async()=>{const dest=store==='hortimatic'?'newoldsmok':'hortimatic';await openProduct(createWizard.result(dest).record_id,dest);});return;}
   if(a==='copy-upload'){void work(async()=>{if(!fields.size&&!variants.some(v=>variantFields.get(keyFor(v))?.size))throw Error('Selecciona los datos que quieres copiar o pulsa Seleccionar Todo.');const dest=store==='hortimatic'?'newoldsmok':'hortimatic',source={...record,__sourceStore:store,__copyCatalog:organization?.store===store?organization.catalog:null};targets=new Set([dest]);if(!comparison.has(dest))await prepare();const plan=comparison.get(dest);mode='comparar';if(plan.operation!=='create'){
    if(!preflight.get(dest)?.can_commit){await createWizard.openExisting(dest,targetRaw.get(dest));await createWizard.perform('create-copy-config',dest,plan,source);if(plan.changes.some(change=>change.changed))await previewXml(dest);else preflight.set(dest,{can_commit:true,changes:[],noFields:true});status='Aplicando la copia revisada y sus asociaciones.';}
    if(preflight.get(dest).changes?.length){editConfirm.set(dest,'GUARDAR');await commitEdit(dest);}
    for(const variant of plan.variants.filter(row=>row.target_id&&row.changes.some(change=>change.changed))){await previewVariant(dest,variant.target_id);editConfirm.set(dest+'|'+variant.target_id,'GUARDAR');await commitVariant(dest,variant.target_id);}
    createWizard.setCopyPublication(dest,true);status=await createWizard.perform('create-stage-copy-all',dest,plan,source);targetRaw.set(dest,await loadItem(dest,'products',plan.target_id));if(String(targetRaw.get(dest).active)!=='1')throw Error('La tienda no ha confirmado que la copia esté activa.');targetRaw.get(dest).__copyCompleted=true;status='Producto #'+plan.target_id+' actualizado, publicado y verificado en '+dest+'.';return;
   }if(createWizard.result(dest)){createWizard.setCopyPublication(dest,true);status=await createWizard.perform('create-stage-copy-all',dest,plan,source);const result=createWizard.result(dest);targetRaw.set(dest,await loadItem(dest,'products',result.record_id));if(String(targetRaw.get(dest).active)!=='1')throw Error('Publicación sin confirmar.');targetRaw.get(dest).__copyCompleted=true;return;}if(createWizard.hasAttempted(dest)){status=await createWizard.perform('create-verify',dest,plan,source);const result=createWizard.result(dest);if(result?.record_id)targetRaw.set(dest,await loadItem(dest,'products',result.record_id));return;}if(!createWizard.canCommit(dest)){if(!createWizard.hasProfile(dest))status=await createWizard.perform('create-copy-config',dest,plan,source);status=await createWizard.perform('create-prepare',dest,plan,source);status='Prevalidación correcta. Publicando en '+dest+'.';}createWizard.setCopyPublication(dest,true);status=await createWizard.perform('create-accept',dest,plan,source);status=await createWizard.perform('create-stage-copy-all',dest,plan,source);const saved=createWizard.result(dest);targetRaw.set(dest,await loadItem(dest,'products',saved.record_id));if(String(targetRaw.get(dest).active)!=='1')throw Error('La tienda no ha confirmado que la copia esté activa.');targetRaw.get(dest).__copyCompleted=true;status='Copia #'+saved.record_id+' completada, publicada y verificada en '+dest+'.';});return;}
   if(a==='copy-variations'){parallelSection='variaciones';render();return;}
   if(a==='fields-all'||a==='fields-none'){for(const shop of targets)if(shop!==store)createWizard.selectCopyImages(shop,a==='fields-all');fields=new Set(a==='fields-all'?Object.values(PRODUCT_SECTIONS).flat().filter(f=>record&&record[f]!==undefined&&record[f]!==null):[]);if(a==='fields-all')for(const variant of variants)variantFields.set(keyFor(variant),new Set(VARIANT_FIELDS.filter(f=>variant[f]!==undefined&&variant[f]!==null)));if(a==='fields-none'){overrides={};targetOverrides.clear();variantFields.clear();}invalidate();render();return;}
   if(a==='catalog-columns-reset'){catalogColumns=[...DEFAULT_PRODUCT_COLUMNS];saveCatalogPreferences();render();return;}
   if(a==='catalog-clear-selection'){catalogSelected.clear();render();return;}
   if(a==='catalog-copy'){void work(async()=>{
    if(!catalogSelected.size)throw Error('Selecciona los productos que quieras copiar.');
    if(catalogSelected.size>1){copyQueue=rows.filter(p=>catalogSelected.has(catalogKey(p))).map(p=>({store:p.__store||store,id:String(p.id),name:textValue(p.name),reference:textValue(p.reference)}));mode='guardado';status=copyQueue.length+' productos seleccionados. Revisa cada copia y su destino antes de guardar.';return;}
    const [shop,id]=[...catalogSelected][0].split('|');await openProduct(id,shop);fields=new Set(Object.values(PRODUCT_SECTIONS).flat().filter(f=>record[f]!==undefined&&record[f]!==null));for(const variant of variants)variantFields.set(keyFor(variant),new Set(VARIANT_FIELDS.filter(field=>variant[field]!==undefined&&variant[field]!==null)));mode='comparar';status='Ficha lista para copiar: revisa los campos y el destino antes de crear.';
   });return;}
   if(a==='open-copy-item'){void work(async()=>{await openProduct(b.dataset.id,b.dataset.prShop);fields=new Set(Object.values(PRODUCT_SECTIONS).flat().filter(f=>record[f]!==undefined&&record[f]!==null));for(const variant of variants)variantFields.set(keyFor(variant),new Set(VARIANT_FIELDS.filter(field=>variant[field]!==undefined&&variant[field]!==null)));mode='comparar';status='Copia de '+textValue(record.name)+': revisa el destino. Los demás productos de la selección se conservan.';});return;}

   if(a==='catalog-stock'){void work(loadCatalogStock);return;}
   if(a==='catalog-export'){if(!canExport())return;const list=visibleCatalog().filter(r=>!catalogSelected.size||catalogSelected.has(catalogKey(r))),keys=catalogColumns.filter(k=>k!=='image'),csv=productCatalogCsv(list,keys,catalogValue),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='productos-'+store+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
   if(a==='shop-open'){void work(async()=>{const shop=b.dataset.prShop,item=shopRecords.get(shop);if(!item)throw Error('Comprueba primero la correspondencia.');store=shop;await openProduct(item.id);});return;}
   if(a==='shop-check'){void work(async()=>{const shop=b.dataset.prShop;if(!record?.id){store=shop;rows=[];mode='catalogo';return;}const ref=textValue(record.reference);if(!ref.trim())throw Error('Falta referencia para comprobar la otra tienda.');const response=await invokeShop(shop,'prestashop_read',{resource:'products',references:[ref],page:0,page_size:100,sort:'oldest'});if(response.possibly_more)throw Error('Correspondencias incompletas.');const match=matchExactReference(response.rows,ref);if(match.status==='ambiguous')throw Error('Referencia duplicada; selecciona una ficha exacta.');if(match.product)shopRecords.set(shop,await loadItem(shop,'products',match.product.id));else shopRecords.delete(shop);status=match.product?'Ficha encontrada en '+shop+'.':'No existe esa referencia en '+shop+'. Puedes preparar su copia.';});return;}
   if(a==='shop-copy'){void work(async()=>{const shop=b.dataset.prShop;targets=new Set([shop]);const destName=PRODUCT_STORES.find(s=>s.key===shop).label;const adapted=targetOverrides.get(shop)||{};const adaptedTexts=adaptProductTexts(record,store,shop);for(const change of adaptedTexts.changes)adapted[change.field]=textValue(change.after);targetOverrides.set(shop,adapted);invalidate();mode='comparar';if(fields.size)await prepare();status='Copia selectiva preparada para '+destName+'. Revisa SEO, enlaces y relaciones; categorías y atributos se eligen en destino. Aún no se ha escrito nada.'+(adaptedTexts.unresolved.length?' Hay '+adaptedTexts.unresolved.length+' enlaces internos pendientes de correspondencia; las fotos se ajustan tras importarlas.':'');});return;}
   if(a.startsWith('create-')){void work(async()=>{if(['create-stage-commit','create-stage-verify'].includes(a)&&createWizard.isPublication(b.dataset.prStageRow)){if(Object.keys(overrides).length){await reviewDirectProduct();editConfirm.set(store,'GUARDAR');await commitEdit(store);}if(createWizard.publicationIncludesVariants(b.dataset.prStageRow)){for(const variant of variants.filter(v=>v.id&&Object.keys(variantOverrides.get(String(v.id))||{}).length)){await reviewDirectVariant(String(variant.id));editConfirm.set(store+'|'+variant.id,'GUARDAR');await commitVariant(store,String(variant.id));}}}const plan=comparison.get(b.dataset.prDest);status=await createWizard.perform(a,b.dataset.prDest,plan,{...record,__sourceStore:store,__copyCatalog:organization?.store===store?organization.catalog:null},{row:b.dataset.prStageRow,tab:b.dataset.prStageTab,kind:b.dataset.prStageKind});if(['create-stage-commit','create-stage-verify'].includes(a)&&record?.id&&b.dataset.prDest===store){const synced=createWizard.catalogs(store,record.id);if(synced){if(synced.product_options)attributeGroups.set(store,new Map(synced.product_options.map(item=>[String(item.id),textValue(item.name)])));if(synced.product_option_values)for(const item of synced.product_option_values){attributeNames.set(store+'|'+item.id,textValue(item.name));attributeValues.set(store+'|'+item.id,item);}if(organization?.store===store&&organization.id===String(record.id))for(const key of ['product_features','product_feature_values'])if(synced[key])organization.catalog[key]=synced[key];}}if(['create-commit','create-verify','create-retry-absent','create-stage-commit','create-stage-verify','create-stage-copy-all'].includes(a)){const saved=createWizard.result(b.dataset.prDest);if(saved?.record_id){try{const fresh=await loadItem(b.dataset.prDest,'products',saved.record_id);targetRaw.set(b.dataset.prDest,fresh);if(mode==='ficha'&&b.dataset.prDest===store&&!record?.id){const localVariants=variants.filter(v=>!v.id);record=fresh;shopRecords.set(store,fresh);variants=[...await combinations(store,fresh),...localVariants];overrides={};status+=' Base comprobada. Completa las variaciones y la galería desde esta ficha; revisa la publicación cuando quieras hacerla visible.';}if(catalogScope==='both'||catalogScope===b.dataset.prDest){const row={...fresh,__store:b.dataset.prDest},i=rows.findIndex(p=>catalogKey(p)===catalogKey(row));if(i<0)rows.unshift(row);else rows[i]=row;}}catch{status+=' Queda pendiente actualizar el catálogo.';}}}if(createWizard.removed(b.dataset.prDest)){const removedId=String(record.id),removedShop=b.dataset.prDest;draftsByProduct.delete(removedShop+'|'+removedId);draftsByShop.delete(removedShop);resetDraft();rows=rows.filter(p=>!(String(p.id)===removedId&&(p.__store||store)===removedShop));mode='catalogo';status='Producto #'+removedId+' eliminado y ausencia verificada en '+removedShop+'.';return;}if(['create-stage-commit','create-stage-verify','create-stage-copy-all'].includes(a)&&record?.id&&plan?.store===store&&String(createWizard.result(b.dataset.prDest)?.record_id)===String(record.id)){try{record=await loadItem(plan.store,'products',record.id);variants=await combinations(plan.store,record);}catch{status+=' El guardado está verificado; queda pendiente refrescar la ficha.';}}});return;}
   if(a==='parallel-section'){parallelSection=b.dataset.prSection;render();return;}
   if(a==='mode'){mode=b.dataset.mode;render();return;}
   if(a==='request-build'){try{requestOutput=buildProductRequest(requestBrief);status='Encargo preparado. Revísalo y cópialo a tu chat con los archivos que quieras aportar.';}catch(error){status=error.message;}render();return;}
   if(a==='request-copy'){void work(async()=>{if(!requestOutput)throw Error('Prepara primero el encargo.');await navigator.clipboard.writeText(requestOutput);status='Petición copiada para pegar en ChatGPT.';});return;}
   if(a==='masters'){if(['product_options','product_option_values','product_features','product_feature_values'].includes(b.dataset.prResource)){mode='atributos';render();}else openMasters(b.dataset.prResource,b);return;}
   if(a==='new-product'){freshProduct();render();return;}
   if(a==='new-variant'){newVariant();render();return;}
   if(a==='clear-preview'){invalidate();status='Propuesta descartada; la ficha original sigue cargada.';render();return;}
   if(a==='bulk-prepare'){void work(prepareBulk);return;}
   if(a==='bulk-commit'){void work(commitBulk);return;}
   if(a==='bulk-preview'){try{bulkVariantSelection(variants,[...selection],['reference']);status='Selección comprobada: '+selection.size+' variaciones distintas. Elige el campo y valor antes de validar el lote.';}catch(error){status=error.message;}render();return;}
   if(a==='catalog-prev'){void work(async()=>{listPage=Math.max(0,listPage-1);await loadCatalogStock();});return;}
   if(a==='catalog-next'){void work(async()=>{if((listPage+1)*listSize>=rows.length&&hasMore)await loadCatalog(true);listPage++;await loadCatalogStock();});return;}
   if(a==='catalog-load')void work(async()=>{const generation=epoch,response=await rpc('totus_products_context',{});if(!current()||epoch!==generation)throw Error('La sesión ha cambiado.');connections=response?.connections||[];catalogCache.clear();catalogMeta.clear();creationMetadata.clear();await loadCatalog(false);});
   if(a==='catalog-more')void work(()=>loadCatalog(true));
   if(a==='open-product')void work(()=>openProduct(b.dataset.id,b.dataset.prShop||store));
   if(a==='compare')void work(prepare);
   if(a==='variant-edit-commit')void work(()=>commitVariant(b.dataset.prDest,b.dataset.prVariation));
   if(a==='variant-edit-recovery')void work(()=>reviewEditRecovery(b.dataset.prDest,b.dataset.prDest+'|'+b.dataset.prVariation));
   if(a==='edit-recovery')void work(()=>reviewEditRecovery(b.dataset.prDest));
   if(a==='edit-commit')void work(()=>commitEdit(b.dataset.prDest));
   if(a==='api-preview')void work(()=>previewXml(b.dataset.prDest));
   if(a==='variant-api-preview')void work(()=>previewVariant(b.dataset.prDest,b.dataset.prVariation));
  };
  render();
  try{if(tableLayout){try{const before=layoutVersion;await layoutQueue.catch(()=>{});const saved=await tableLayout.load(owner);if(!current()||epoch!==gen)return;if(saved?.columns&&before===layoutVersion){catalogColumns=productColumns(saved.columns);columnWidths=productColumnWidths(saved.widths);if(Array.isArray(saved.views))catalogViews=saved.views;catalogViewName=saved.viewName||'';layoutSaveState='Distribución recuperada de tu cuenta.';}if(before===layoutVersion&&!Array.isArray(saved?.views)&&catalogViews.length)saveCatalogPreferences();}catch{layoutSaveState='Distribución local; no se pudo consultar la guardada en tu cuenta.';}}const response=await rpc('totus_products_context',{});if(!current()||epoch!==gen)return;connections=response?.connections||[];status='Conexiones consultadas.';if(ready(store))await loadCatalog(false);}
  catch(e){if(current()&&epoch===gen)status='No se han podido comprobar las conexiones: '+(e.message||'error');}
  if(current()&&epoch===gen){try{await storageQueue;const saved=await productDraftStore(owner);if(current()&&epoch===gen){const previousStore=store;if(restoreDraft(saved,{restoreTable:true})){if(store!==previousStore&&ready(store))await loadCatalog(false);if(record?.id&&ready(store)&&!await refreshStoredProduct())return;status='Borrador recuperado de esta cuenta. Comprueba las operaciones enviadas antes de repetir un guardado.';}}}catch{}storageReady=true;render();}
  if(current()&&epoch===gen&&requestedProduct){const target=requestedProduct;requestedProduct=null;if(target.owner===owner){try{if(!ready(target.store))throw Error('Comprueba la conexión de '+target.store+'.');if(catalogScope!==target.store)await switchStore(target.store);await openProduct(target.id,target.store);}catch(error){if(current())status='No se pudo abrir el producto solicitado: '+error.message;}if(current())render();}}
 }
 function selectProduct({store:shop,id}){
  if(!PRODUCT_STORES.some(s=>s.key===shop)||!/^[1-9]\d{0,14}$/.test(String(id)))throw Error('Producto o tienda no válidos.');
  requestedProduct={store:shop,id:String(id),owner:actor()};
 }
 function hasDraft(){return tableEditor.rows.size>0||!!record&&(fields.size>0||[...variantFields.values()].some(s=>s.size>0));}
 function discardDraft(){for(const row of [...tableEditor.rows.values()])if(!row.request)tableEditor.discard(row.shop,row.id);if(record)draftsByProduct.delete(store+'|'+(record.id||record.draft_key||textValue(record.reference)||'new'));draftsByShop.delete(store);resetDraft();status='Propuesta descartada.';if(current())render();}
 function dispose(){attributesUI.dispose();++prefetchVersion;clearTimeout(catalogSearchTimer);controlsCleanup();photoCleanup();layoutCleanup();persistDraft();storageReady=false;if(root){root.onclick=null;root.ondblclick=null;root.onchange=null;root.oninput=null;root.onkeydown=null;root.ondragover=null;root.ondrop=null;}root=null;owner=null;++epoch;pending=false;}
 return {mount,dispose,hasDraft,discardDraft,stateSnapshot,selectProduct};
}
