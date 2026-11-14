// Explicit website identities. A physical business may have several websites.
// Construct one registry per authorized context; never share mutable credentials
// or a request's website configuration through a process-global registry.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const legacy=Object.freeze([
 Object.freeze({key:'hortimatic',name:'Hortimatic',label:'Hortimatic',connectionName:'PrestaShop · Hortimatic',origin:'https://hortimatic.com',include_in_totals:true}),
 Object.freeze({key:'newoldsmok',name:'NewOldSmok',label:'NewOldSmok',connectionName:'PrestaShop · NewOldSmok',origin:'https://newoldsmok.com',include_in_totals:true})
]);
// Browser presentation only. Server adapters resolve their own connection below;
// they never change this list or derive authorization from browser state.
export let WEBSITE_CHOICES=legacy;
export function websiteName(key){return WEBSITE_CHOICES.find(site=>site.key===key)?.name||String(key||'');}
export function websiteBusinessId(key,businesses=[]){
 const site=WEBSITE_CHOICES.find(s=>s.key===key);
 if(!site)return null;
 if(Object.hasOwn(site,'business_id'))return businesses.some(b=>b.id===site.business_id&&b.active!==false)?site.business_id:null;
 return businesses.find(b=>b.active!==false&&String(b.name||'').trim().toLowerCase()===key)?.id||null;
}
export function resetWebsiteChoices(){WEBSITE_CHOICES=legacy;}
export function installWebsiteContext(context){
 if(!context||!Array.isArray(context.websites))return;
 const registry=createWebsiteRegistry(context.websites);
 WEBSITE_CHOICES=Object.freeze(registry.all.filter(s=>s.status!=='retired').map(s=>Object.freeze({...s,label:s.name})));
}
export function connectionWebsite(connection,key){
 if(!connection||!websiteKey(key)||connection.store_key!==key||!connection.website_origin||!connection.website_name)throw Error('La conexión no corresponde a la tienda seleccionada.');
 const siteOrigin=origin(connection.website_origin);
 if(new URL(connection.endpoint).origin!==siteOrigin)throw Error('La conexión pertenece a otro origen.');
 return Object.freeze({key,name:connection.website_name,label:connection.website_name,origin:siteOrigin,connection_id:connection.id});
}
export function websiteKey(value){return typeof value==='string'&&/^[a-z][a-z0-9_-]{1,63}$/.test(value);}
function origin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Origen de tienda no válido.');
 return url.origin;
}
export function createWebsiteRegistry(records){
 if(!Array.isArray(records))throw Error('Catálogo de tiendas no válido.');
 const keys=new Map(),connections=new Set();
 for(const input of records){
  if(!input||!websiteKey(input.key)||!UUID.test(input.connection_id||'')||!String(input.name||'').trim())throw Error('Identidad de tienda no válida.');
  if(keys.has(input.key)||connections.has(input.connection_id))throw Error('Tienda o conexión duplicada.');
  if(!['active','disabled','retired'].includes(input.status))throw Error('Estado de tienda no válido.');
  if(typeof input.include_in_totals!=='boolean')throw Error('Indica expresamente si la tienda participa en los totales.');
  const site=Object.freeze({key:input.key,name:String(input.name).trim(),origin:origin(input.origin),connection_id:input.connection_id,status:input.status,include_in_totals:input.include_in_totals,business_id:input.business_id||null});
  keys.set(site.key,site);connections.add(site.connection_id);
 }
 const all=Object.freeze([...keys.values()]);
 const get=key=>{const site=keys.get(key);if(!site)throw Error('Tienda no registrada.');return site;};
 return Object.freeze({
  all,
  get,
  active:()=>all.filter(site=>site.status==='active'),
  totals:()=>all.filter(site=>site.status==='active'&&site.include_in_totals),
  destinations:source=>{get(source);return all.filter(site=>site.key!==source&&site.status==='active');},
  connection:(key,profiles)=>{
   const site=get(key);if(site.status!=='active')throw Error('Tienda no activa.');
   const matches=(Array.isArray(profiles)?profiles:[]).filter(c=>c.id===site.connection_id&&c.protocol==='prestashop');
   if(matches.length!==1)throw Error('Conexión de tienda no inequívoca.');
   const connection=matches[0];
   if(!connection.enabled||connection.verified_revision!==connection.revision||!connection.real_data_authorized)throw Error('Conexión sin activar o verificar.');
   if(connection.endpoint&&new URL(connection.endpoint).origin!==site.origin)throw Error('La conexión pertenece a otro origen.');
   return connection;
  },
  productUrl:(key,id)=>{
   const site=get(key);
   if(!/^[1-9]\d{0,14}$/.test(String(id)))throw Error('Producto no válido.');
   return site.origin+'/index.php?controller=product&id_product='+id;
  },
  imageUrl:(key,id)=>{
   const site=get(key);
   if(!/^[1-9]\d{0,14}$/.test(String(id)))throw Error('Imagen no válida.');
   return site.origin+'/'+id+'-home_default/product.jpg';
  },
  // Stable identity, even when a display name or business assignment changes.
  cacheKey:(key,revision,resource)=>{
   const site=get(key);
   if(!Number.isSafeInteger(revision)||revision<1||typeof resource!=='string'||!resource)throw Error('Identidad de caché no válida.');
   return JSON.stringify([site.connection_id,revision,resource]);
  }
 });
}
