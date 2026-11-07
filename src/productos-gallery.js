import {esc} from './utils.js';
import {prestashopStore} from './prestashop-readonly.js';
export function productGallery(ids,draft={}){
 const actual=[...new Set(ids.map(String).filter(id=>/^[1-9]\d{0,14}$/.test(id)))],allowed=new Set(actual);
 const order=[...new Set([...(Array.isArray(draft.order)?draft.order:[]).filter(id=>allowed.has(String(id))).map(String),...actual])];
 const captions=Object.fromEntries(actual.map(id=>[id,String(draft.captions?.[id]||'').slice(0,128)]));return {order,captions};
}
export function moveProductPhoto(ids,draft,id,position){const next=productGallery(ids,draft);if(!next.order.includes(String(id))||!Number.isInteger(position)||position<1||position>next.order.length)throw Error('Posición de foto no válida.');next.order=next.order.filter(x=>x!==String(id));next.order.splice(position-1,0,String(id));return next;}
export function productGalleryDescription(store,ids,draft,name='Producto'){
 const gallery=productGallery(ids,draft),origin=prestashopStore(store).origin;
 return '<div>'+gallery.order.map(id=>'<p><img src="'+origin+'/'+id+'-large_default/product.jpg" alt="'+esc(gallery.captions[id]||name)+'" style="display:block;max-width:100%;height:auto;margin:0 auto;" /></p>').join('')+'</div>';
}
