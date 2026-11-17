/** Private operator note. Never part of customer-facing documents or display. */
export function saleNote(value){
 if(value===undefined)return undefined;
 if(typeof value!=='string')throw Error('TPV_SALE_NOTE_INVALID');
 const note=value.replace(/\r\n?/g,'\n').replace(/^[ \t\n]+|[ \t\n]+$/g,'');
 if(Array.from(note).length>500||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\uD800-\uDFFF<>]/u.test(note))throw Error('TPV_SALE_NOTE_INVALID');
 return note||undefined;
}
export async function saleNoteHash(value){
 const note=saleNote(value);if(note===undefined)return undefined;
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(note));
 return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
