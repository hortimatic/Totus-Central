export const CHAT_SOUNDS=[['bell','Campana'],['double','Doble toque'],['soft','Suave'],['digital','Digital']];
export const CHAT_BACKGROUNDS=[['default','Original'],['lavender','Lavanda'],['sky','Cielo'],['mint','Menta'],['sand','Arena'],['color','Color personalizado'],['image','Mi imagen']];
export const CHAT_BUZZ='🔔 Zumbido';
export const isChatBuzz=message=>message?.body===CHAT_BUZZ&&!message?.deleted_at;
export function chatPreferences(value={}){
 const volume=Number(value.sound_volume);
 return {sound_volume:value.sound_volume!=null&&Number.isFinite(volume)?Math.round(Math.min(100,Math.max(0,volume))):60,
 sound_style:CHAT_SOUNDS.some(([key])=>key===value.sound_style)?value.sound_style:'bell',
 chat_background:CHAT_BACKGROUNDS.some(([key])=>key===value.chat_background)?value.chat_background:'default',
 chat_background_color:/^#[0-9a-f]{6}$/i.test(value.chat_background_color)?value.chat_background_color:'#eef2ff',
 chat_background_image:typeof value.chat_background_image==='string'&&value.chat_background_image.length<=350000&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value.chat_background_image)?value.chat_background_image:''};
}
export function applyChatBackground(element,value){
 if(!element)return;
 const p=chatPreferences(value),colors={lavender:'#f0ebfa',sky:'#eaf3fc',mint:'#e9f5ef',sand:'#f8f0e3'};
 element.style.backgroundImage=p.chat_background==='image'&&p.chat_background_image?'url("'+p.chat_background_image+'")':p.chat_background==='default'?'':'none';
 element.style.backgroundColor=p.chat_background==='color'?p.chat_background_color:colors[p.chat_background]||'';
 element.classList.toggle('chat-personal-background',p.chat_background!=='default');
}
export async function prepareChatBackground(file,{preserveAlpha=false}={}){
 if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024)throw Error('Elige una imagen JPG, PNG o WebP de hasta 5 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40000000)throw Error('La imagen es demasiado grande. Usa una de menos de 40 megapíxeles.');
  const canvas=document.createElement('canvas'),ratio=Math.min(1,(preserveAlpha?640:1440)/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const context=canvas.getContext('2d');if(!preserveAlpha){context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);}context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.82,.65,.45,.25]){const result=canvas.toDataURL(preserveAlpha?'image/webp':'image/jpeg',quality);if(result.length<=350000)return result;}
  throw Error('No se ha podido reducir la imagen. Elige otra más sencilla o pequeña.');
 }finally{bitmap.close();}
}
