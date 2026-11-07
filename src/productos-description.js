import {esc} from './utils.js';
import {prestashopStore} from './prestashop-readonly.js';
const h=value=>esc(String(value??''));
const paragraphs=text=>String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>'<p style="font-size:16px;line-height:1.75;margin:12px 0;">'+h(s)+'</p>').join('');
export function buildVisualProductDescription({store,title,intro,detailTitle,detailText,specifications,box,notice,images=[]}){
 const origin=prestashopStore(store).origin;
 if(!String(title||'').trim())throw Error('Completa el título de la presentación.');
 if(images.some(image=>!/^[1-9]\d{0,14}$/.test(String(image.id))))throw Error('La presentación solo usa imágenes verificadas de esta tienda.');
 const specs=String(specifications||'').split(/\n+/).map(s=>s.trim()).filter(Boolean).map(line=>{const i=line.indexOf(':');if(i<1||!line.slice(i+1).trim())throw Error('Escribe las especificaciones como «Material: Acero», una por línea.');return {label:line.slice(0,i).trim(),value:line.slice(i+1).trim()};});
 const picture=(image,index)=>'<div style="margin:26px 0;padding:20px;background:'+(index%2?'#edf3f7':'#f3f7f3')+';"><img src="'+origin+'/'+image.id+'-large_default/product.jpg" alt="'+h(image.alt||title)+'" style="max-width:900px;height:auto;margin:0 auto;" />'+(image.caption?'<p style="font-size:13px;text-align:center;color:#536b60;margin-top:12px;">'+h(image.caption)+'</p>':'')+'</div>';
 const short=paragraphs(intro)+(specs.length?'<ul>'+specs.slice(0,4).map(spec=>'<li><strong>'+h(spec.label)+':</strong> '+h(spec.value)+'</li>').join('')+'</ul>':'');
 const html='<div style="max-width:1100px;margin:0 auto;color:#17382b;font-family:Arial;">'+
  '<div style="padding:28px;background:#edf5ef;"><h2 style="font-size:32px;line-height:1.15;margin:0 0 16px;">'+h(title)+'</h2>'+paragraphs(intro)+'</div>'+
  (images[0]?picture(images[0],0):'')+'<div style="padding:12px 6px;"><h3 style="font-size:24px;line-height:1.3;margin:12px 0;">'+h(detailTitle||'Diseño y detalles')+'</h3>'+paragraphs(detailText)+'</div>'+
  images.slice(1).map((image,index)=>picture(image,index+1)).join('')+
  (specs.length?'<div style="margin-top:24px;"><h3 style="font-size:24px;">Ficha técnica</h3><table style="width:100%;border-collapse:collapse;">'+specs.map((spec,index)=>'<tr style="background:'+(index%2?'#fff':'#f2f6f3')+';"><th style="padding:13px;text-align:left;font-size:14px;vertical-align:top;">'+h(spec.label)+'</th><td style="padding:13px;font-size:14px;">'+h(spec.value)+'</td></tr>').join('')+'</table></div>':'')+
  (box?'<div style="margin-top:24px;padding:24px;background:#f3f6fa;"><h3 style="font-size:22px;margin:0 0 12px;">Contenido y cuidados</h3>'+paragraphs(box)+'</div>':'')+
  (notice?'<div style="margin-top:22px;padding:14px;border:1px solid #cad8cd;font-size:13px;line-height:1.6;">'+h(notice)+'</div>':'')+'</div>';
 if(html.length>250000||short.length>8000)throw Error('Reduce el contenido para ajustarlo a los campos de descripción de la tienda.');
 return {description:html,description_short:short};
}
