import {productIntakeDraft,productIntakeBase,productIntakePlan,productIntakeStage} from '../product-intake-contract.js';
import {inspectTransparentProductPng} from '../../productos-png.js';
import {sha256Text} from '../../productos-write-contract.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const nativeId=value=>typeof value==='string'&&/^[1-9][0-9]{0,14}$/.test(value);
const requestId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
/** Only this projection crosses the authenticated browser boundary. Native
 * request payloads, image bytes and coordinator leases stay on the server. */
export function productIntakeView(row){
 need(row&&Array.isArray(row.steps),'TPV_PRODUCT_RESULT_INVALID');
 return {id:row.id,name:row.payload.name,reference:row.payload.reference,status:row.status,currentStep:row.currentStep,
  version:row.version,errorCode:row.errorCode,createdAt:row.createdAt,updatedAt:row.updatedAt,
  productId:row.steps.find(step=>step.key==='base'&&step.status==='verified')?.recordId||null,
  steps:row.steps.map(({key,kind,label,status})=>({key,kind,label,status})),
  ...(row.busy?{busy:true}:{}),...(row.superseded?{superseded:true}:{})};
}
export function createProductIntakeService({rpc,products,scope,uuid=()=>crypto.randomUUID()}){
 const journal=async(action,id,data={})=>{
  need(id===null||requestId(id),'TPV_PRODUCT_REQUEST_INVALID');
  const response=await rpc('totus_tpv_product_intake',{p_action:action,p_id:id,p_scope:scope,p_data:data});
  if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_STORAGE_UNAVAILABLE');
  need(response&&Object.hasOwn(response,'data'),'TPV_STORAGE_UNAVAILABLE');return response.data;
 };
 const existing=async id=>{try{return await journal('get',id);}catch(error){if(error.message==='TPV_PRODUCT_NOT_FOUND')return null;throw error;}};
 const validateAttributes=async draft=>{
  const groups=new Map();
  for(const id of new Set(draft.variants.flatMap(row=>row.attributeValueIds))){
   const attribute=await products.attribute(id),group=String(attribute.id_attribute_group||'');
   need(String(attribute.id)===id&&nativeId(group),'TPV_PRODUCT_METADATA_INVALID');groups.set(id,group);
  }
  for(const variant of draft.variants){const selected=variant.attributeValueIds.map(id=>groups.get(id));
   need(new Set(selected).size===selected.length,'TPV_PRODUCT_ATTRIBUTE_GROUP_REPEATED');}
 };
 const currency=async()=>{
  // The selected native shop must expose one unambiguous matching currency.
  const result=await products.list('currencies',0),rows=result.rows;
  need(Array.isArray(rows)&&rows.length<100,'TPV_PRODUCT_METADATA_INVALID');
  const matches=rows.filter(row=>row.iso_code===scope.currency);
  need(matches.length===1&&nativeId(String(matches[0].id)),'TPV_PRODUCT_CURRENCY_INVALID');return String(matches[0].id);
 };
 return Object.freeze({
  list:()=>journal('list',null),
  get:async id=>productIntakeView(await journal('get',id)),
  async prepare(id,input){
   need(requestId(id),'TPV_PRODUCT_REQUEST_INVALID');
   const draft=productIntakeDraft(input),hash=await sha256Text(JSON.stringify(draft)),prior=await existing(id);
   if(prior){need(prior.manifestHash===hash,'TPV_PRODUCT_REQUEST_ALREADY_BOUND');return productIntakeView(prior);}
   // A root already used by the general Products tool cannot be adopted here.
   need(!await products.parent(id),'TPV_PRODUCT_REQUEST_ALREADY_BOUND');
   for(const image of draft.images)await inspectTransparentProductPng(image.base64);
   await validateAttributes(draft);
   if(draft.supplierId!=='0')await currency();
   const profile=await products.profile();need(profile?.ok===true,'TPV_PRODUCT_METADATA_INVALID');
   const basePayload=productIntakeBase(draft,profile.language_ids),prepared=await products.prepareBase(basePayload);
   need(prepared?.ok===true&&prepared.can_commit===true&&/^[a-f0-9]{64}$/.test(prepared.fingerprint||''),'TPV_PRODUCT_WRITE_UNAVAILABLE');
   return productIntakeView(await journal('create',id,{manifestHash:hash,payload:draft,basePayload,baseFingerprint:prepared.fingerprint,plan:productIntakePlan(draft)}));
  },
  async cancel(id){
   const row=await journal('get',id);
   if(row.status==='cancelled')return productIntakeView(row);
   need(row.currentStep===0&&!await products.parent(id),'TPV_PRODUCT_RECONCILIATION_REQUIRED');
   return productIntakeView(await journal('cancel',id));
  },
  async advance(id){
   const token=uuid(),row=await journal('start',id,{token});
   if(row.status!=='processing'||row.busy||row.leaseToken!==token)return productIntakeView(row);
   const step=row.steps[row.currentStep];need(step,'TPV_PRODUCT_STEP_CHANGED');
   let result;
   try{
    if(step.kind==='base')result=await products.commitBase(id,row.basePayload,row.baseFingerprint);
    else{
     const productId=row.steps.find(item=>item.key==='base'&&item.status==='verified')?.recordId;
     need(nativeId(productId),'TPV_PRODUCT_RESULT_INVALID');
     const draft=productIntakeDraft(row.payload),input=productIntakeStage(draft,step,row.steps,step.kind==='supplier_price'?await currency():undefined);
     const prepared=await products.prepareStage(id,productId,input);
     // The common writer reconciles its existing journal before another POST.
     if(prepared?.verified===true)result=prepared;
     else{
      need(prepared?.ok===true&&prepared.can_commit===true&&/^[a-f0-9]{64}$/.test(prepared.fingerprint||''),'TPV_PRODUCT_WRITE_UNAVAILABLE');
      result=await products.commitStage(id,productId,input,prepared.fingerprint);
     }
    }
    need(result?.ok===true&&result.verified===true&&result.persisted===true&&nativeId(result.record_id),'TPV_PRODUCT_RESULT_INVALID');
   }catch{
    // Even a lost reply may conceal a committed native write. Keep the same
    // root and step; recovery uses the official journal, never a fresh command.
    return productIntakeView(await journal('failed',id,{token,stepKey:step.key,code:'TPV_PRODUCT_STEP_UNCERTAIN'}));
   }
   return productIntakeView(await journal('verified',id,{token,stepKey:step.key,recordId:result.record_id}));
  }
 });
}
