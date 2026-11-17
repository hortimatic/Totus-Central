import {categoryCreationDraft} from '../../category-create-contract.js';
import {sha256Text} from '../../productos-write-contract.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function catalogueIntakeView(row){return {id:row.id,kind:row.kind,name:row.payload.name,parentId:row.payload.parentId,status:row.status,
 recordId:row.recordId,version:row.version,errorCode:row.errorCode,createdAt:row.createdAt,updatedAt:row.updatedAt,
 ...(row.busy?{busy:true}:{}),...(row.superseded?{superseded:true}:{})};}
export function createCatalogueIntakeService({rpc,products,scope,randomId=()=>crypto.randomUUID(),onStepError=()=>{}}){
 const journal=async(action,id,data={})=>{
  need(id===null||uuid(id),'TPV_CATALOGUE_INTENT_INVALID');
  const result=await rpc('totus_tpv_catalogue_intake',{p_action:action,p_id:id,p_scope:scope,p_data:data});
  if(result?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(result.error.message||'')?result.error.message:'TPV_STORAGE_UNAVAILABLE');
  need(result&&Object.hasOwn(result,'data'),'TPV_STORAGE_UNAVAILABLE');return result.data;
 };
 return Object.freeze({
  list:()=>journal('list',null),get:async id=>catalogueIntakeView(await journal('get',id)),
  async prepare(id,input){
   need(uuid(id),'TPV_CATALOGUE_INTENT_INVALID');let payload;
   try{payload=categoryCreationDraft(input);}catch(error){throw Object.assign(Error('TPV_CATALOGUE_FIELDS_REJECTED'),{detail:error.message});}
   const payloadHash=await sha256Text(JSON.stringify(payload));let prior;
   try{prior=await journal('get',id);}catch(error){if(error.message!=='TPV_CATALOGUE_INTENT_NOT_FOUND')throw error;}
   if(prior){need(prior.payloadHash===payloadHash,'TPV_CATALOGUE_INTENT_BOUND');return catalogueIntakeView(prior);}
   need(!await products.categoryClaimed(id,payload),'TPV_CATALOGUE_INTENT_BOUND');let prepared;
   try{prepared=await products.prepareCategory(id,payload);}catch(error){
    if(/^(?:Ya existe|Falta el registro|No hay un inventario|La tienda rechazó|No se pudo comprobar)/.test(error.message||'')&&error.message.length<=240)
     throw Object.assign(Error('TPV_CATALOGUE_FIELDS_REJECTED'),{detail:error.message});throw error;
   }
   need(prepared?.ok===true&&prepared.can_commit===true&&/^[a-f0-9]{64}$/.test(prepared.fingerprint||''),'TPV_PRODUCT_WRITE_UNAVAILABLE');
   return catalogueIntakeView(await journal('create',id,{kind:'category',payload,payloadHash,fingerprint:prepared.fingerprint}));
  },
  async cancel(id){const row=await journal('get',id);if(row.status==='cancelled')return catalogueIntakeView(row);
   need(!await products.categoryClaimed(id,row.payload),'TPV_CATALOGUE_INTENT_REVIEW_REQUIRED');return catalogueIntakeView(await journal('cancel',id));},
  async advance(id){const token=randomId(),row=await journal('start',id,{token});
   if(row.status!=='processing'||row.busy||row.leaseToken!==token)return catalogueIntakeView(row);let result;
   try{result=await products.commitCategory(id,row.payload,row.fingerprint);
    need(result?.ok===true&&result.verified===true&&result.persisted===true&&typeof result.record_id==='string'&&/^[1-9][0-9]{0,14}$/.test(result.record_id),'TPV_CATALOGUE_INTENT_RESULT_INVALID');
   }catch(error){try{onStepError(error);}catch{}return catalogueIntakeView(await journal('failed',id,{token,code:'TPV_CATALOGUE_INTENT_UNCERTAIN'}));}
   return catalogueIntakeView(await journal('verified',id,{token,recordId:result.record_id}));
  }
 });
}
