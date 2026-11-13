import {LOCALIZED_PRODUCT_FIELDS} from './productos-write-contract.js';
import {WEBSITE_CHOICES} from './website-registry.js';
const shops=new Proxy({}, {get:(_target,key)=>{const site=WEBSITE_CHOICES.find(s=>s.key===key);return site?{label:site.name,host:new URL(site.origin).host,words:key==='newoldsmok'?['newoldsmok','new old smok','new-old-smok']:[site.name]}:undefined;}});
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function adaptStoreText(value,source,target,{slug=false}={}){
 if(!shops[source]||!shops[target])throw Error('Tiendas de adaptación no válidas.');
 if(source===target)return String(value??'');
 const from=shops[source],to=shops[target];
 let result=String(value??'').replace(new RegExp(escape(from.host),'gi'),to.host);
 result=result.replace(new RegExp('\\b(?:'+from.words.map(escape).join('|')+')\\b','gi'),slug?target:to.label);
 return result;
}
// Work on an inert HTML fragment. Never rename an image host while retaining
// another shop's image ID, and never guess where another product's URL points.
export function adaptStoreHTML(value,source,target,{sourceProductId='',targetProductId='',imageMap={},categoryMap={}}={}){
 if(!shops[source]||!shops[target])throw Error('Tiendas de adaptación no válidas.');
 const template=document.createElement('template');template.innerHTML=String(value??'');
 const walker=document.createTreeWalker(template.content,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode()))if(!node.parentElement?.closest('script,style'))node.textContent=adaptStoreText(node.textContent,source,target);
 const unresolved=[];
 for(const element of template.content.querySelectorAll('*')){
  for(const key of ['alt','title','aria-label'])if(element.hasAttribute(key))element.setAttribute(key,adaptStoreText(element.getAttribute(key),source,target));
  for(const key of ['src','href','poster']){
   if(!element.hasAttribute(key))continue;
   const raw=element.getAttribute(key);if(!raw||raw.startsWith('#'))continue;let url;try{url=new URL(raw,'https://'+shops[source].host);}catch{continue;}
   if(url.hostname.replace(/^www\./,'')!==shops[source].host)continue;
   const image=url.pathname.match(/^\/(\d+)(?:-([a-z_]+))?\/[^/]+\.(jpg|png|webp)$/i)||url.pathname.match(/^\/img\/p\/(?:\d\/)*(\d+)(?:-([a-z_]+))?\.(jpg|png|webp)$/i);
   if(image&&/^[1-9]\d*$/.test(String(imageMap[image[1]]||''))){element.setAttribute(key,'https://'+shops[target].host+'/'+imageMap[image[1]]+'-'+(image[2]||'large_default')+'/product.'+image[3]);continue;}
   if(key==='href'&&['/','/index.php'].includes(url.pathname)&&!url.search){element.setAttribute(key,'https://'+shops[target].host+'/');continue;}
   if(key==='href'&&targetProductId&&sourceProductId&&(url.searchParams.get('controller')==='product'&&url.searchParams.get('id_product')===String(sourceProductId)||new RegExp('^/'+escape(String(sourceProductId))+'-').test(url.pathname))){element.setAttribute(key,'https://'+shops[target].host+'/index.php?controller=product&id_product='+targetProductId);continue;}
   const category=key==='href'?(url.searchParams.get('controller')==='category'?url.searchParams.get('id_category'):url.pathname.match(/^\/(\d+)-[^/.]+$/)?.[1]):null;
   if(category&&/^[1-9]\d*$/.test(String(categoryMap[category]||''))){element.setAttribute(key,'https://'+shops[target].host+'/index.php?controller=category&id_category='+categoryMap[category]);continue;}
   unresolved.push({attribute:key,url:raw,reason:image?'Imagen pendiente de importar':'Enlace interno que necesita correspondencia'});
  }
 }
 return {value:template.innerHTML,unresolved};
}
export function adaptProductTexts(record,source,target,context={}){
 const changes=[],unresolved=[];
 for(const field of LOCALIZED_PRODUCT_FIELDS){
  const value=record[field];if(value===undefined||value===null)continue;
  const adapt=text=>{
   if(['description','description_short'].includes(field)&&/<[a-z][\s\S]*>/i.test(String(text))){const result=adaptStoreHTML(text,source,target,context);unresolved.push(...result.unresolved.map(r=>({...r,field})));return result.value;}
   return adaptStoreText(text,source,target,{slug:field==='link_rewrite'});
  };
  const after=Array.isArray(value)?value.map(t=>({...t,value:adapt(t.value??'')})):adapt(value);
  if(JSON.stringify(after)!==JSON.stringify(value))changes.push({field,before:value,after});
 }
 return {changes,unresolved};
}
