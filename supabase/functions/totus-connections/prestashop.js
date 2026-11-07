import {safeEndpoint,connectionHeaders,boundedJson,boundedText} from './transport.js';
import {prestashopStore,storeConnection,prestashopQuery,prestashopRows} from '../../../src/prestashop-readonly.js';
// Credentials and requests remain on the server. Never accept a URL, SQL or field name from the browser.
export async function readPrestashopPage(connection,input,{request=fetch,resolve}={}){
 const store=prestashopStore(input.store),page=prestashopQuery(input);
 if(!connection||storeConnection([connection],store.key)!==connection)throw Error('La conexión no corresponde a la tienda seleccionada.');
 if(connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('La conexión debe estar activada, verificada y autorizada para leer datos reales.');
 const base=new URL(connection.endpoint);
 if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Configura la URL HTTPS del servicio /api de PrestaShop.');
 base.pathname=base.pathname.replace(/\/$/,'')+'/'+page.resource;
 base.searchParams.set('output_format','JSON');
 const associations={products:['categories[id]','images[id]','combinations[id]'],combinations:['product_option_values[id]','images[id]'],order_details:['taxes[id]']};
 // Webservice 1.7 requires named association subfields, not a field named associations.
 const display=page.fields.flatMap(field=>field==='associations'?(associations[page.resource]||[]):[field]);
 base.searchParams.set('display','['+display.join(',')+']');
 base.searchParams.set('sort',page.sort==='newest'?'[id_DESC]':'[id_ASC]');
 if(page.from){base.searchParams.set('date','1');base.searchParams.set('filter[date_add]','['+page.from+','+page.to+']');}
 if(page.recordId)base.searchParams.set('filter[id]','['+page.recordId+']');
 if(page.productIds)base.searchParams.set(page.resource==='stock_availables'?'filter[id_product]':'filter[id]','['+page.productIds.join('|')+']');
 if(page.references)base.searchParams.set('filter[reference]','['+page.references.join('|')+']');
 if(page.orderIds)base.searchParams.set('filter[id_order]','['+page.orderIds.join('|')+']');
 if(page.orderId)base.searchParams.set('filter[id_order]','['+page.orderId+']');
 base.searchParams.set('limit',page.offset+','+page.pageSize);
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:connectionHeaders(connection),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la lectura (HTTP '+response.status+').');}
 const type=response.headers.get('content-type')||'';
 if(/(?:text\/html|application\/xhtml)/i.test(type)){await response.body?.cancel();throw Error('El destino devolvió HTML, no un recurso de PrestaShop.');}
 const parsed=prestashopRows(await boundedJson(response,1048576),page.resource,page.pageSize);
 if(page.from&&parsed.rows.some(row=>!row.date_add||row.date_add<page.from||row.date_add>page.to))throw Error('PrestaShop devolvió registros fuera del periodo. No se han atribuido al intervalo solicitado.');
 if(page.recordId&&parsed.rows.some(row=>row.id!==page.recordId))throw Error('PrestaShop devolvió otro registro de detalle.');
 if(page.orderId&&parsed.rows.some(row=>row.id_order!==page.orderId))throw Error('PrestaShop devolvió líneas de otro pedido.');
 if(page.productIds&&parsed.rows.some(row=>!page.productIds.includes(page.resource==='stock_availables'?row.id_product:row.id)))throw Error('Producto ajeno a la selección.');
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
 const store=prestashopStore(input.store);
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
 const store=prestashopStore(input.store);
 if(!['products','combinations'].includes(input.resource)||!/^[1-9]\d{0,14}$/.test(String(input.record_id||'')))throw Error('Ficha de producto no válida.');
 if(!connection||storeConnection([connection],store.key)!==connection)throw Error('Conexión distinta de la tienda.');
 if(!connection.enabled||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('Conexión de tienda no verificada.');
 const base=new URL(connection.endpoint);
 if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Dirección Webservice inválida.');
 base.pathname=base.pathname.replace(/\/$/,'')+'/'+input.resource+'/'+input.record_id;
 base.searchParams.set('output_format','JSON');
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:connectionHeaders(connection),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('No se pudo leer la ficha de PrestaShop (HTTP '+response.status+').');}
 if(/(?:text\/html|application\/xhtml)/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La API devolvió HTML en lugar de la ficha.');}
 const raw=await boundedJson(response,2097152);
 const singular=input.resource==='products'?'product':'combination',item=raw?.[singular];
 if(!item||typeof item!=='object'||Array.isArray(item)||String(item.id)!==String(input.record_id))throw Error('La ficha de PrestaShop no coincide con el identificador solicitado.');
 return {ok:true,store:store.key,resource:input.resource,record_id:String(input.record_id),item};
}
