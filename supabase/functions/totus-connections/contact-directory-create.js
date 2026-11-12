import {directoryLocalized} from '../../../src/contact-directory-contract.js';
import {directoryBlankXml,directoryXmlField,directoryXmlLanguages,selectedXmlValues,prepareProductStageXml,sha256Text} from '../../../src/productos-write-contract.js';
import {boundedText} from './transport.js';

// Create against native resources only. Existing customers are never used as a
// template; passwords are generated only on the server and never returned.
export async function createDirectoryRecord({q,commit,signature,previous,journal,xml,list,send,url,same}){
 const parent=q.resource==='addresses'?({clientes:'id_customer',proveedores:'id_supplier',marcas:'id_manufacturer'}[q.kind]):q.resource==='product_option_values'?'id_attribute_group':q.resource==='product_feature_values'?'id_feature':null;
 const identityField=q.resource==='customers'?'email':q.resource==='addresses'?'alias':q.resource==='product_feature_values'?'value':'name';
 const identity=q.fields[identityField];
 const scopeHash=await sha256Text(JSON.stringify([q.resource,parent?q.fields[parent]:null,identity.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')]));
 let languageRows=[];
 if(Object.keys(q.fields).some(field=>directoryLocalized(q.resource,field))){languageRows=await list('languages',{display:'[id,iso_code,active]'});if(!languageRows.length||languageRows.length>=100||!languageRows.some(l=>String(l.active)==='1'))throw Error('No hay un inventario de idiomas completo.');}
 const defaultLanguage=String((languageRows.find(l=>l.iso_code==='es'&&String(l.active)==='1')||languageRows.find(l=>String(l.active)==='1'))?.id||'');
 const text=value=>Array.isArray(value)?String(value.find(v=>String(v.id)===defaultLanguage)?.value??value[0]?.value??''):String(value??'');
 const equalIdentity=row=>text(row[identityField]).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')===identity.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es')&&(!parent||String(row[parent])===q.fields[parent]);
 async function candidates(){
  const out=[],seen=new Set();for(let page=0;page<100;page++){
   const result=await list(q.resource,{display:'[id,'+identityField+(parent?','+parent:'')+']',...(!/[\[\]|%]/.test(identity)?{['filter['+identityField+']']:'['+identity+']'}:{}),...(parent?{['filter['+parent+']']:'['+q.fields[parent]+']'}:{})},page);
   for(const row of result){if(seen.has(String(row.id)))throw Error('La búsqueda de duplicados devolvió páginas repetidas.');seen.add(String(row.id));if(equalIdentity(row))out.push(row);}
   if(result.length<100)return out;
  }throw Error('No se pudo terminar la búsqueda de duplicados.');
 }
 const fields=Object.fromEntries(Object.entries(q.fields).map(([field,value])=>[field,directoryLocalized(q.resource,field)?languageRows.map(l=>({language_id:String(l.id),value})):value]));
 async function verify(id){
  const read=await xml(url(q.resource,id,{display:'[id,'+Object.keys(q.fields).join(',')+']',...(languageRows.length?{language:'['+languageRows.map(l=>String(l.id)).join('|')+']'}:{})}));
  if(directoryXmlField(read,q.resource,'id')!==String(id))throw Error('La tienda devolvió otra ficha.');
  const changes=[];for(const [field,value]of Object.entries(fields)){if(Array.isArray(value)){const ids=directoryXmlLanguages(read,q.resource,field);for(const t of value){if(!ids.includes(t.language_id))throw Error('Falta una traducción de la ficha creada.');changes.push({field,value:t.value,language_id:t.language_id});}}else changes.push({field,value});}
  const checked=selectedXmlValues(read,q.resource,id,changes);if(checked.changes.some(c=>!same(c.field,c.before,c.value)))throw Object.assign(Error('La ficha creada no coincide con los campos enviados.'),{code:'FIELDS_DIFFER'});
  return {ok:true,store:q.store,kind:q.kind,resource:q.resource,record_id:String(id),persisted:true,verified:true,request_id:q.request_id};
 }
 const matches=await candidates(),baselineIds=matches.map(r=>String(r.id));
 if(previous){
  const possible=previous.record_id?[{id:String(previous.record_id)}]:matches.filter(r=>!(previous.baseline_ids||[]).includes(String(r.id)));
  const verified=[];for(const candidate of possible)try{verified.push(await verify(candidate.id));}catch{}
  if(verified.length!==1)throw Error('El alta anterior sigue sin un resultado inequívoco. Actualiza esta misma solicitud; no se enviará otro POST.');
  if(previous.status!=='completed')await journal.complete(signature,verified[0].record_id);
  return {...verified[0],replayed:true,reconciled:previous.status!=='completed'};
 }
 if(matches.length&&q.resource!=='addresses')throw Error('Ya existe un registro con ese correo o nombre (ID '+matches[0].id+'). Abre su ficha para editarlo.');
 if(q.resource==='addresses')for(const candidate of matches){try{await verify(candidate.id);throw Error('DUPLICATE:'+candidate.id);}catch(error){if(error.code==='FIELDS_DIFFER')continue;if(error.message.startsWith('DUPLICATE:'))throw Error('Ya existe esta dirección (ID '+candidate.id+'). Abre su ficha para editarla.');throw error;}}
 for(const [field,resource]of Object.entries({id_default_group:'groups',id_lang:'languages',id_country:'countries',id_state:'states',id_customer:'customers',id_supplier:'suppliers',id_manufacturer:'manufacturers',id_attribute_group:'product_options',id_feature:'product_features'}))if(Number(q.fields[field])>0){const found=await list(resource,{'filter[id]':'['+q.fields[field]+']'});if(found.length!==1||String(found[0].id)!==q.fields[field])throw Error('Falta el registro de destino para '+field+'.');}
 const fingerprint=await sha256Text(JSON.stringify({fields,scopeHash,baselineIds}));
 if(!commit)return {ok:true,store:q.store,kind:q.kind,resource:q.resource,fingerprint,persisted:false,can_commit:true};
 if(fingerprint!==q.fingerprint)throw Error('Los datos de destino cambiaron desde la revisión. Actualiza antes de crear.');
 const second=await candidates();if(JSON.stringify(second.map(r=>String(r.id)))!==JSON.stringify(baselineIds))throw Error('El directorio cambió durante la revisión. No se ha escrito nada.');
 const claim=await journal.claim(signature,undefined,{scope_hash:scopeHash,baseline_ids:baselineIds});if(claim?.status!=='claimed')throw Error('Ya hay un alta en curso para este registro.');
 let createdId=null,status=null;
 try{
  const values={...fields};if(q.resource==='customers')values.passwd=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const response=await send(url(q.resource),'POST',prepareProductStageXml(directoryBlankXml(q.resource),q.resource,values));status=response.status;
  if(response.ok){const text=await boundedText(response,2097152);createdId=directoryXmlField(text,q.resource,'id');}else await response.body?.cancel();
 }catch{}
 try{
  if(createdId){const result=await verify(createdId);await journal.complete(signature,createdId);return result;}
  // A native HTTP 500 may occur after saving. Reconcile one newly observed ID;
  // never infer persistence from the status code or repeat the POST.
  if(status===null||status===500||status>=200&&status<300){const found=(await candidates()).filter(r=>!baselineIds.includes(String(r.id))),verified=[];for(const row of found)try{verified.push(await verify(row.id));}catch{}if(verified.length===1){await journal.complete(signature,verified[0].record_id);return {...verified[0],reconciled:true};}}
 }catch{}
 await journal.uncertain(signature,createdId||undefined);throw Error('No se pudo verificar el alta'+(status?' (HTTP '+status+')':'')+'. Actualiza esta misma solicitud antes de repetirla.');
}
