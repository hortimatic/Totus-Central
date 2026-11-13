import {readPrestashopCombinationXml} from '../../../src/productos-write-contract.js';
import {safeEndpoint,connectionHeaders,boundedJson,boundedText} from './transport.js';
import {prestashopConnectionStore,storeConnection,prestashopQuery,prestashopRows} from '../../../src/prestashop-readonly.js';
// Credentials and requests remain on the server. Never accept a URL, SQL or field name from the browser.
export async function readPrestashopPage(connection,input,{request=fetch,resolve}={}){
 const store=prestashopConnectionStore(connection,input.store),page=prestashopQuery(input);
 if(!connection||storeConnection([connection],store.key)!==connection)throw Error('La conexión no corresponde a la tienda seleccionada.');
 if(connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('La conexión debe estar activada, verificada y autorizada para leer datos reales.');
 const base=new URL(connection.endpoint);
 if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Configura la URL HTTPS del servicio /api de PrestaShop.');
 base.pathname=base.pathname.replace(/\/$/,'')+'/'+page.resource;
 base.searchParams.set('output_format','JSON');
 const associations={products:['categories[id]','images[id]','combinations[id]','product_features[id,id_feature_value]'],combinations:['product_option_values[id]','images[id]'],order_details:['taxes[id]']};
 // Webservice 1.7 requires named association subfields, not a field named associations.
 const display=page.fields.flatMap(field=>field==='associations'?(associations[page.resource]||[]):[field]);
 base.searchParams.set('display','['+display.join(',')+']');
 base.searchParams.set('sort',page.sort==='newest'?'[id_DESC]':'[id_ASC]');
 if(page.from){base.searchParams.set('date','1');base.searchParams.set('filter[date_add]','['+page.from+','+page.to+']');}
 if(page.recordId)base.searchParams.set('filter[id]','['+page.recordId+']');
 const productChildren=['stock_availables','product_suppliers','specific_prices'];
 if(page.productIds)base.searchParams.set(productChildren.includes(page.resource)?'filter[id_product]':'filter[id]','['+page.productIds.join('|')+']');
 if(page.search)base.searchParams.set('filter['+page.searchField+']','%['+page.search+']%');
 if(page.references)base.searchParams.set('filter[reference]','['+page.references.join('|')+']');
 if(page.orderIds)base.searchParams.set('filter[id_order]','['+page.orderIds.join('|')+']');
 if(page.orderId)base.searchParams.set('filter[id_order]','['+page.orderId+']');
 base.searchParams.set('limit',page.offset+','+page.pageSize);
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:{...connectionHeaders(connection),...(input.resource==='combinations'?{Accept:'application/xml'}:{})},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la lectura (HTTP '+response.status+').');}
 const type=response.headers.get('content-type')||'';
 if(/(?:text\/html|application\/xhtml)/i.test(type)){await response.body?.cancel();throw Error('El destino devolvió HTML, no un recurso de PrestaShop.');}
 const parsed=prestashopRows(await boundedJson(response,1048576),page.resource,page.pageSize);
 if(page.from&&parsed.rows.some(row=>!row.date_add||row.date_add<page.from||row.date_add>page.to))throw Error('PrestaShop devolvió registros fuera del periodo. No se han atribuido al intervalo solicitado.');
 if(page.recordId&&parsed.rows.some(row=>row.id!==page.recordId))throw Error('PrestaShop devolvió otro registro de detalle.');
 if(page.orderId&&parsed.rows.some(row=>row.id_order!==page.orderId))throw Error('PrestaShop devolvió líneas de otro pedido.');
 if(page.productIds&&parsed.rows.some(row=>!page.productIds.includes(productChildren.includes(page.resource)?row.id_product:row.id)))throw Error('Producto ajeno a la selección.');
 if(page.references&&parsed.rows.some(row=>!page.references.some(ref=>ref.toUpperCase()===String(row.reference||'').toUpperCase())))throw Error('PrestaShop devolvió una referencia ajena a la selección.');
 if(page.orderIds&&parsed.rows.some(row=>!page.orderIds.includes(row.id_order)))throw Error('Línea ajena a los pedidos seleccionados.');
 return {ok:true,store:store.key,resource:page.resource,page:page.page,page_size:page.pageSize,...parsed};
}

export function prestashopCapabilities(xml,version=''){
 if(typeof xml!=='string'||!/^\s*(?:<\?xml[\s\S]*?\?>\s*)?<prestashop(?:\s|>)/i.test(xml))throw Error('El Webservice no ha devuelto su catálogo de recursos.');
 const block=xml.match(/<api(?:\s[^>]*)?>([\s\S]*?)<\/api>/i)?.[1];if(!block)throw Error('Catálogo de recursos ausente.');
 const resources=[];
 for(const match of block.matchAll(/<([a-z][a-z0-9_]{0,63})\b([^>]*?)(?:\/?>)/gi)){
  if(['description','schema'].includes(match[1]))continue;
  const attrs=match[2];
  const permissions=Object.fromEntries(['GET','POST','PUT','DELETE','HEAD'].map(method=>{
   const re=new RegExp('\\b'+method.toLowerCase()+'\\s*=\\s*(["\\x27])true\\1','i');
   return [method,re.test(attrs)];
  }));
  if(!/\b(?:get|post|put|delete|head)\s*=/i.test(attrs))continue;
  resources.push({name:match[1],readable:permissions.GET,permissions,writable:permissions.POST||permissions.PUT,deletable:permissions.DELETE,full_crud:permissions.GET&&permissions.POST&&permissions.PUT&&permissions.DELETE});
 }
 const names=new Set();for(const r of resources){if(names.has(r.name))throw Error('Catálogo duplicado.');names.add(r.name);}
 return {version:/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)?version:null,resources,tpv_resources:resources.filter(r=>r.readable&&/(?:posp|tpv|cash|caja|till)/i.test(r.name)).map(r=>r.name)};
}
// These are permissions advertised by the destination, not proof of a successful
// write. Keep them separate from operation results and from Totus user privileges.
export function prestashopProductCapabilities(resources){
 const requirements=[
  ['products','Ficha del producto',['GET','POST','PUT']],
  ['combinations','Variaciones',['GET','POST','PUT']],
  ['stock_availables','Existencias',['GET','PUT']],
  ['categories','Categorías y categoría padre',['GET','POST','PUT']],
  ['manufacturers','Marca',['GET','POST','PUT']],
  ['suppliers','Proveedor',['GET','POST','PUT']],
  ['product_options','Atributos de variaciones',['GET','POST','PUT']],
  ['product_option_values','Valores de atributos',['GET','POST','PUT']],
  ['product_features','Características y materiales',['GET','POST','PUT']],
  ['product_feature_values','Valores de características',['GET','POST','PUT']],
  ['tags','Etiquetas',['GET','POST','PUT']],
  ['tax_rule_groups','Grupos de impuestos',['GET']],
  ['languages','Idiomas',['GET']],
  ['images','Imágenes: carga y descarga',['GET','POST','PUT']]
 ];
 const entries=requirements.map(([resource,label,methods])=>{
  const advertised=resources.find(r=>r.name===resource);
  const missing=methods.filter(method=>advertised?.permissions?.[method]!==true);
  return {resource,label,methods,available:!!advertised,missing,ready:missing.length===0};
 });
 return {permissions_complete:entries.every(entry=>entry.ready),verified_by_operation:false,entries};
}
export async function discoverPrestashop(connection,input,{request=fetch,resolve}={}){
 const store=prestashopConnectionStore(connection,input.store);
 if(!connection||storeConnection([connection],store.key)!==connection||connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('La conexión debe estar activada, verificada y autorizada para esta tienda.');
 const base=new URL(connection.endpoint);if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Dirección Webservice no válida.');base.pathname=base.pathname.replace(/\/$/,'')+'/';
 const target=await safeEndpoint(base.href,resolve),response=await request(target.href,{method:'GET',headers:{...connectionHeaders(connection),Accept:'application/xml'},credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo consultar el catálogo del Webservice (HTTP '+response.status+').');}
 const capabilities=prestashopCapabilities(await boundedText(response,131072),response.headers.get('psws-version')||'');
 return {ok:true,store:store.key,...capabilities,product_workspace:prestashopProductCapabilities(capabilities.resources)};
}


// Detail uses an exact resource/ID, never an arbitrary URL or field expression.
// This is intentionally read-only: writes require a separately audited contract.
export async function readPrestashopProductItem(connection,input,{request=fetch,resolve}={}){
 const store=prestashopConnectionStore(connection,input.store);
 if(input.resource==='images'){
  if(!/^[1-9]\d{0,14}$/.test(String(input.product_id||''))||!/^[1-9]\d{0,14}$/.test(String(input.record_id||'')))throw Error('Imagen de producto no válida.');
  const parent=await readPrestashopProductItem(connection,{...input,resource:'products',record_id:input.product_id},{request,resolve});
  if(!Array.isArray(parent.item.associations?.images)||!parent.item.associations.images.some(i=>String(i.id)===String(input.record_id)))throw Error('La imagen no pertenece a este producto.');
  const base=new URL(connection.endpoint);base.pathname=base.pathname.replace(/\/$/,'')+'/images/products/'+input.product_id+'/'+input.record_id;
  const target=await safeEndpoint(base.href,resolve),response=await request(target.href,{method:'GET',headers:connectionHeaders(connection),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
  const mime=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!response.ok||!['image/jpeg','image/png','image/webp','image/gif'].includes(mime)){await response.body?.cancel();throw Error('La tienda no devolvió una fotografía válida.');}
  const reader=response.body?.getReader();if(!reader)throw Error('La imagen está vacía.');const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8388608){await reader.cancel();throw Error('La imagen supera 8 MB.');}chunks.push(value);}}finally{reader.releaseLock();}
  if(!size)throw Error('La imagen está vacía.');let binary='';for(const chunk of chunks)for(let offset=0;offset<chunk.length;offset+=16384)binary+=String.fromCharCode(...chunk.subarray(offset,offset+16384));
  return {ok:true,store:store.key,resource:'images',record_id:String(input.record_id),item:{id:String(input.record_id),id_product:String(input.product_id),mime,base64:btoa(binary)}};
 }
 if(!['products','combinations','manufacturers','suppliers','product_options','product_option_values','product_features','product_feature_values','totus_product_images'].includes(input.resource)||!/^[1-9]\d{0,14}$/.test(String(input.record_id||'')))throw Error('Ficha de producto no válida.');
 if(!connection||storeConnection([connection],store.key)!==connection)throw Error('Conexión distinta de la tienda.');
 if(!connection.enabled||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('Conexión de tienda no verificada.');
 const base=new URL(connection.endpoint);
 if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Dirección Webservice inválida.');
 base.pathname=base.pathname.replace(/\/$/,'')+'/'+input.resource+'/'+input.record_id;
 if(input.resource!=='combinations')base.searchParams.set('output_format','JSON');
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:{...connectionHeaders(connection),...(input.resource==='combinations'?{Accept:'application/xml'}:{})},redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo leer la ficha de PrestaShop (HTTP '+response.status+').');}
 if(/(?:text\/html|application\/xhtml)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La API devolvió HTML en lugar de la ficha.');}
 if(input.resource==='combinations')return {ok:true,store:store.key,resource:'combinations',record_id:String(input.record_id),item:readPrestashopCombinationXml(await boundedText(response,2097152),input.record_id)};
 const raw=await boundedJson(response,2097152);
 const singular={manufacturers:'manufacturer',suppliers:'supplier',product_options:'product_option',product_option_values:'product_option_value',product_features:'product_feature',product_feature_values:'product_feature_value',products:'product',combinations:'combination',totus_product_images:'totus_product_image'}[input.resource],item=raw?.[singular];
 if(!item||typeof item!=='object'||Array.isArray(item)||String(item.id)!==String(input.record_id))throw Error('La ficha de PrestaShop no coincide con el identificador solicitado.');
 return {ok:true,store:store.key,resource:input.resource,record_id:String(input.record_id),item};
}
