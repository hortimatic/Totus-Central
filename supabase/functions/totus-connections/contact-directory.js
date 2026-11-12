import {directoryQuery,directoryRows,DIRECTORY_FIELDS} from '../../../src/contact-directory-contract.js';
import {storeConnection} from '../../../src/prestashop-readonly.js';
import {safeEndpoint,connectionHeaders,boundedJson} from './transport.js';

// The authenticated handler must check DIRECTORY_KINDS[kind].module before
// calling this transport. No credentials or unfiltered native records escape.
export async function readContactDirectory(connection,input,{request=fetch,resolve}={}){
 const q=directoryQuery(input);
 if(!connection||storeConnection([connection],q.store)!==connection||connection.id!==q.id||connection.revision!==q.revision)throw Error('La conexión no corresponde a la tienda o revisión seleccionada.');
 if(!connection.enabled||connection.verified_revision!==connection.revision||connection.real_data_authorized!==true)throw Error('Activa y verifica la conexión antes de consultar el directorio.');
 const url=new URL(connection.endpoint);
 if(url.search||url.hash||!url.pathname.replace(/\/$/,'').endsWith('/api'))throw Error('Dirección de API no válida.');
 url.pathname=url.pathname.replace(/\/$/,'')+'/'+q.resource;
 const associationFields={products:['combinations[id]','product_features[id,id_feature_value]','categories[id]','images[id]'],combinations:['product_option_values[id]','images[id]']};
 const fields=DIRECTORY_FIELDS[q.resource].flatMap(f=>f==='associations'?(associationFields[q.resource]||[]):[f]);
 url.searchParams.set('output_format','JSON');url.searchParams.set('display','['+fields.join(',')+']');
 url.searchParams.set('sort','[id_ASC]');url.searchParams.set('limit',q.page*q.page_size+','+q.page_size);
 if(q.record_id)url.searchParams.set('filter[id]','['+q.record_id+']');
 for(const [key,field]of [['customer_ids','id_customer'],['order_ids','id_order'],['product_ids',q.resource==='products'?'id':'id_product']])if(q[key])url.searchParams.set('filter['+field+']','['+q[key].join('|')+']');
 for(const [key,field]of [['supplier_id','id_supplier'],['manufacturer_id','id_manufacturer']])if(q[key])url.searchParams.set('filter['+field+']','['+q[key]+']');
 const target=await safeEndpoint(url.href,resolve),response=await request(target.href,{method:'GET',headers:connectionHeaders(connection),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok){await response.body?.cancel();throw Error('PrestaShop rechazó la consulta del directorio (HTTP '+response.status+').');}
 if(!/application\/json/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw Error('La tienda no devolvió un directorio JSON.');}
 const rows=directoryRows(await boundedJson(response),q.resource,q.page_size);
 for(const row of rows){
  if(q.record_id&&row.id!==String(q.record_id))throw Error('La tienda devolvió otro registro.');
  for(const [key,field]of [['customer_ids','id_customer'],['order_ids','id_order'],['product_ids',q.resource==='products'?'id':'id_product']])if(q[key]&&!q[key].includes(row[field]))throw Error('La tienda no respetó el filtro de relación.');
  for(const [key,field]of [['supplier_id','id_supplier'],['manufacturer_id','id_manufacturer']])if(q[key]&&row[field]!==String(q[key]))throw Error('La tienda no respetó el titular del directorio.');
 }
 return {ok:true,store:q.store,kind:q.kind,resource:q.resource,page:q.page,page_size:q.page_size,possibly_more:rows.length===q.page_size,rows};
}
