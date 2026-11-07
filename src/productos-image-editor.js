import {inspectTransparentProductPng} from './productos-png.js';

// Local-only normalization. Flood fill removes a uniform edge-connected backdrop
// rather than erasing matching colours inside the product itself.
export async function normalizeProductImage(file,{removeBackground=true,canvasSize=null}={}){
 if(!file||!file.type?.startsWith('image/')||file.size>20971520)throw Error('Selecciona una imagen de hasta 20 MB.');
 let bitmap,objectUrl=null;
 try{bitmap=await createImageBitmap(file);}
 catch{
  objectUrl=URL.createObjectURL(file);const image=new Image();image.src=objectUrl;
  try{await image.decode();bitmap=image;}catch{URL.revokeObjectURL(objectUrl);throw Error('No se pudo abrir la imagen. Selecciona un PNG, JPEG, WebP o SVG válido.');}
 }
 const scale=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx){bitmap.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);throw Error('No se pudo abrir el editor local de imágenes.');}
 try{ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);}finally{bitmap.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl);}
 if(removeBackground){
  const image=ctx.getImageData(0,0,canvas.width,canvas.height),data=image.data,w=canvas.width,h=canvas.height;
  const corners=[0,w-1,(h-1)*w,h*w-1],samples=corners.filter(i=>data[i*4+3]>0).map(i=>Array.from(data.slice(i*4,i*4+3)));
  if(samples.length){
   const background=samples[0],uniform=samples.every(s=>s.every((v,k)=>Math.abs(v-background[k])<=24));
   if(uniform){
    const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
    const add=i=>{if(!seen[i]){seen[i]=1;queue[tail++]=i;}};
    for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
    while(head<tail){const i=queue[head++],p=i*4,match=data[p+3]===0||background.every((v,k)=>Math.abs(v-data[p+k])<=24);if(!match)continue;data[p+3]=0;const x=i%w,y=Math.floor(i/w);if(x)add(i-1);if(x+1<w)add(i+1);if(y)add(i-w);if(y+1<h)add(i+w);}
    ctx.putImageData(image,0,0);
   }
  }
 }
 // Padding is not evidence of background removal: validate the image itself first.
 await inspectTransparentProductPng(canvas.toDataURL('image/png').split(',')[1]);
 let output=canvas;
 if(canvasSize){const width=Number(canvasSize.width),height=Number(canvasSize.height);if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width*height>4194304)throw Error('El tipo de imagen de la tienda supera el tamaño admitido por el editor.');output=document.createElement('canvas');output.width=width;output.height=height;const target=output.getContext('2d');if(!target)throw Error('No se pudo preparar el lienzo de la tienda.');const scale=Math.min(width*.94/canvas.width,height*.94/canvas.height);target.imageSmoothingQuality='high';target.drawImage(canvas,(width-canvas.width*scale)/2,(height-canvas.height*scale)/2,canvas.width*scale,canvas.height*scale);}
 const base64=output.toDataURL('image/png').split(',')[1];await inspectTransparentProductPng(base64);
 const name=String(file.name||'producto').replace(/\.[^.]+$/,'').replace(/[\x00-\x1f/\\]/g,'-').slice(0,110)+'.png';
 return {name,mime:'image/png',base64};
}
