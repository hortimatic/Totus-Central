const need=(ok,code)=>{if(!ok)throw Error(code);};
export async function signatureHash(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function signatureBase64(bytes){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result);}
export async function signatureDocumentBytes(document,{signed=false,orderId=document?.order_id}={}){
 need(Number.isSafeInteger(orderId)&&orderId>0&&document?.mime==='application/pdf'&&document.filename==='totus-invoice-'+orderId+(signed?'-firmada':'')+'.pdf'&&/^[a-f0-9]{64}$/.test(document.sha256||'')&&typeof document.base64==='string'&&document.base64.length<=(signed?3000000:1900000)&&/^[A-Za-z0-9+/]+={0,2}$/.test(document.base64)&&(signed||document.kind==='invoice'&&document.existing_document===true),'TPV_SIGNATURE_DOCUMENT_INVALID');
 let bytes;try{bytes=Uint8Array.from(atob(document.base64),c=>c.charCodeAt(0));}catch{throw Error('TPV_SIGNATURE_DOCUMENT_INVALID');}
 need(new TextDecoder().decode(bytes.subarray(0,5))==='%PDF-'&&signatureBase64(bytes)===document.base64&&await signatureHash(bytes)===document.sha256,'TPV_SIGNATURE_DOCUMENT_HASH_MISMATCH');return bytes;
}
export async function signatureDocumentBlob(record,kind='original'){
 need(record&&['original','signed'].includes(kind),'TPV_SIGNATURE_DOCUMENT_INVALID');
 const document=kind==='original'?record.original:record.signed;
 if(kind==='signed')need(record.status==='signed'&&document?.originalSha256===record.original?.sha256,'TPV_SIGNATURE_DOCUMENT_HASH_MISMATCH');
 const bytes=await signatureDocumentBytes(document,{signed:kind==='signed',orderId:record.orderId});return {blob:new Blob([bytes],{type:'application/pdf'}),filename:document.filename};
}
