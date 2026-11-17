import {readPrestashopPage,readPrestashopProductItem} from '../../../supabase/functions/totus-connections/prestashop.js';
import {readPrestashopProductCreateProfile,runPrestashopProductCreate} from '../../../supabase/functions/totus-connections/prestashop-create.js';
import {runPrestashopProductStage,validateProductStage} from '../../../supabase/functions/totus-connections/prestashop-product-stage.js';
import {TOTUS_QA_POLICY} from './deployment-qa-policy.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const resources=new Set(['categories','manufacturers','suppliers','tax_rule_groups','tax_rules','taxes','countries','product_options','product_option_values','languages','currencies']);
/** The official Webservice uses id_shop for reads AND writes. Bind it here to
 * the server-observed TPV assignment; never accept all-shops/group contexts.
 * https://devdocs.prestashop-project.org/8/webservice/tutorials/advanced-use/manage-multishop/ */
export function scopedProductRequest({connection,scope,request=fetch}){
 need(scope?.environment==='qa'&&scope.connectionId===TOTUS_QA_POLICY.connectionId&&connection?.id===scope.connectionId&&
  connection.revision===scope.connectionRevision&&Number.isSafeInteger(scope.shopId)&&scope.shopId>0,'TPV_PRODUCT_SCOPE_INVALID');
 const base=new URL(connection.endpoint);
 need(base.origin===TOTUS_QA_POLICY.origin&&base.pathname.replace(/\/$/,'')==='/api'&&!base.username&&!base.password&&!base.search&&!base.hash,'TPV_PRODUCT_SCOPE_INVALID');
 return async(url,init={})=>{
  const target=new URL(url);need(target.origin===base.origin&&!target.username&&!target.password&&!target.hash&&
   (target.pathname==='/api'||target.pathname.startsWith('/api/')),'TPV_PRODUCT_SCOPE_INVALID');
  for(const key of target.searchParams.keys())if(/^id_(shop|group_shop|shop_group)(?:$|\[)/i.test(key))
   need(key==='id_shop'&&target.searchParams.getAll(key).length===1&&target.searchParams.get(key)===String(scope.shopId),'TPV_PRODUCT_SCOPE_INVALID');
  target.searchParams.set('id_shop',String(scope.shopId));
  // stock_availables is not a multishop ObjectModel in every supported version.
  // Its listing must also select the exact row's shop before the common writer
  // resolves the native stock ID. A blank schema has no row filter.
  if(target.pathname.replace(/\/$/,'')==='/api/stock_availables'&&!target.searchParams.has('schema')){
   const expected='['+scope.shopId+']';
   need(!target.searchParams.has('filter[id_shop]')||target.searchParams.get('filter[id_shop]')===expected,'TPV_PRODUCT_SCOPE_INVALID');
   target.searchParams.set('filter[id_shop]',expected);
  }
  return request(target.href,{...init,redirect:'error',credentials:'omit'});
 };
}
export function createOfficialProductWriter({connection,scope,websiteKey,websiteName,rpc,request=fetch,resolve,env,uuid=()=>crypto.randomUUID()}){
 need(typeof websiteKey==='string'&&/^[a-z][a-z0-9_-]{1,63}$/.test(websiteKey),'TPV_PRODUCT_SCOPE_INVALID');
 const bound={...connection,store_key:websiteKey,website_origin:TOTUS_QA_POLICY.origin,website_name:websiteName||'Tienda de pruebas'};
 const transport=scopedProductRequest({connection:bound,scope,request}),options={request:transport,resolve,env};
 const context=()=>({id:scope.connectionId,call_id:uuid(),revision:scope.connectionRevision,store:websiteKey});
 const shared={actor_id:scope.actorId,connection_id:scope.connectionId,revision:scope.connectionRevision};
 const call=async(name,args)=>{const response=await rpc(name,args);
  if(response?.error)throw Error(/^TPV_[A-Z0-9_]{1,90}$/.test(response.error.message||'')?response.error.message:'TPV_PRODUCT_JOURNAL_UNAVAILABLE');
  need(response&&Object.hasOwn(response,'data'),'TPV_PRODUCT_JOURNAL_UNAVAILABLE');return response.data;};
 const baseCall=(action,id,extra={})=>call('totus_prestashop_product_create_journal',{p_action:action,p_request_id:id,p_data:{...shared,...extra}});
 const baseJournal={lookup:id=>baseCall('lookup',id),claim:op=>baseCall('claim',op.request_id,{store:op.store,reference:op.reference,signature:op.signature}),
  complete:op=>baseCall('complete',op.request_id,{signature:op.signature,product_id:op.product_id}),
  uncertain:op=>baseCall('uncertain',op.request_id,{signature:op.signature,product_id:op.product_id})};
 function stageJournal(parentId,productId){
  const operation=(action,op,signature,recordId)=>call('totus_prestashop_product_step',{p_action:action,p_request_id:parentId,p_stage:op.stage,
   p_data:{...shared,product_id:String(productId),...(signature?{signature}:{}),...(recordId?{record_id:String(recordId)}:{})}});
  return {parent:id=>{need(id===parentId,'TPV_PRODUCT_SCOPE_INVALID');return baseJournal.lookup(id);},
   lookup:op=>operation('lookup',op),claim:(op,signature)=>operation('claim',op,signature),
   complete:(op,signature,id)=>operation('complete',op,signature,id),uncertain:(op,signature)=>operation('uncertain',op,signature)};
 }
 const stage=async(commit,parentId,productId,input,fingerprint)=>{
  need(input&&['image','variation','stock','supplier_price','finish'].includes(input.kind)&&input.existing_product===undefined&&input.record_id===undefined,'TPV_PRODUCT_STAGE_INVALID');
  return runPrestashopProductStage(bound,{...input,...context(),action:'prestashop_product_step_'+(commit?'commit':'prepare'),parent_request_id:parentId,product_id:String(productId),
   ...(commit?{expected_fingerprint:fingerprint,confirmed:true}:{})},{...options,journal:stageJournal(parentId,productId)});
 };
 return Object.freeze({
  profile:()=>readPrestashopProductCreateProfile(bound,{...context(),action:'prestashop_product_create_profile'},options),
  list:(resource,page=0,recordId)=>{need(resources.has(resource)&&Number.isSafeInteger(page)&&page>=0&&page<=1000&&
    (resource==='taxes'?page===0&&typeof recordId==='string'&&/^[1-9][0-9]{0,14}$/.test(recordId):recordId===undefined),'TPV_PRODUCT_METADATA_INVALID');
   return readPrestashopPage(bound,{...context(),action:'prestashop_read',resource,page,page_size:100,sort:'oldest',...(recordId?{record_id:recordId}:{})},options);},
  attribute:async id=>{need(/^[1-9][0-9]{0,14}$/.test(String(id)),'TPV_PRODUCT_METADATA_INVALID');
   const response=await readPrestashopProductItem(bound,{...context(),action:'prestashop_item_read',resource:'product_option_values',record_id:String(id)},options);
   need(String(response.item?.id)===String(id),'TPV_PRODUCT_METADATA_INVALID');return response.item;},
  parent:id=>baseJournal.lookup(id),
  prepareBase:payload=>runPrestashopProductCreate(bound,{...payload,...context(),action:'prestashop_product_create_prepare'},{...options,journal:baseJournal}),
  commitBase:(id,payload,fingerprint)=>runPrestashopProductCreate(bound,{...payload,...context(),action:'prestashop_product_create_commit',request_id:id,
   expected_fingerprint:fingerprint,confirmed:true},{...options,journal:baseJournal}),
  prepareStage:(parentId,productId,input)=>stage(false,parentId,productId,input),
  recoverStage:async(parentId,productId,input)=>{
   const op=validateProductStage({...input,...context(),action:'prestashop_product_step_prepare',parent_request_id:parentId,product_id:String(productId)});
   if(!await stageJournal(parentId,productId).lookup(op))return null;
   // A prior claim enters the common writer's readback branch before its
   // fingerprint check. With no prior claim, this sentinel cannot authorize a
   // new write; a fresh prepare/commit remains necessary.
   return stage(true,parentId,productId,input,'0'.repeat(64));
  },
  commitStage:(parentId,productId,input,fingerprint)=>stage(true,parentId,productId,input,fingerprint)
 });
}
