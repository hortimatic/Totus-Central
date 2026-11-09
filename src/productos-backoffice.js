import {PRESTASHOP_STORES} from './prestashop-readonly.js';

// Back-office CSRF navigation tokens are not Webservice keys. The native API
// cannot generate them. Keep an explicitly supplied link in this tab's session,
// never in a product, profile, server configuration or exported draft.
const storageKey=(owner,store)=>'totus-backoffice-session:'+owner+':'+store;
export function normalizeBackofficeLink(value,store){
 const origin=PRESTASHOP_STORES.find(item=>item.key===store)?.origin;
 let url;try{url=new URL(value);}catch{throw Error('Pega un enlace completo del catálogo o de una ficha del administrador de esta tienda.');}
 if(!origin||url.origin!==origin||url.username||url.password)throw Error('El enlace no pertenece a la tienda seleccionada.');
 if(!/^\/[^/]+\/index\.php\/sell\/catalog\/products(?:\/[1-9]\d*)?\/?$/.test(url.pathname))throw Error('Abre Catálogo → Productos en PrestaShop y copia esa dirección, o la de una ficha. El enlace de Inicio no sirve para este acceso.');
 const token=url.searchParams.get('_token');if(!token||token.length>512)throw Error('El enlace debe conservar el parámetro _token de tu sesión de PrestaShop.');
 url.pathname=url.pathname.replace(/\/[1-9]\d*\/?$/,'').replace(/\/$/,'');url.search='';url.searchParams.set('_token',token);url.hash='';return url.href;
}
export function saveBackofficeLink(value,store,owner,storage=sessionStorage){
 const link=normalizeBackofficeLink(value,store);storage.setItem(storageKey(owner,store),link);return link;
}
export function productBackofficeUrl(record,store,owner,storage=sessionStorage){
 if(!/^[1-9]\d*$/.test(String(record?.id||'')))return '';
 try{const saved=storage.getItem(storageKey(owner,store));if(!saved)return '';const url=new URL(normalizeBackofficeLink(saved,store));url.pathname+='/'+record.id;return url.href;}catch{return '';}
}
