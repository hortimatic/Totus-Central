import {productCountryTaxRate,productDisplayAmounts} from './productos-tax.js';
import {stitchHeader,stitchCatalog,stitchFiche,stitchCopy,stitchRequest,stitchSaved,ensureStitchProductFonts} from './productos-stitch-view.js';
import {PRODUCT_COLUMNS,DEFAULT_PRODUCT_COLUMNS,productColumns,catalogProductKey,productPhoto,filterProductCatalog,productCatalogCsv} from './productos-catalog.js';
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
const metadata={name:'Nombre',reference:'Referencia',description_short:'Descripción breve',description:'Descripción completa',meta_title:'Título SEO',meta_description:'Descripción SEO',meta_keywords:'Palabras clave',link_rewrite:'URL amigable',price:'Precio',wholesale_price:'Coste',ean13:'EAN',weight:'Peso',id_tax_rules_group:'Regla de impuestos',active:'Activo',visibility:'Visibilidad',isbn:'ISBN',upc:'UPC',mpn:'Referencia del fabricante',condition:'Estado del producto',available_for_order:'Disponible para pedidos',show_price:'Mostrar precio',online_only:'Solo venta online',unit_price_ratio:'Relación precio base / precio unitario',unity:'Unidad de medida',on_sale:'En oferta',ecotax:'Ecotasa',redirect_type:'Tipo de redirección',id_type_redirected:'Destino de redirección',width:'Anchura',height:'Altura',depth:'Profundidad',additional_shipping_cost:'Suplemento de envío',minimal_quantity:'Cantidad mínima',available_date:'Fecha de disponibilidad',location:'Ubicación',low_stock_threshold:'Umbral de pocas existencias',low_stock_alert:'Aviso de pocas existencias',out_of_stock:'Pedidos sin existencias',show_condition:'Mostrar condición',additional_delivery_times:'Tipo de plazo de entrega',delivery_in_stock:'Plazo con existencias',delivery_out_stock:'Plazo sin existencias',available_now:'Etiqueta con existencias',available_later:'Etiqueta sin existencias'};
const text=(v,max=140)=>{const s=textValue(v);return s.length>max?s.slice(0,max)+'…':s;};
const keyFor=(item)=>String(item?.id||item?.draft_key||'');
const validReference=s=>typeof s==='string'&&s.trim().length>0;
export function createProductosUI({rpc,invoke,actor,allowed,canEdit=()=>false}){
 const draftsByShop=new Map(),draftsByProduct=new Map(),attributeNames=new Map();
 let organization=null;
 let copyQueue=[],catalogViews=[],catalogViewName='';
 let requestBrief={operation:'url',store:'hortimatic'},requestOutput='',requestOwner=null;
 let storageReady=false,storageQueue=Promise.resolve(),storageError=null;
 let priceOptions={vat:'21',re:'5.2',discount:'0'};
 let catalogScope='hortimatic',catalogMore=new Map(),catalogMeta=new Map();
 let catalogTaxContext={countries:[],rules:[],taxes:[]};
 const catalogKey=p=>catalogProductKey(p,store);
 let catalogColumns=[...DEFAULT_PRODUCT_COLUMNS],catalogSelected=new Set(),catalogFilters={category:'',brand:'',active:''},catalogCategories=[],catalogBrands=[],catalogStock=new Map(),editorSection='general';
 let listSize=20,listPage=0,parallelSection='general',bulkField='price',bulkValue='',bulkItems=[],bulkConfirm='';
 let root=null,owner=null,epoch=0,mode='catalogo',store='hortimatic',pending=false,status='Selecciona una tienda y consulta su catálogo.',connections=[],rows=[],hasMore=false,page=0,query='',record=null,variants=[],fields=new Set(),overrides={},variantFields=new Map(),variantOverrides=new Map(),targets=new Set(['newoldsmok']),comparison=new Map(),preview=[],selection=new Set(),targetOverrides=new Map(),preflight=new Map(),targetRaw=new Map(),targetLanguages=new Map(),targetIds=new Map(),variantPreflight=new Map();
 const connection=shop=>storeConnection(connections,shop);
 const shopRecords=new Map(),editRequests=new Map(),editConfirm=new Map();
 const ready=shop=>{const c=connection(shop);return !!c&&c.enabled&&c.configured&&c.verified_revision===c.revision&&c.real_data_authorized===true;};
 const current=()=>!!root?.isConnected&&owner===actor()&&allowed()&&root.dataset.prEpoch===String(epoch);
 const stateSnapshot=()=>({store,mode,record:record?.id||null});
 const createWizard=createProductWizard({invoke:(shop,action,args)=>invokeShop(shop,action,args),canEdit});
 const snapshotDraft=()=>({organization,copyQueue,requestBrief,requestOutput,editorSection,catalogScope,store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight,shops:shopRecords,editRequests,editConfirm,wizard:createWizard.snapshot()});
 const persistDraft=()=>{if(!storageReady||!owner)return;const key=owner,value=record||requestBrief.url||draftsByShop.size||draftsByProduct.size||copyQueue.length?structuredClone({...snapshotDraft(),shopDrafts:[...draftsByShop],productDrafts:[...draftsByProduct]}):null;storageError=null;storageQueue=storageQueue.catch(()=>{}).then(()=>productDraftStore(key,value)).catch(error=>{storageError=error||Error('Borrador local no disponible');if(current())status='No se ha podido conservar el borrador local. No cierres esta pestaña hasta comprobar las operaciones pendientes.';});};
 function restoreDraft(d){
  if(!d||!PRODUCT_STORES.some(s=>s.key===d.store)||!d.record&&!d.requestBrief?.url&&!d.shopDrafts?.length&&!d.productDrafts?.length&&!d.copyQueue?.length)return false;
  if(Array.isArray(d.productDrafts)){draftsByProduct.clear();for(const [key,value]of d.productDrafts)draftsByProduct.set(key,value);}
  copyQueue=Array.isArray(d.copyQueue)?d.copyQueue:copyQueue;
  if(Array.isArray(d.shopDrafts)){draftsByShop.clear();for(const [shop,value]of d.shopDrafts)if(PRODUCT_STORES.some(s=>s.key===shop))draftsByShop.set(shop,value);}
  requestBrief=d.requestBrief||requestBrief;requestOutput=d.requestOutput||'';editorSection=d.editorSection||'general';catalogScope=d.catalogScope||d.store;
  organization=d.organization||null;
  ({store,mode,parallelSection,bulkField,bulkValue,bulkItems,bulkConfirm,record,variants,fields,overrides,variantFields,variantOverrides,targets,comparison,preview,targetOverrides,preflight,targetRaw,targetLanguages,targetIds,variantPreflight}=d);
  for(const [map,values] of [[shopRecords,d.shops],[editRequests,d.editRequests],[editConfirm,d.editConfirm]]){map.clear();for(const [key,value] of values||[])map.set(key,value);}
  createWizard.restore(d.wizard);return true;
 }
 const invalidate=()=>{preview=[];comparison.clear();preflight.clear();variantPreflight.clear();createWizard.invalidate();};
 function resetDraft(){
  organization=null;shopRecords.clear();editRequests.clear();editConfirm.clear();bulkItems=[];bulkConfirm='';record=null;variants=[];fields=new Set();overrides={};variantFields.clear();variantOverrides.clear();selection.clear();targetOverrides.clear();targetRaw.clear();targetLanguages.clear();targetIds.clear();createWizard.reset();invalidate();
 }
 function sectionTitle(section){return ({general:'Información y descripción',precios:'Precios e impuestos',seo:'SEO',transporte:'Transporte',inventario:'Disponibilidad',organizacion:'Organización'})[section]||section;}
 function fieldControl(field,value,attrs,disabled=false){
  const enums={active:[['0','Inactivo'],['1','Activo']],available_for_order:[['0','No permitir compra'],['1','Permitir compra']],show_price:[['0','Ocultar precio'],['1','Mostrar precio']],online_only:[['0','No'],['1','Sí']],on_sale:[['0','No'],['1','Sí']],show_condition:[['0','No'],['1','Sí']],low_stock_alert:[['0','No'],['1','Sí']],visibility:[['both','Catálogo y búsqueda'],['catalog','Solo catálogo'],['search','Solo búsqueda'],['none','Oculto']],condition:[['new','Nuevo'],['used','Usado'],['refurbished','Reacondicionado']],additional_delivery_times:[['0','Sin plazo'],['1','Plazo general'],['2','Plazo específico']],out_of_stock:[['0','Denegar pedidos'],['1','Permitir pedidos'],['2','Preferencia de la tienda']]};
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
  if(key==='brand')return textValue((catalogMeta.get(p.__store||store)?.brands||catalogBrands).find(x=>String(x.id)===String(p.id_manufacturer))?.name)||(p.id_manufacturer&&p.id_manufacturer!=='0'?'Marca #'+p.id_manufacturer:'—');
  if(key==='category')return textValue((catalogMeta.get(p.__store||store)?.categories||catalogCategories).find(x=>String(x.id)===String(p.id_category_default))?.name)||(p.id_category_default?'Categoría #'+p.id_category_default:'—');
  if(key==='store')return PRODUCT_STORES.find(s=>s.key===(p.__store||store)).label;
  if(key==='gross'||key==='margin'){const a=productDisplayAmounts(p,productCountryTaxRate(p.id_tax_rules_group,catalogMeta.get(p.__store||store)?.tax||catalogTaxContext));return key==='gross'?(a.gross===null?'Sin verificar':money(a.gross)):(a.marginPct===null?'—':a.marginPct.toFixed(1)+' %');}
  if(key==='cost')return money(p.wholesale_price);if(key==='price')return money(p.price);
  if(key==='variants')return associationIds(p,'combinations').length;
  if(key==='stock')return catalogStock.has(catalogKey(p))?catalogStock.get(catalogKey(p)):'Sin consultar';
  if(key==='active')return String(p.active)==='1'?'Activo':'Inactivo';
  return textValue(p[key])||'—';
 }
 function visibleCatalog(){return filterProductCatalog(rows,{query,...catalogFilters});}
 function saveCatalogPreferences(){try{localStorage.setItem('totus-products-columns:'+owner,JSON.stringify(catalogColumns));localStorage.setItem('totus-products-views:'+owner,JSON.stringify(catalogViews));}catch{status='No se han podido conservar las vistas del catálogo.';}}
 function savedDraftCards(){const saved=new Map(draftsByProduct);if(record)saved.set(store+'|'+(record.id||record.draft_key||'new'),snapshotDraft());return [...saved].map(([key,d])=>({key,shop:PRODUCT_STORES.find(s=>s.key===d.store)?.label||d.store,name:textValue(d.overrides?.name??d.record?.name),reference:textValue(d.overrides?.reference??d.record?.reference),changes:d.fields?.size||0}));}
 function catalog(){
  const filtered=visibleCatalog(),pages=Math.max(1,Math.ceil(filtered.length/listSize));listPage=Math.min(listPage,pages-1);
  const visibleIds=new Set(filtered.map(catalogKey));
  const metaOptions=kind=>catalogScope==='both'?PRODUCT_STORES.flatMap(shop=>(catalogMeta.get(shop.key)?.[kind]||[]).map(r=>[shop.key+'|'+r.id,shop.label+' · '+textValue(r.name)])):(kind==='brands'?catalogBrands:catalogCategories).map(r=>[r.id,textValue(r.name)]);
  return stitchCatalog({views:catalogViews,viewName:catalogViewName,store:catalogScope,rows:rows.map(p=>({...p,__visible:visibleIds.has(catalogKey(p))})),columns:catalogColumns,selected:catalogSelected,query,filters:catalogFilters,brands:metaOptions('brands'),categories:metaOptions('categories'),page:listPage,size:listSize,hasMore,pending,ready:catalogScope==='both'?PRODUCT_STORES.every(s=>ready(s.key)):ready(store),value:catalogValue,photo:p=>photo(p,p.__store||store),rowKey:catalogKey});
 }

 function photo(p,shop,large=false){const url=productPhoto(p,shop);return url?'<img class="'+(large?'prd-product-photo':'prd-thumb')+'" src="'+h(url)+'" alt="'+h(text(p?.name)||'Producto')+'" loading="lazy">':'<span class="'+(large?'prd-product-photo':'prd-thumb')+' prd-no-photo" aria-label="Sin imagen">Sin imagen</span>';}

 function rawPanel(){
  if(!record?.id)return '<p class="font-body-sm text-body-sm">Las relaciones de un producto nuevo se seleccionan en la revisión de alta de cada tienda.</p>';
  if(!organization?.catalog?.product_features||organization.store!==store||organization.id!==String(record.id))return '<button type="button" data-pr-action="organization-load" class="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md">Editar categorías, marca, proveedor e impuestos</button>';
  const select=(key,title,rows)=>'<label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">'+h(title)+fieldHelp(title,'Se elige un registro de esta tienda. Revisa, valida y guarda para aplicar los cambios.')+'</span><select data-pr-org="'+key+'"><option value="0">Sin asignar</option>'+rows.map(row=>'<option value="'+h(row.id)+'" '+(String(row.id)===organization.fields[key]?'selected':'')+'>'+h(textValue(row.name))+'</option>').join('')+'</select></label>';
  const c=organization.catalog;
  const multiple=(kind,title,rows,selected)=>'<label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">'+h(title)+'</span><select multiple size="5" data-pr-org-list="'+kind+'">'+rows.map(row=>'<option value="'+h(row.id)+'" '+(selected.includes(String(row.id))?'selected':'')+'>'+h(textValue(row.name))+'</option>').join('')+'</select></label>';
  const more='<div class="grid grid-cols-2 gap-space-md prd-native-extra">'+multiple('tags','Etiquetas',c.tags,organization.tags)+multiple('related','Productos relacionados',c.related_products,organization.related)+'<label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">Características y materiales</span><select multiple size="6" data-pr-org-features>'+c.product_features.map(feature=>'<optgroup label="'+h(textValue(feature.name))+'">'+c.product_feature_values.filter(v=>String(v.id_feature)===String(feature.id)).map(v=>'<option value="'+h(feature.id)+':'+h(v.id)+'" '+(organization.features.some(f=>f.feature_id===String(feature.id)&&f.value_id===String(v.id))?'selected':'')+'>'+h(textValue(v.value))+'</option>').join('')+'</optgroup>').join('')+'</select><small>Elige un valor por característica. El servidor comprueba su pertenencia.</small></label><label class="flex flex-col gap-space-xs"><span class="font-label-md text-label-md">Añadir relacionado por referencia exacta</span><input data-pr-org-related value="'+h(organization.relatedReference||'')+'"><button type="button" data-pr-action="organization-related">Buscar y añadir relacionado</button></label></div>';

  return '<div class="grid grid-cols-2 gap-space-md">'+select('id_manufacturer','Marca',c.manufacturers)+select('id_supplier','Proveedor principal',c.suppliers)+select('id_tax_rules_group','Grupo de impuestos',c.tax_rule_groups)+select('id_category_default','Categoría principal',c.categories)+'</div><fieldset class="prd-native-extra"><legend>Categorías asociadas</legend>'+c.categories.map(row=>'<label class="flex items-center gap-space-sm"><input type="checkbox" data-pr-org-category="'+h(row.id)+'" '+(organization.categories.includes(String(row.id))?'checked':'')+'> '+h(textValue(row.name))+'</label>').join('')+'</fieldset>'+more+'<button type="button" data-pr-action="organization-review" class="px-space-md py-space-sm rounded bg-primary-container text-on-primary font-label-md text-label-md">Revisar cambios de organización</button>';
 }
 async function loadOrganization(){
  if(!record?.id)throw Error('Guarda primero la base del producto.');const catalog={};
  for(const resource of ['manufacturers','suppliers','tax_rule_groups','categories','tags','product_features','product_feature_values']){const all=[],seen=new Set();for(let page=0;;page++){const data=await invokeShop(store,'prestashop_read',{resource,page,page_size:100});if(!Array.isArray(data.rows))throw Error('No se pudo consultar '+resource+'.');for(const row of data.rows){if(seen.has(String(row.id)))throw Error('El catálogo contiene duplicados.');seen.add(String(row.id));all.push(row);}if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Catálogo auxiliar incompleto.');}catalog[resource]=all;}
  organization={store,id:String(record.id),catalog,fields:Object.fromEntries(['id_manufacturer','id_supplier','id_tax_rules_group','id_category_default'].map(k=>[k,String(record[k]||'0')])),categories:associationIds(record,'categories'),tags:associationIds(record,'tags'),related:associationIds(record,'accessories'),features:(Array.isArray(record.associations?.product_features)?record.associations.product_features:[]).map(f=>({feature_id:String(f.id),value_id:String(f.id_feature_value)})),relatedReference:''};catalog.related_products=[];for(let offset=0;offset<organization.related.length;offset+=100){const response=await invokeShop(store,'prestashop_read',{resource:'products',product_ids:organization.related.slice(offset,offset+100),page:0,page_size:100});if(response.possibly_more)throw Error('Relacionados incompletos.');catalog.related_products.push(...response.rows);}status='Organización consultada. Selecciona los cambios y revisa antes de guardar.';
 }
 function editor(){
  if(!record)return empty('Abre un producto o crea un borrador','Elige una ficha del catálogo para trabajar con sus datos.');
  return stitchFiche({record,store,section:editorSection,overrides,variants,variantOverrides,metadata,fieldControl,priceHtml:priceStudy(),rawHtml:rawPanel(),brands:catalogBrands,categories:catalogCategories,stock:catalogStock.get(store+'|'+record.id)??null,amounts:productDisplayAmounts({...record,...overrides},productCountryTaxRate(record.id_tax_rules_group,catalogTaxContext))});
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
  return '<div class="prd-field-selection">'+btn('Seleccionar todos los campos','fields-all')+btn('Ninguno','fields-none')+'<span>'+fields.size+' campos seleccionados para copiar</span></div><nav class="prd-parallel-tabs" aria-label="Apartados de ambas fichas">'+Object.keys(sections).map(key=>btn(key==='contenido'?'Contenido':key==='general'?'Datos':sectionTitle(key),'parallel-section','data-pr-section="'+key+'"'+(parallelSection===key?' aria-current="page"':''),pending)).join('')+'</nav><div class="prd-parallel-editors">'+stores.map(shop=>{
   const source=shop===store,target=targetRaw.get(shop),values=targetOverrides.get(shop)||{};
   return '<fieldset><legend>'+h(PRODUCT_STORES.find(s=>s.key===shop).label)+(source?' · origen':' · destino')+'</legend><div class="prd-parallel-identity">'+photo(source?record:target,shop)+'<strong>'+h(text((source?record:target)?.name)||'Nueva ficha')+'</strong></div><p class="small">'+(source?'Marca los campos que deseas copiar.':'Completa o adapta los campos del destino. Nada se envía hasta validar y confirmar.')+'</p>'+(!source?'<label class="prd-field"><b>ID de destino existente (opcional)</b><input data-pr-existing-id="'+shop+'" value="'+h(targetIds.get(shop)||'')+'" placeholder="Buscar por referencia si se deja vacío"></label>':'<label class="prd-field"><b>ID de origen</b><input value="'+h(record.id||'Borrador nuevo')+'" disabled></label>')+'<div class="prd-fields-grid">'+sections[parallelSection].map(field=>{
    if(source)return showField(field);
    const value=Object.prototype.hasOwnProperty.call(values,field)?values[field]:fields.has(field)?Object.prototype.hasOwnProperty.call(overrides,field)?overrides[field]:textValue(record[field]):textValue(target?.[field]);
    const attrs='data-pr-target-field="'+h(field)+'" data-pr-target-store="'+shop+'"';
    return '<label class="prd-field"><b>'+h(metadata[field]||field)+'</b>'+fieldControl(field,value,attrs)+languagePicker(shop,field)+'</label>';
   }).join('')+'</div></fieldset>';
  }).join('')+'</div>';
 }
 function comparisonPanel(){
  if(!record)return empty('Selecciona una ficha','Primero abre un producto o crea un borrador.');
  return '<section class="card card-pad"><h3>Tiendas de destino</h3><p>Selecciona una o ambas. Cada tienda conserva sus propios ID, categorías, imágenes y atributos.</p><div class="prd-targets">'+PRODUCT_STORES.map(s=>'<label><input type="checkbox" data-pr-target="'+s.key+'" '+(targets.has(s.key)?'checked':'')+'> '+h(s.label)+' '+(ready(s.key)?'':'· sin conexión verificada')+'</label>').join('')+'</div>'+parallelEditors()+'<div class="inline-actions">'+btn('Buscar coincidencias y preparar cambios','compare','',pending||!targets.size)+btn('Descartar propuesta','clear-preview','',pending)+'</div><div class="prd-preview">'+(preview.length?preview.map(plan=>'<section class="prd-plan"><h4>'+h(PRODUCT_STORES.find(s=>s.key===plan.store)?.label)+' · '+(plan.operation==='update'?'Actualizar #'+h(plan.target_id):'Crear producto nuevo')+'</h4><p>'+plan.changes.filter(x=>x.changed).length+' campos cambiados · '+plan.variants.length+' variaciones seleccionadas</p><ul>'+plan.changes.filter(x=>x.changed).map(change=>'<li><b>'+h(metadata[change.field]||change.field)+'</b>: '+h(text(change.before))+' → '+h(text(change.after))+'</li>').join('')+'</ul>'+((preflight.get(plan.store)?.record_id===plan.target_id)?'<p class="prd-api-ok">XML real consultado y campos seleccionados verificados, sin escribir.</p>':'')+btn('Validar contra el XML de la tienda','api-preview','data-pr-dest="'+h(plan.store)+'"',pending||!plan.target_id||!plan.changes.some(c=>c.changed))+plan.variants.filter(v=>v.changes.some(c=>c.changed)).map(v=>'<div class="prd-variant-review"><span>Variación #'+h(v.target_id||'nueva')+' · '+h(v.changes.filter(c=>c.changed).length)+' campos</span>'+((variantPreflight.has(plan.store+'|'+v.target_id))?'<small>XML comprobado</small>':'')+btn('Validar variación','variant-api-preview','data-pr-dest="'+h(plan.store)+'" data-pr-variation="'+h(v.target_id||'')+'"',pending||!v.target_id)+variantSaveControls(plan.store,v.target_id)+'</div>').join('')+plan.warnings.map(w=>'<p class="prd-warning">'+h(w)+'</p>').join('')+(plan.operation==='create'?createWizard.render(plan,record):editControls(plan)+createWizard.render(plan,record))+'</section>').join(''):'<p>Sin propuesta calculada. Primero selecciona los campos de la ficha y, si corresponde, de cada combinación.</p>')+'</div><p class="prd-note"><b>El alta base tiene su propia confirmación por tienda.</b> Tras el alta base, completa combinaciones, existencias, precios e imágenes en sus etapas. Las actualizaciones de productos anteriores y los lotes se mantienen separados.</p></section>';
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
  const columnsOpen=!!root.querySelector('.prd-columns[open]');
  const content=mode==='catalogo'?catalog():mode==='ficha'?editor():mode==='variantes'?variantsPanel():mode==='comparar'?(record?stitchCopy({store,legacyHtml:comparisonPanel()}):comparisonPanel()):mode==='encargo'?stitchRequest({legacyHtml:renderProductRequestForm(requestBrief,requestOutput),output:requestOutput}):mode==='guardado'?stitchSaved({record,legacyHtml:record?comparisonPanel():'',queue:copyQueue,drafts:savedDraftCards()}):bulk();
  root.innerHTML='<div class="prd-shell prd-stitch">'+stitchHeader({store:catalogScope,mode,status,count:rows.length,product:text(record?.name),pending,connected:catalogScope==='both'?PRODUCT_STORES.every(s=>ready(s.key)):ready(store)})+'<div class="prd-body">'+content+'</div></div>';

  for(const detail of root.querySelectorAll('.prd-variant'))if(opened.includes(detail.dataset.prVariant))detail.open=true;
  if(columnsOpen&&root.querySelector('.prd-columns'))root.querySelector('.prd-columns').open=true;
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
 async function switchStore(next){
  if(!['hortimatic','newoldsmok','both'].includes(next)||next===catalogScope)return;
  rememberProductDraft();if(record||requestBrief.url)draftsByShop.set(store,structuredClone(snapshotDraft()));
  resetDraft();catalogScope=next;if(next!=='both')store=next;
  rows=[];page=0;hasMore=false;query='';catalogStock.clear();catalogSelected.clear();catalogFilters={category:'',brand:'',active:''};
  const saved=next==='both'?null:draftsByShop.get(next);if(saved)restoreDraft(saved);else mode='catalogo';
  if(next==='both'||ready(next))await loadCatalog(false);else status='Revisa la conexión de '+next+'.';
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
  const wanted=new Set(list.flatMap(v=>associationIds(v,'product_option_values')));
  try{for(let page=0;[...wanted].some(id=>!attributeNames.has(shop+'|'+id));page++){const data=await invokeShop(shop,'prestashop_read',{resource:'product_option_values',page,page_size:100});for(const value of data.rows||[])attributeNames.set(shop+'|'+value.id,textValue(value.name));if(!data.possibly_more)break;if(!data.rows.length||page>=1000)throw Error('Valores de atributos incompletos.');}}catch{/* Missing names are explicit; no substitutions. */}
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
 async function loadCatalogStock(){
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
 async function loadCatalog(more){
  if(!more){rows=[];page=0;hasMore=false;listPage=0;catalogMore.clear();catalogSelected.clear();catalogStock.clear();}
  const shops=catalogScope==='both'?PRODUCT_STORES.map(s=>s.key):[catalogScope];
  for(const shop of shops){
   if(more&&catalogMore.get(shop)===false)continue;
   const response=await invokeShop(shop,'prestashop_read',{resource:'products',page,page_size:100,sort:'newest'});
   if(response.resource!=='products'||response.page!==page||!Array.isArray(response.rows))throw Error('Listado no verificable.');
   const keys=new Set(rows.map(catalogKey));
   for(const product of response.rows){const row={...product,__store:shop},key=catalogKey(row);if(keys.has(key))throw Error('Producto duplicado entre páginas de la misma tienda.');keys.add(key);rows.push(row);}
   catalogMore.set(shop,!!response.possibly_more);
   if(!more){
    const meta={categories:[],brands:[],tax:{countries:[],rules:[],taxes:[]}};
    await Promise.allSettled([['categories','categories'],['manufacturers','brands'],['countries','countries'],['tax_rules','rules']].map(async([resource,key])=>{
     const all=[];for(let p=0;p<=1000;p++){
      const data=await invokeShop(shop,'prestashop_read',{resource,page:p,page_size:100});all.push(...data.rows);
      if(!data.possibly_more){if(['categories','brands'].includes(key))meta[key]=all;else meta.tax[key]=all;return;}
     }throw Error('Catálogo auxiliar incompleto.');
    }));
    const country=meta.tax.countries.find(c=>String(c.iso_code).toUpperCase()==='ES'&&String(c.active)==='1');
    const taxIds=[...new Set(meta.tax.rules.filter(r=>country&&String(r.id_country)===String(country.id)).map(r=>String(r.id_tax)).filter(id=>/^[1-9]\d{0,14}$/.test(id)))];
    await Promise.allSettled(taxIds.map(async record_id=>{const data=await invokeShop(shop,'prestashop_read',{resource:'taxes',record_id,page:0,page_size:100});meta.tax.taxes.push(...data.rows);}));
    catalogMeta.set(shop,meta);
   }
  }
  const selected=catalogMeta.get(store);catalogCategories=selected?.categories||[];catalogBrands=selected?.brands||[];catalogTaxContext=selected?.tax||{countries:[],rules:[],taxes:[]};
  hasMore=shops.some(shop=>catalogMore.get(shop));page++;
  try{await loadCatalogStock();}catch{/* A failed read is not zero stock. */}
  status='Catálogo de '+(catalogScope==='both'?'ambas tiendas':catalogScope)+': '+rows.length+' productos consultados'+(hasMore?' (parcial).':'.');
 }

 function rememberProductDraft(){
  if(record)draftsByProduct.set(store+'|'+(record.id||record.draft_key||textValue(record.reference)||'new'),structuredClone(snapshotDraft()));
 }
 async function openProduct(id,shop=store){
  rememberProductDraft();
  if(shop!==store||catalogScope==='both'){store=shop;catalogScope=shop;await loadCatalog(false);}
  const saved=draftsByProduct.get(store+'|'+id),queue=copyQueue;
  if(saved){restoreDraft(saved);copyQueue=queue;record=normalizedProduct(await loadItem(store,'products',id)).raw;shopRecords.set(store,record);status='Borrador del producto #'+id+' recuperado y ficha releída.';return;}
  resetDraft();record=normalizedProduct(await loadItem(store,'products',id)).raw;
  shopRecords.clear();shopRecords.set(store,record);
  variants=await combinations(store,record);
  mode='ficha';targets=new Set(PRODUCT_STORES.map(s=>s.key).filter(s=>s!==store));status='Ficha #'+id+' y '+variants.length+' combinaciones leídas de '+store+'. Selecciona campos para preparar cambios.';
 }
 function freshProduct(){
  rememberProductDraft();
  if(catalogScope==='both'){catalogScope=store;rows=[];page=0;hasMore=false;}
  resetDraft();record={draft_key:'draft-'+crypto.randomUUID(),...Object.fromEntries(Object.values(PRODUCT_SECTIONS).flat().map(field=>[field,''])),id:null,active:'0',minimal_quantity:'1',available_for_order:'0',show_price:'1',online_only:'0',on_sale:'0',visibility:'both',condition:'new'};
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
  ensureStitchProductFonts();
  dispose();draftsByShop.clear();draftsByProduct.clear();copyQueue=[];storageReady=false;root=node;owner=actor();if(requestOwner!==owner){requestBrief={operation:'url',store:'hortimatic'};requestOutput='';requestOwner=owner;}const gen=++epoch;root.dataset.prEpoch=String(gen);mode='catalogo';store='hortimatic';catalogScope='hortimatic';catalogMeta.clear();catalogMore.clear();catalogSelected.clear();catalogStock.clear();catalogFilters={category:'',brand:'',active:''};try{catalogColumns=productColumns(JSON.parse(localStorage.getItem('totus-products-columns:'+owner)||'null'));}catch{catalogColumns=[...DEFAULT_PRODUCT_COLUMNS];}catalogViewName='';try{catalogViews=JSON.parse(localStorage.getItem('totus-products-views:'+owner)||'[]').filter(v=>v&&typeof v.name==='string'&&Array.isArray(v.columns)&&[20,50,100].includes(v.size)).map(v=>({...v,columns:productColumns(v.columns),filters:{category:v.filters?.category||'',brand:v.filters?.brand||'',active:['0','1'].includes(v.filters?.active)?v.filters.active:''}}));}catch{catalogViews=[];}status='Comprobando conexiones. Ningún dato se modifica.';rows=[];page=0;hasMore=false;resetDraft();
  if(!allowed()){root.textContent='No tienes permiso de consulta de PrestaShop.';return;}
  root.oninput=e=>{if(e.target.matches('[data-pr-search]')){query=e.target.value;listPage=0;render();const f=root.querySelector('[data-pr-search]');f?.focus();f?.setSelectionRange(query.length,query.length);}};
  root.onchange=e=>{
   if(e.target.matches('[data-pr-org-list]')&&organization){organization[e.target.dataset.prOrgList]=[...e.target.selectedOptions].map(o=>o.value);persistDraft();return;}
   if(e.target.matches('[data-pr-org-features]')&&organization){organization.features=[...e.target.selectedOptions].map(o=>{const [feature_id,value_id]=o.value.split(':');return {feature_id,value_id};});persistDraft();return;}
   if(e.target.matches('[data-pr-org-related]')&&organization){organization.relatedReference=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-gross]')){const rate=productCountryTaxRate(record.id_tax_rules_group,catalogTaxContext),gross=Number(productInputValue('price',e.target.value));if(!e.target.value.trim()||rate===null||productDisplayAmounts(record,rate).gross===null||!Number.isFinite(gross)||gross<0){status='Indica un PVP válido y verifica el grupo de impuestos.';render();return;}overrides.price=(gross/(1+rate/100)).toFixed(6);fields.add('price');invalidate();status='PVP convertido a precio base usando el impuesto verificado de la tienda. Revisa antes de guardar.';render();return;}
   if(e.target.matches('[data-pr-org]')&&organization){organization.fields[e.target.dataset.prOrg]=e.target.value;if(e.target.dataset.prOrg==='id_category_default'&&!organization.categories.includes(e.target.value))organization.categories.push(e.target.value);persistDraft();return;}
   if(e.target.matches('[data-pr-org-category]')&&organization){const id=e.target.dataset.prOrgCategory;organization.categories=e.target.checked?[...new Set([...organization.categories,id])]:organization.categories.filter(x=>x!==id);persistDraft();return;}
   if(e.target.matches('[data-pr-view-name]')){catalogViewName=e.target.value.trim().slice(0,60);return;}
   if(e.target.matches('[data-pr-catalog-view]')){const v=catalogViews.find(v=>v.name===e.target.value);if(v){void work(async()=>{if(['hortimatic','newoldsmok','both'].includes(v.scope)&&v.scope!==catalogScope)await switchStore(v.scope);catalogColumns=productColumns(v.columns);catalogFilters={...v.filters};query=v.query||'';listSize=v.size;listPage=0;catalogViewName=v.name;saveCatalogPreferences();});}return;}
   if(e.target.matches('[data-pr-request]')){requestBrief[e.target.dataset.prRequest]=e.target.value;requestOutput='';if(['operation','store'].includes(e.target.dataset.prRequest))render();else persistDraft();return;}
   if(e.target.matches('[data-pr-price-option]')){priceOptions[e.target.dataset.prPriceOption]=e.target.value;render();return;}
   if(pending||!current())return;
   if(e.target.matches('[data-pr-bulk-field]')){bulkField=e.target.value;bulkItems=[];bulkConfirm='';render();return;}
   if(e.target.matches('[data-pr-bulk-value]')){bulkValue=e.target.value;bulkItems=[];bulkConfirm='';persistDraft();return;}
   if(e.target.matches('[data-pr-bulk-confirm]')){bulkConfirm=e.target.value;persistDraft();return;}
   if(e.target.matches('[data-pr-edit-confirm]')){editConfirm.set(e.target.dataset.prEditConfirm,e.target.value);return;}
   if(e.target.matches('[data-pr-stage-file]')){const input={files:Array.from(e.target.files||[]),dataset:{...e.target.dataset}};void work(async()=>{status=await createWizard.handleFile(input);});return;}
   if(e.target.matches('[data-pr-column]')){const key=e.target.dataset.prColumn;catalogColumns=productColumns(e.target.checked?[...catalogColumns,key]:catalogColumns.filter(k=>k!==key));try{localStorage.setItem('totus-products-columns:'+owner,JSON.stringify(catalogColumns));}catch{}render();return;}
   if(e.target.matches('[data-pr-filter]')){catalogFilters[e.target.dataset.prFilter]=e.target.value;listPage=0;render();return;}
   if(e.target.matches('[data-pr-catalog-select]')){const id=e.target.dataset.prCatalogSelect;e.target.checked?catalogSelected.add(id):catalogSelected.delete(id);render();return;}
   if(e.target.matches('[data-pr-catalog-loaded]')){for(const r of visibleCatalog())e.target.checked?catalogSelected.add(catalogKey(r)):catalogSelected.delete(catalogKey(r));render();return;}
   if(e.target.matches('[data-pr-catalog-all]')){for(const r of visibleCatalog().slice(listPage*listSize,(listPage+1)*listSize))e.target.checked?catalogSelected.add(catalogKey(r)):catalogSelected.delete(catalogKey(r));render();return;}
   if(e.target.matches('[data-pr-page-size]')){listSize=Number(e.target.value);listPage=0;render();return;}
   if(createWizard.handleChange(e.target)){render();return;}
   if(e.target.matches('[data-pr-store]')){const next=e.target.value;void work(()=>switchStore(next));return;}
   if(e.target.matches('[data-pr-target]')){e.target.checked?targets.add(e.target.dataset.prTarget):targets.delete(e.target.dataset.prTarget);invalidate();render();return;}
   if(e.target.matches('[data-pr-field]')){const field=e.target.dataset.prField;e.target.checked?fields.add(field):fields.delete(field);if(!e.target.checked){delete overrides[field];for(const values of targetOverrides.values())delete values[field];}invalidate();render();return;}
   if(e.target.matches('[data-pr-value]')){fields.add(e.target.dataset.prValue);overrides[e.target.dataset.prValue]=e.target.value;invalidate();if(['price','wholesale_price'].includes(e.target.dataset.prValue))render();else persistDraft();return;}
   if(e.target.matches('[data-pr-existing-id]')){targetIds.set(e.target.dataset.prExistingId,e.target.value);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-target-field]')){const dest=e.target.dataset.prTargetStore,field=e.target.dataset.prTargetField,values=targetOverrides.get(dest)||{};targets.add(dest);fields.add(field);values[field]=e.target.value;targetOverrides.set(dest,values);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-lang-store]')){const dest=e.target.dataset.prLangStore,field=e.target.dataset.prLangField,values=targetLanguages.get(dest)||{};values[field]=e.target.value;targetLanguages.set(dest,values);preflight.clear();persistDraft();return;}
   if(e.target.matches('[data-pr-vfield]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVfield,set=variantFields.get(id)||new Set();e.target.checked?set.add(field):set.delete(field);variantFields.set(id,set);invalidate();render();return;}
   if(e.target.matches('[data-pr-vvalue]')){const id=e.target.dataset.prVid,field=e.target.dataset.prVvalue,values=variantOverrides.get(id)||{},chosen=variantFields.get(id)||new Set();chosen.add(field);variantFields.set(id,chosen);values[field]=e.target.value;variantOverrides.set(id,values);invalidate();persistDraft();return;}
   if(e.target.matches('[data-pr-bulk]')){e.target.checked?selection.add(e.target.dataset.prBulk):selection.delete(e.target.dataset.prBulk);bulkItems=[];bulkConfirm='';render();}
  };
  root.onkeydown=e=>{if(['Enter',' '].includes(e.key)&&e.target.matches('[data-pr-action="photo-zoom"]')){e.preventDefault();e.target.click();return;}if(e.key==='Escape'){const panel=root.querySelector('.prd-columns[open]');if(panel){panel.open=false;panel.querySelector('summary')?.focus();}}};
  root.onclick=e=>{if(!e.target.closest('.prd-columns'))root.querySelectorAll('.prd-columns[open]').forEach(d=>d.open=false);const b=e.target.closest('[data-pr-action]');if(!b||!current())return;const a=b.dataset.prAction;
   if(a==='catalog-column-move'){const i=catalogColumns.indexOf(b.dataset.prColumnKey),j=i+Number(b.dataset.prDirection);if(i>=0&&j>=0&&j<catalogColumns.length){[catalogColumns[i],catalogColumns[j]]=[catalogColumns[j],catalogColumns[i]];saveCatalogPreferences();render();}return;}
   if(a==='catalog-view-save'){const name=(root.querySelector('[data-pr-view-name]')?.value||'').trim().slice(0,60);if(!name){status='Escribe un nombre para guardar la vista.';render();return;}const v={name,columns:[...catalogColumns],scope:catalogScope,filters:{...catalogFilters},query,size:listSize};catalogViews=catalogViews.filter(v=>v.name!==name);catalogViews.push(v);catalogViewName=name;saveCatalogPreferences();status='Vista «'+name+'» guardada para esta cuenta.';render();return;}
   if(a==='catalog-view-delete'){catalogViews=catalogViews.filter(v=>v.name!==catalogViewName);catalogViewName='';saveCatalogPreferences();render();return;}
   if(a==='draft-open'){void work(async()=>{rememberProductDraft();const key=b.dataset.prDraftKey,saved=draftsByProduct.get(key);if(!saved)throw Error('Este borrador ya no está disponible.');const queue=copyQueue;restoreDraft(structuredClone(saved));copyQueue=queue;catalogScope=store;await loadCatalog(false);if(record?.id){record=normalizedProduct(await loadItem(store,'products',record.id)).raw;shopRecords.set(store,record);}mode='ficha';status='Borrador recuperado; se conservan sus solicitudes y cambios pendientes.';});return;}
   if(a==='copy-reverse'){void work(async()=>{if(!record?.id)throw Error('Selecciona primero una ficha guardada.');const dest=PRODUCT_STORES.find(s=>s.key!==store).key,ref=textValue(record.reference);if(!ref)throw Error('Falta referencia para buscar la ficha de la otra tienda.');const result=await invokeShop(dest,'prestashop_read',{resource:'products',references:[ref],page:0,page_size:100});if(result.possibly_more)throw Error('La búsqueda de correspondencia está incompleta.');const match=matchExactReference(result.rows,ref);if(!match.product)throw Error('No existe una ficha única en la otra tienda para usarla como origen.');await openProduct(match.product.id,dest);mode='comparar';});return;}
   if(a==='draft-save'){persistDraft();void storageQueue.then(()=>{if(current()){status=storageError?'No se ha podido guardar el borrador local.':'Borrador guardado para esta cuenta.';render();}});return;}
   if(a==='organization-related'){void work(async()=>{if(!organization?.relatedReference?.trim())throw Error('Indica la referencia exacta del producto relacionado.');const response=await invokeShop(store,'prestashop_read',{resource:'products',references:[organization.relatedReference.trim()],page:0,page_size:100});if(response.possibly_more)throw Error('Consulta de referencia incompleta.');const match=matchExactReference(response.rows,organization.relatedReference);if(!match.product||String(match.product.id)===String(record.id))throw Error('Selecciona una referencia única de otro producto de esta tienda.');organization.related=[...new Set([...organization.related,String(match.product.id)])];organization.catalog.related_products=[...organization.catalog.related_products.filter(p=>String(p.id)!==String(match.product.id)),match.product];organization.relatedReference='';status='Producto relacionado añadido al borrador.';});return;}
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
    dialog.append(close,frame);dialog.addEventListener('close',()=>dialog.remove(),{once:true});root.append(dialog);dialog.showModal();return;
   }
   if(a==='photo-zoom'){const id=b.dataset.prImage;if(!associationIds(record,'images').includes(id))return;const dialog=document.createElement('dialog');dialog.className='prd-photo-dialog';const close=document.createElement('button');close.type='button';close.textContent='Cerrar imagen';close.className='btn secondary';close.onclick=()=>dialog.close();const img=document.createElement('img');img.src=productPhoto({id_default_image:id},store).replace('-home_default/','-large_default/');img.alt=textValue(record.name);dialog.append(close,img);dialog.addEventListener('close',()=>dialog.remove(),{once:true});root.append(dialog);dialog.showModal();return;}
   if(a==='photo-view'){const img=root.querySelector('#sticky-main-img');if(img){img.src=productPhoto({id_default_image:b.dataset.prPhoto},store);img.dataset.prImage=b.dataset.prPhoto;}return;}
   if(a==='fiche-validate'){void work(async()=>{targets=new Set([store]);await prepare();mode='guardado';});return;}
   if(['image-stages','variation-stages','stock-stages','organization-review','variation-images','variation-remove','image-remove','image-position','image-metadata','image-replace','image-cover','variation-default'].includes(a)){void work(async()=>{
    if(!record?.id){
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
    const tab=finishFields?'finish':a==='image-replace'?'image_replace':a==='image-stages'?'image':a==='stock-stages'?'stock':a==='variation-images'?'variation_edit':a==='variation-remove'?'remove_variation':a==='image-remove'?'remove_image':['image-position','image-metadata','image-replace'].includes(a)?'image_metadata':'variation';
    status=await createWizard.perform('create-stage-tab',store,plan,fresh,{tab});
    if(a==='image-replace')status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'image_replace',record_id:b.dataset.prImage});
    if(['image-position','image-metadata'].includes(a)){const metadata=await loadItem(store,'totus_product_images',b.dataset.prImage);if(String(metadata.id_product)!==String(record.id))throw Error('La imagen pertenece a otro producto.');status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'image_metadata',record_id:b.dataset.prImage,position:b.dataset.prPosition||metadata.position,legend:metadata.legend,editLegend:a==='image-metadata'});}
    if(['variation-remove','image-remove'].includes(a)){status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:tab,record_id:a==='variation-remove'?b.dataset.prVid:b.dataset.prImage});}
    if(a==='variation-images'){const variant=variants.find(v=>keyFor(v)===b.dataset.prVid);if(!variant?.id)throw Error('Guarda primero esta combinación.');status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'variation_edit',variant_id:String(variant.id),imageIds:associationIds(variant,'images')});}
    if(a==='stock-stages'&&b.dataset.prVid){const variant=variants.find(v=>keyFor(v)===b.dataset.prVid);if(!variant?.__stock)throw Error('No se pudieron verificar las existencias de esta combinación. Actualiza la ficha antes de ajustarlas.');const stock=variant.__stock;status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'stock',stockFields:{id_product_attribute:String(variant.id),quantity:String(stock.quantity),out_of_stock:String(stock.out_of_stock??'2'),depends_on_stock:String(stock.depends_on_stock??'0'),location:String(stock.location||'')}});}
    if(a==='organization-review'){if(!organization||organization.id!==String(record.id)||organization.store!==store)throw Error('Consulta primero la organización de esta ficha.');if(!organization.categories.includes(organization.fields.id_category_default))throw Error('Incluye la categoría principal entre las asociadas.');createWizard.setCatalogs(store,organization.catalog);}
    if(finishFields){status=await createWizard.perform('create-stage-add',store,plan,fresh,{kind:'finish',finishFields,...(a==='organization-review'?{finishAssociations:{categories:organization.categories,tags:organization.tags,accessories:organization.related,product_features:organization.features}}:{})});status+=' Valida y guarda la revisión para enviarla a la tienda.';}
    mode='guardado';
   });return;}

   if(a==='editor-section'){editorSection=b.dataset.prSection;render();return;}
   if(a==='fields-all'||a==='fields-none'){fields=new Set(a==='fields-all'?Object.values(PRODUCT_SECTIONS).flat().filter(f=>record&&record[f]!==undefined&&record[f]!==null):[]);if(a==='fields-none'){overrides={};targetOverrides.clear();}invalidate();render();return;}
   if(a==='catalog-columns-reset'){catalogColumns=[...DEFAULT_PRODUCT_COLUMNS];try{localStorage.removeItem('totus-products-columns:'+owner);}catch{}render();return;}
   if(a==='catalog-clear-selection'){catalogSelected.clear();render();return;}
   if(a==='catalog-copy'){void work(async()=>{
    if(!catalogSelected.size)throw Error('Selecciona los productos que quieras copiar.');
    if(catalogSelected.size>1){copyQueue=rows.filter(p=>catalogSelected.has(catalogKey(p))).map(p=>({store:p.__store||store,id:String(p.id),name:textValue(p.name),reference:textValue(p.reference)}));mode='guardado';status=copyQueue.length+' productos seleccionados. Revisa cada copia y su destino antes de guardar.';return;}
    const [shop,id]=[...catalogSelected][0].split('|');await openProduct(id,shop);fields=new Set(Object.values(PRODUCT_SECTIONS).flat().filter(f=>record[f]!==undefined&&record[f]!==null));mode='comparar';status='Ficha lista para copiar: revisa los campos y el destino antes de crear.';
   });return;}
   if(a==='open-copy-item'){void work(async()=>{await openProduct(b.dataset.id,b.dataset.prShop);fields=new Set(Object.values(PRODUCT_SECTIONS).flat().filter(f=>record[f]!==undefined&&record[f]!==null));mode='comparar';status='Copia de '+textValue(record.name)+': revisa el destino. Los demás productos de la selección se conservan.';});return;}

   if(a==='catalog-stock'){void work(loadCatalogStock);return;}
   if(a==='catalog-export'){const list=visibleCatalog().filter(r=>!catalogSelected.size||catalogSelected.has(catalogKey(r))),keys=catalogColumns.filter(k=>k!=='image'),csv=productCatalogCsv(list,keys,catalogValue),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='productos-'+store+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);return;}
   if(a==='shop-open'){void work(async()=>{const shop=b.dataset.prShop,item=shopRecords.get(shop);if(!item)throw Error('Comprueba primero la correspondencia.');store=shop;await openProduct(item.id);});return;}
   if(a==='shop-check'){void work(async()=>{const shop=b.dataset.prShop;if(!record?.id){store=shop;rows=[];mode='catalogo';return;}const ref=textValue(record.reference);if(!ref.trim())throw Error('Falta referencia para comprobar la otra tienda.');const response=await invokeShop(shop,'prestashop_read',{resource:'products',references:[ref],page:0,page_size:100,sort:'oldest'});if(response.possibly_more)throw Error('Correspondencias incompletas.');const match=matchExactReference(response.rows,ref);if(match.status==='ambiguous')throw Error('Referencia duplicada; selecciona una ficha exacta.');if(match.product)shopRecords.set(shop,await loadItem(shop,'products',match.product.id));else shopRecords.delete(shop);status=match.product?'Ficha encontrada en '+shop+'.':'No existe esa referencia en '+shop+'. Puedes preparar su copia.';});return;}
   if(a==='shop-copy'){void work(async()=>{const shop=b.dataset.prShop;targets=new Set([shop]);const sourceName=PRODUCT_STORES.find(s=>s.key===store).label,destName=PRODUCT_STORES.find(s=>s.key===shop).label;const adapted=targetOverrides.get(shop)||{};for(const field of ['meta_title','meta_description','meta_keywords'])adapted[field]=textValue(record[field]).replaceAll(sourceName,destName);targetOverrides.set(shop,adapted);invalidate();mode='comparar';if(fields.size)await prepare();status='Copia selectiva preparada para '+destName+'. Revisa SEO, enlaces y relaciones; categorías y atributos se eligen en destino. Aún no se ha escrito nada.';});return;}
   if(a.startsWith('create-')){void work(async()=>{const plan=comparison.get(b.dataset.prDest);status=await createWizard.perform(a,b.dataset.prDest,plan,record,{row:b.dataset.prStageRow,tab:b.dataset.prStageTab,kind:b.dataset.prStageKind});if(['create-stage-commit','create-stage-verify'].includes(a)&&record?.id&&plan?.operation==='update'&&String(plan.target_id)===String(record.id)){try{record=await loadItem(plan.store,'products',record.id);variants=await combinations(plan.store,record);}catch{status+=' El guardado está verificado; queda pendiente refrescar la ficha.';}}});return;}
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
   if(a==='catalog-prev'){void work(async()=>{listPage=Math.max(0,listPage-1);await loadCatalogStock();});return;}
   if(a==='catalog-next'){void work(async()=>{if((listPage+1)*listSize>=rows.length&&hasMore)await loadCatalog(true);listPage++;await loadCatalogStock();});return;}
   if(a==='catalog-load')void work(()=>loadCatalog(false));
   if(a==='catalog-more')void work(()=>loadCatalog(true));
   if(a==='open-product')void work(()=>openProduct(b.dataset.id,b.dataset.prShop||store));
   if(a==='compare')void work(prepare);
   if(a==='variant-edit-commit')void work(()=>commitVariant(b.dataset.prDest,b.dataset.prVariation));
   if(a==='edit-commit')void work(()=>commitEdit(b.dataset.prDest));
   if(a==='api-preview')void work(()=>previewXml(b.dataset.prDest));
   if(a==='variant-api-preview')void work(()=>previewVariant(b.dataset.prDest,b.dataset.prVariation));
  };
  render();
  try{const response=await rpc('totus_prestashop_context',{});if(!current()||epoch!==gen)return;connections=response?.connections||[];status='Conexiones consultadas.';if(ready(store))await loadCatalog(false);}
  catch(e){if(current()&&epoch===gen)status='No se han podido comprobar las conexiones: '+(e.message||'error');}
  if(current()&&epoch===gen){try{await storageQueue;const saved=await productDraftStore(owner);if(current()&&epoch===gen){const previousStore=store;if(restoreDraft(saved)){if(store!==previousStore&&ready(store))await loadCatalog(false);status='Borrador recuperado de esta cuenta. Comprueba las operaciones enviadas antes de repetir un guardado.';}}}catch{}storageReady=true;render();}
 }
 function hasDraft(){return !!record&&(fields.size>0||[...variantFields.values()].some(s=>s.size>0));}
 function discardDraft(){if(record)draftsByProduct.delete(store+'|'+(record.id||record.draft_key||textValue(record.reference)||'new'));draftsByShop.delete(store);resetDraft();status='Propuesta descartada.';if(current())render();}
 function dispose(){persistDraft();storageReady=false;if(root){root.onclick=null;root.onchange=null;root.oninput=null;root.onkeydown=null;}root=null;owner=null;++epoch;pending=false;}
 return {mount,dispose,hasDraft,discardDraft,stateSnapshot};
}
