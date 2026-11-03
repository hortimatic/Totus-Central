import {safeEndpoint,connectionHeaders,boundedJson} from './transport.js';
import {prestashopStore,storeConnection,prestashopPage,prestashopRows} from '../../../src/prestashop-readonly.js';
// Credentials and requests remain on the server. Never accept a URL, SQL or field name from the browser.
export async function readPrestashopPage(connection,input,{request=fetch,resolve}={}){
 const store=prestashopStore(input.store),page=prestashopPage(input.resource,input.page,input.page_size);
 if(!connection||storeConnection([connection],store.key)!==connection)throw Error('La conexión no corresponde a la tienda seleccionada.');
 if(connection.enabled!==true||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('La conexión debe estar activada, verificada y autorizada para leer datos reales.');
 const base=new URL(connection.endpoint);
 if(base.search||base.hash||!base.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Configura la URL HTTPS del servicio /api de PrestaShop.');
 base.pathname=base.pathname.replace(/\/$/,'')+'/'+page.resource;
 base.searchParams.set('output_format','JSON');
 base.searchParams.set('display','['+page.fields.join(',')+']');
 base.searchParams.set('sort','[id_ASC]');
 base.searchParams.set('limit',page.offset+','+page.pageSize);
 const target=await safeEndpoint(base.href,resolve);
 const response=await request(target.href,{method:'GET',headers:connectionHeaders(connection),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la lectura (HTTP '+response.status+').');}
 const type=response.headers.get('content-type')||'';
 if(/(?:text\/html|application\/xhtml)/i.test(type)){await response.body?.cancel();throw Error('El destino devolvió HTML, no un recurso de PrestaShop.');}
 const parsed=prestashopRows(await boundedJson(response,1048576),page.resource,page.pageSize);
 return {ok:true,store:store.key,resource:page.resource,page:page.page,page_size:page.pageSize,...parsed};
}
