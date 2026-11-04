import {safeEndpoint,connectionHeaders,boundedJson} from './transport.js';
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
 base.searchParams.set('display','['+page.fields.join(',')+']');
 base.searchParams.set('sort',page.sort==='newest'?'[id_DESC]':'[id_ASC]');
 if(page.from){base.searchParams.set('date','1');base.searchParams.set('filter[date_add]','['+page.from+','+page.to+']');}
 if(page.recordId)base.searchParams.set('filter[id]','['+page.recordId+']');
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
 return {ok:true,store:store.key,resource:page.resource,page:page.page,page_size:page.pageSize,...parsed};
}
