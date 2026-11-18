/** Short-lived read snapshots, never credentials or evidence of a remote sale.
 * Remote synchronization must recheck the operator's current authorization.
 */
const pick=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
function project(kind,data){
 if(kind==='context')return {actorId:data.actorId,workstations:data.workstations.map(row=>({
  ...pick(row,['connectionId','connectionRevision','storeId','storeName','shopId','drawerId','drawerName','canSell','canOpen','canReconcile','environment']),
  ...(row.session?{session:pick(row.session,['id','status','openingCents','openedAt','storeId','drawerId'])}:{}),
  nativeProfile:pick(row.nativeProfile,['counter_customer_id','counter_address_id','shop_id','currency'])}))};
 if(kind==='categories')return {has_more:data.has_more,categories:data.categories.map(row=>pick(row,['id','name','parentName']))};
 if(kind==='payment-options')return {...pick(data,['connectionId','shopId','drawerId','revision']),
  options:{...pick(data.options,['enabledMethods']),labels:pick(data.options?.labels,['cash','card','bizum','transfer']),referencePolicy:pick(data.options?.referencePolicy,['cash','card','bizum','transfer'])},choices:data.choices?.map(row=>pick(row,['id','label','nativeLabel']))};
 throw Error('Consulta local no admitida.');
}
export function createOfflineWorkstationCache({actorId,storage,now=Date.now}){
 const key=(kind,scope)=>'totus:tpv:read:v1:'+JSON.stringify([actorId,kind,scope]);
 const revocationKey=key('revocation',''),generation=()=>storage.getItem(revocationKey)||'';
 return Object.freeze({
  revision:generation,
  revoke(){storage.setItem(revocationKey,crypto.randomUUID());},
  put(kind,scope,data,{expectedRevision=generation()}={}){
   if(expectedRevision!==generation())throw Error('El acceso ha cambiado durante la consulta.');
   const value=project(kind,data),readAt=now();if(kind==='context'&&value.actorId!==actorId)throw Error('La consulta pertenece a otra cuenta.');
   const fingerprint=JSON.stringify(value);if(fingerprint.length>1000000)throw Error('La consulta es demasiado grande para guardarla en este dispositivo.');
   storage.setItem(key(kind,scope),JSON.stringify({actorId,kind,scope,readAt,value,fingerprint,generation:expectedRevision}));return {data:value,readAt};
  },
  get(kind,scope){
   const raw=storage.getItem(key(kind,scope));if(!raw||raw.length>2100000)return null;
   const row=JSON.parse(raw),instant=now();
   if(row.generation!==generation()||row.actorId!==actorId||row.kind!==kind||row.scope!==scope||!Number.isSafeInteger(row.readAt)||instant<row.readAt||instant-row.readAt>=300000)return null;
   const value=project(kind,row.value);
   if(JSON.stringify(value)!==row.fingerprint||kind==='context'&&value.actorId!==actorId)return null;
   return {data:value,readAt:row.readAt};
  }
 });
}
