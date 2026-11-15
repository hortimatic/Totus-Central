/** Read-only diagnostics through Central's existing authenticated APIs.
 * This is neither checkout authorization nor a native capability certificate.
 * It never receives credentials, assigns stores, opens drawers or enables sales.
 */
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const need=(value,code)=>{if(!value)throw new Error(code);};
const label=value=>typeof value==='string'&&value.trim().length>0&&value.length<=250;
const unique=(rows,key)=>new Set(rows.map(row=>row[key])).size===rows.length;
function origin(value){try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.origin===value;}catch{return false;}}
export function assessTpvSetup(context,drawers){
 need(context&&Array.isArray(context.websites)&&context.websites.length<=500&&Array.isArray(context.businesses)&&
  context.businesses.length<=500&&Array.isArray(context.connections)&&context.connections.length<=500&&
  Array.isArray(drawers)&&drawers.length<=1000,'TPV_SETUP_SHAPE_INVALID');
 const {websites,businesses,connections}=context;
 need(unique(websites,'key')&&unique(businesses,'id')&&unique(connections,'id')&&unique(drawers,'id'),
  'TPV_SETUP_IDENTITIES_AMBIGUOUS');
 need(businesses.every(row=>uuid(row.id)&&label(row.name))&&drawers.every(row=>uuid(row.id)&&uuid(row.store_id)&&
  label(row.name)&&typeof row.active==='boolean'),'TPV_SETUP_IDENTITIES_INVALID');
 const rows=websites.map(website=>{
  need(typeof website.key==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(website.key)&&label(website.name)&&
   (website.business_id===null||uuid(website.business_id))&&
   (website.connection_id===null||uuid(website.connection_id)),'TPV_SETUP_WEBSITE_INVALID');
  const business=businesses.find(row=>row.id===website.business_id);
  const connection=connections.find(row=>row.id===website.connection_id);
  const connectionVerified=website.status==='active'&&origin(website.origin)&&connection?.protocol==='prestashop'&&
   connection.store_key===website.key&&connection.website_origin===website.origin&&connection.enabled===true&&
   connection.configured===true&&connection.real_data_authorized===true&&positive(connection.revision)&&
   connection.verified_revision===connection.revision;
  const boxes=business?drawers.filter(row=>row.active&&row.store_id===business.id)
   .map(({id,name})=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'es',{numeric:true})):[];
  return {websiteKey:website.key,websiteName:website.name,origin:origin(website.origin)?website.origin:null,
   connectionId:connection?.id||null,connectionVerified,
   storeId:business?.id||null,storeName:business?.name||null,drawers:boxes,
   issues:[...(!connectionVerified?['api-unverified']:[]),...(!business?['store-unassigned']:[]),
    ...(business&&!boxes.length?['drawer-unavailable']:[])],checkoutEnabled:false};
 });
 return {mode:'setup-read-only',checkoutEnabled:false,
  websites:rows.sort((a,b)=>a.websiteName.localeCompare(b.websiteName,'es',{numeric:true})),
  unchecked:['operator-assignment','native-checkout','cash-session']};
}
export function createTpvSetupReader({actor,can,rpc,readDrawers}){
 need([actor,can,rpc,readDrawers].every(fn=>typeof fn==='function'),'TPV_SETUP_ADAPTER_REQUIRED');
 let revision=0;
 return Object.freeze({async read(){
  const owner=actor()?.id,request=++revision;
  need(uuid(owner)&&actor()?.active!==false&&can('view'),'TPV_SETUP_FORBIDDEN');
  // Normal user RPC and RLS-scoped metadata read. No service-role client.
  const [context,drawers]=await Promise.all([rpc('totus_sales_context',{}),readDrawers()]);
  need(owner===actor()?.id&&actor()?.active!==false&&can('view')&&request===revision,'TPV_SETUP_SESSION_CHANGED');
  return assessTpvSetup(context,drawers);
 }});
}
