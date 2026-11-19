import {signatureInk} from '../signature-capture.js';
const need=(ok,code)=>{if(!ok)throw Error(code);};
export {signatureHash} from '../signature-document.js';
import {signatureHash,signatureDocumentBytes,signatureBase64 as base64} from '../signature-document.js';
export const signatureOriginal=document=>signatureDocumentBytes(document);
/** Dependency injected: Deno uses pinned npm:pdf-lib; tests use the same pinned package. */
export function createSignaturePdfRenderer({PDFDocument,StandardFonts,rgb}){
 const render=async({document,ink,snapshotId,actorName,signedAt,acceptanceText=''})=>{
  const strokes=signatureInk(ink),bytes=await signatureOriginal(document);
  need(typeof snapshotId==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(snapshotId)&&typeof actorName==='string'&&actorName.trim()&&actorName.length<=100&&!/[\x00-\x1f]/.test(actorName)&&typeof signedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(signedAt)&&Number.isFinite(Date.parse(signedAt))&&typeof acceptanceText==='string'&&acceptanceText.length<=500&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(acceptanceText),'TPV_SIGNATURE_METADATA_INVALID');
  let pdf;try{pdf=await PDFDocument.load(bytes,{updateMetadata:false});}catch{throw Error('TPV_SIGNATURE_DOCUMENT_INVALID');}
  need(pdf.getPageCount()>0&&pdf.getPageCount()<=100&&!pdf.isEncrypted,'TPV_SIGNATURE_DOCUMENT_INVALID');
  const originalPages=pdf.getPageCount(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  try{font.widthOfTextAtSize(actorName,10);font.widthOfTextAtSize(acceptanceText.replace(/\r?\n/g,' '),10);}catch{throw Error('TPV_SIGNATURE_TEXT_UNSUPPORTED');}
  const page=pdf.addPage([595.28,841.89]);let y=790;
  const text=(value,size=10,emphasis=false)=>{const face=emphasis?bold:font;need(face.widthOfTextAtSize(value,size)<=499&&y>=48,'TPV_SIGNATURE_TEXT_UNSUPPORTED');page.drawText(value,{x:48,y,size,font:face,color:rgb(.07,.10,.16)});y-=size+10;};
  text('Firma del cliente',20,true);text('Factura del pedido #'+document.order_id,13,true);text('Registro: '+snapshotId,8);
  text('Fecha de captura: '+signedAt,9);text('Operador: '+actorName,10);y-=12;
  const wrap=value=>{const lines=[];for(const paragraph of value.split(/\r?\n/)){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){if(font.widthOfTextAtSize(word,10)>490)throw Error('TPV_SIGNATURE_TEXT_UNSUPPORTED');if(line&&font.widthOfTextAtSize(line+' '+word,10)>490){lines.push(line);line=word;}else line+=(line?' ':'')+word;}lines.push(line);}return lines;};
  const acceptanceLines=wrap(acceptanceText);need(acceptanceLines.length<=12,'TPV_SIGNATURE_TEXT_UNSUPPORTED');
  for(const line of acceptanceLines)text(line,10);y-=14;
  const box={x:48,y:y-196,width:499,height:196};page.drawRectangle({...box,borderWidth:.7,borderColor:rgb(.72,.76,.81),color:rgb(1,1,1)});
  for(const stroke of strokes.strokes)for(let i=1;i<stroke.length;i++){
   const a=stroke[i-1],b=stroke[i];page.drawLine({start:{x:box.x+a[0]/1000*box.width,y:box.y+box.height-a[1]/400*box.height},end:{x:box.x+b[0]/1000*box.width,y:box.y+box.height-b[1]/400*box.height},thickness:1.5,color:rgb(.07,.10,.16)});
  }
  y=box.y-28;text('Firma manuscrita capturada y vinculada a la copia original conservada.',9);
  text('SHA-256 del PDF original:',8);text(document.sha256,8);
  text('La factura original conserva sus '+originalPages+' página(s), importes y numeración.',9);
  const signed=await pdf.save();need(signed.length<=2250000,'TPV_SIGNATURE_DOCUMENT_TOO_LARGE');
  return {mime:'application/pdf',filename:'totus-invoice-'+document.order_id+'-firmada.pdf',base64:base64(signed),sha256:await signatureHash(signed),originalSha256:document.sha256,originalPages,pages:pdf.getPageCount()};
 };
 render.validateOriginal=async document=>{const bytes=await signatureOriginal(document);let pdf;try{pdf=await PDFDocument.load(bytes,{updateMetadata:false});}catch{throw Error('TPV_SIGNATURE_DOCUMENT_INVALID');}need(pdf.getPageCount()>0&&pdf.getPageCount()<=100&&!pdf.isEncrypted,'TPV_SIGNATURE_DOCUMENT_INVALID');return bytes;};
 return render;
}
