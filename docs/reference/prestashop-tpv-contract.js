import {prestashopStore} from '../../src/prestashop-readonly.js';

// Logical contract only. These are NOT PrestaShop resource names, SQL tables or TPV module fields.
export const TPV_FEEDS=Object.freeze(['closings','cash_movements']);
export const TPV_MOVEMENT_KINDS=Object.freeze(['withdrawal','deposit','transfer','sale_cash','sale_card','adjustment']);
const requestFields=new Set(['store','feed','from','to','drawer','page','page_size']);
const idPattern=/^[1-9]\d{0,14}$/;
const uuidPattern=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const offsetDateTime=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
const madrid=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'});
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const nonnegativeCents=(value,field,nullable=false)=>{
 if(nullable && value===null)return null;
 if(!Number.isSafeInteger(value)||value<0)throw Error('Importe TPV inválido en '+field+' (céntimos enteros no negativos).');
 return value;
};
function dayNumber(s){
 if(typeof s!=='string'||! /^\d{4}-\d{2}-\d{2}$/.test(s))throw Error('Fecha TPV no válida: usar YYYY-MM-DD.');
 const [y,m,d]=s.split('-').map(Number),utc=Date.UTC(y,m-1,d);
 if(new Date(utc).toISOString().slice(0,10)!==s)throw Error('Fecha TPV inexistente.');
 return utc/86400000;
}
function madridDay(value){
 if(typeof value!=='string'||!offsetDateTime.test(value))throw Error('Hora TPV sin zona horaria explícita.');
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))throw Error('Hora TPV no válida.');
 const parts=Object.fromEntries(madrid.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 return parts.year+'-'+parts.month+'-'+parts.day;
}
function verifiedDrawer(store,drawer){
 // Mapping must come from reviewed PrestaShop evidence and Totus's existing drawer ID.
 if(!drawer||typeof drawer!=='object'||Array.isArray(drawer)||drawer.store!==store ||
   typeof drawer.totus_drawer_id!=='string'||!uuidPattern.test(drawer.totus_drawer_id)||
   typeof drawer.tpv_drawer_id!=='string'||!idPattern.test(drawer.tpv_drawer_id)||
   drawer.confirmed!==true||typeof drawer.evidence_id!=='string'||!uuidPattern.test(drawer.evidence_id))
   throw Error('Falta correspondencia de cajón TPV confirmada para esta tienda.');
 return Object.freeze({store,totus_drawer_id:drawer.totus_drawer_id,tpv_drawer_id:drawer.tpv_drawer_id});
}
export function tpvReadRequest(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!requestFields.has(k)))
  throw Error('Parámetros TPV no permitidos: no se admite SQL ni nombres de tablas.');
 const {store,feed,from,to,drawer,page=0,page_size=25}=input;
 prestashopStore(store);
 if(!TPV_FEEDS.includes(feed))throw Error('Consulta TPV no permitida.');
 const begin=dayNumber(from),end=dayNumber(to);
 if(end<begin||end-begin>30)throw Error('Periodo TPV limitado a 31 días naturales.');
 if(!Number.isSafeInteger(page)||page<0||page>1000||
    !Number.isSafeInteger(page_size)||page_size<1||page_size>100)throw Error('Paginación TPV no permitida.');
 return Object.freeze({store,feed,from,to,drawer:verifiedDrawer(store,drawer),page,page_size});
}
function normalizeOne(row,request){
 if(!row||typeof row!=='object'||Array.isArray(row)||!idPattern.test(String(row.source_id||'')))
  throw Error('Registro TPV sin identificador de origen válido.');
 if(String(row.source_drawer_id)!==request.drawer.tpv_drawer_id)
  throw Error('El TPV devolvió un movimiento de otro cajón.');
 if(row.store!==request.store)throw Error('El TPV devolvió datos de otra tienda.');
 const at=request.feed==='closings'?row.closed_at:row.occurred_at;
 const date=madridDay(at);
 if(date<request.from||date>request.to)throw Error('Registro TPV fuera del periodo Madrid solicitado.');
 const key=request.store+':'+request.feed+':'+request.drawer.tpv_drawer_id+':'+row.source_id;
 if(request.feed==='closings'){
  if(row.status!=='closed')throw Error('No se importa un cierre abierto o sin confirmar.');
  madridDay(row.opened_at);
  if(new Date(row.opened_at)>new Date(row.closed_at))throw Error('Cierre anterior a su apertura.');
  return Object.freeze({
   source_key:key,store:request.store,totus_drawer_id:request.drawer.totus_drawer_id,
   source_drawer_id:request.drawer.tpv_drawer_id,source_id:String(row.source_id),
   opened_at:row.opened_at,closed_at:row.closed_at,status:'closed',
   opening_cash_cents:nonnegativeCents(row.opening_cash_cents,'apertura'),
   expected_cash_cents:nonnegativeCents(row.expected_cash_cents,'esperado',true),
   counted_cash_cents:nonnegativeCents(row.counted_cash_cents,'contado',true)
  });
 }
 if(!TPV_MOVEMENT_KINDS.includes(row.kind))throw Error('Movimiento TPV sin clasificación confirmada.');
 if(row.currency!=='EUR')throw Error('Moneda TPV no validada.');
 if(row.kind==='sale_card'&&row.payment_method!=='card'||
    row.kind==='sale_cash'&&row.payment_method!=='cash'||
    ['withdrawal','deposit','transfer'].includes(row.kind)&&row.payment_method!=='cash')
  throw Error('Método de pago TPV incompatible con el movimiento.');
 if(typeof row.payment_method!=='string'||!['cash','card','other'].includes(row.payment_method))
  throw Error('Método de pago TPV desconocido.');
 if(row.kind==='withdrawal'&&row.direction!=='out' ||
    row.kind==='deposit'&&row.direction!=='in'||
    row.kind==='sale_cash'&&row.direction!=='in'||
    row.kind==='sale_card'&&row.direction!=='non_cash' ||
    row.kind==='transfer'&&row.direction!=='internal'||
    row.kind==='adjustment'&&!['in','out'].includes(row.direction))
  throw Error('Dirección de movimiento TPV sin correspondencia.');
 return Object.freeze({
  source_key:key,store:request.store,totus_drawer_id:request.drawer.totus_drawer_id,
  source_drawer_id:request.drawer.tpv_drawer_id,source_id:String(row.source_id),
  occurred_at:at,kind:row.kind,direction:row.direction,payment_method:row.payment_method,
  currency:'EUR',amount_cents:nonnegativeCents(row.amount_cents,'movimiento')
 });
}
export function validateTpvBatch(input,payload,knownSourceKeys=[]){
 const request=tpvReadRequest(input);
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Array.isArray(payload.rows)||
   payload.store!==request.store||payload.feed!==request.feed||payload.page!==request.page)
  throw Error('Respuesta TPV no corresponde a la consulta.');
 if(payload.rows.length>request.page_size)throw Error('Página TPV superior al límite solicitado.');
 const seen=new Set(knownSourceKeys);
 const rows=payload.rows.map(row=>{
  const entry=normalizeOne(row,request);
  if(seen.has(entry.source_key))throw Error('Registro TPV duplicado entre páginas o consultas.');
  seen.add(entry.source_key);
  return entry;
 });
 return Object.freeze({store:request.store,feed:request.feed,page:request.page,page_size:request.page_size,
  rows,possibly_more:rows.length===request.page_size,source_keys:rows.map(x=>x.source_key),
  persisted:false,totus_accounting_modified:false});
}
export function tpvCapabilityStatus(mapping){
 if(!mapping?.module_verified||!mapping?.schema_verified||!mapping?.drawer_map_verified||
    !mapping?.server_adapter_verified) return Object.freeze({
  status:'blocked',reason:'Pendiente de módulo TPV, columnas y correspondencia de cajones comprobados; no hay lectura real.'
 });
 return Object.freeze({status:'ready_for_authorized_test',reason:'Contrato comprobado; falta la prueba real autorizada de cada operación.'});
}
