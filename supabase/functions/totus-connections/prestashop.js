import {PRESTASHOP_RESOURCES,linkedPrestashop,prestashopPage,prestashopReadUrl,prestashopRows} from '../../../src/prestashop-core.js';
import {safeEndpoint,connectionHeaders,boundedJson} from './transport.js';
// Read only. The configured Webservice key never reaches Totus' browser.
export async function readPrestashop(connection,input,{request=fetch,resolve}={}){
 if(connection.protocol!=='prestashop'||!connection.enabled||connection.verified_revision!==connection.revision)throw Error('La conexión PrestaShop debe estar activada y probada.');
 if(!connection.free_confirmed||!connection.real_data_authorized)throw Error('La conexión no tiene autorizada la lectura de datos reales.');
 const {connection:linked}=linkedPrestashop([connection],input.store);
 if(!linked)throw Error('Conexión y tienda no vinculadas. Revisa el nombre exacto del perfil.');
 if(!PRESTASHOP_RESOURCES[input.resource])throw Error('Recurso PrestaShop no permitido.');
 const {offset,limit}=prestashopPage(input),target=prestashopReadUrl(connection,{...input,offset,limit});
 const url=await safeEndpoint(target,resolve),headers=connectionHeaders(connection);
 const response=await request(url.href,{method:'GET',headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('El PrestaShop rechazó la lectura (HTTP '+response.status+').');}
 if(/text\/html|application\/xhtml/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('El destino devolvió HTML en lugar de datos de PrestaShop.');}
 const data=await boundedJson(response,524288),rows=prestashopRows(input.resource,data);
 if(rows.length>limit)throw Error('El PrestaShop devolvió más filas que el límite solicitado.');
 return {ok:true,store:input.store,resource:input.resource,offset,limit,rows,possibly_more:rows.length===limit,read_at:new Date().toISOString(),origin:'prestashop_webservice',writes:false};
}
