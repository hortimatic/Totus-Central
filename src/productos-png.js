const crcTable=Uint32Array.from({length:256},(_,value)=>{let crc=value;for(let bit=0;bit<8;bit++)crc=crc&1?0xedb88320^(crc>>>1):crc>>>1;return crc>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
// Accept a normalized RGBA PNG, not just a filename claiming transparency.
// The editor normalizes browser-supported inputs before calling the server.
export async function inspectTransparentProductPng(base64){
 const raw=atob(base64),bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
 if(bytes.length<45||bytes.length>4194304||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v))throw Error('La imagen no es un PNG válido de hasta 4 MB.');
 const view=new DataView(bytes.buffer),data=[];let width=0,height=0,end=false;
 for(let p=8;p+12<=bytes.length;){
  const size=view.getUint32(p),name=String.fromCharCode(...bytes.slice(p+4,p+8));
  if(p+12+size>bytes.length)throw Error('PNG truncado.');
  if(crc32(bytes.subarray(p+4,p+8+size))!==view.getUint32(p+8+size))throw Error('El PNG está dañado: su comprobación de integridad no coincide.');
  if(name==='IHDR'){
   if(p!==8||size!==13)throw Error('Cabecera PNG no válida.');
   width=view.getUint32(p+8);height=view.getUint32(p+12);
   if(!width||!height||width*height>4194304||bytes[p+16]!==8||bytes[p+17]!==6||bytes[p+18]!==0||bytes[p+19]!==0||bytes[p+20]!==0)throw Error('Normaliza la imagen a PNG RGBA sin entrelazado, de hasta 4 megapíxeles.');
  }else if(name==='IDAT')data.push(bytes.slice(p+8,p+8+size));
  else if(name==='IEND'){if(size!==0||p+12!==bytes.length)throw Error('Final PNG no válido.');end=true;break;}
  p+=12+size;
 }
 if(!width||!data.length||!end)throw Error('PNG incompleto.');
 const stream=new Blob(data).stream().pipeThrough(new DecompressionStream('deflate'));
 const reader=stream.getReader(),chunks=[];let length=0;const expected=height*(width*4+1);
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>expected){await reader.cancel();throw Error('La imagen excede sus dimensiones declaradas.');}chunks.push(value);}}finally{reader.releaseLock();}
 if(length!==expected)throw Error('Datos de imagen incompletos.');
 const decoded=new Uint8Array(length);let pos=0;for(const chunk of chunks){decoded.set(chunk,pos);pos+=chunk.length;}
 const stride=width*4,previous=new Uint8Array(stride),row=new Uint8Array(stride);let transparent=0,visible=0;
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<height;y++){
  const start=y*(stride+1),filter=decoded[start];if(filter>4)throw Error('Filtro PNG desconocido.');
  for(let x=0;x<stride;x++){
   const a=x>=4?row[x-4]:0,b=previous[x],c=x>=4?previous[x-4]:0;
   row[x]=(decoded[start+x+1]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c)))&255;
   if(x%4===3){if(row[x]<255)transparent++;if(row[x]>0)visible++;}
  }
  previous.set(row);
 }
 if(!transparent)throw Error('La imagen sigue teniendo un fondo opaco. Elimina el fondo o carga un PNG con transparencia real.');
 if(!visible)throw Error('La imagen está completamente vacía.');
 return {bytes,width,height,transparent_pixels:transparent};
}
