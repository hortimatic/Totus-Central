import {createSignatureCapture,signatureInk,signatureSvg} from './signature-capture.js';
import {signatureDocumentBlob} from './signature-document.js';
import {renderPdfPreview} from '../pdf-preview.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value);
export function createSignaturePanel({actor,storage,getAdapter,getScope,canWrite,getSettings,viewPdf=renderPdfPreview,saveFile=({blob,filename})=>{const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);},capture=createSignatureCapture(),now=Date.now}){
 let epoch=0,opened=false,saleId=null,record=null,requestId=null,pending='',ink=null,accepted=false,viewed='',running=false,previewHost=null,boundOwner=null;
 const owner=()=>JSON.stringify([actor(),getScope()?.connectionId,getScope()?.shopId,getScope()?.drawerId,getScope()?.sessionId]);
 const pointerKey=id=>'totus:tpv:signature:v1:'+JSON.stringify([actor(),getScope()?.connectionId,getScope()?.shopId,getScope()?.drawerId,id]);
 const recordKey=()=>record?record.id+':'+record.original.sha256:'';
 function token(){return {epoch,owner:owner(),adapter:getAdapter()};}
 function check(stamp){if(stamp.epoch!==epoch||stamp.owner!==owner()||stamp.adapter!==getAdapter())throw Error('La cuenta o la caja han cambiado. Vuelve a consultar el documento.');}
 function reset(){epoch++;boundOwner=null;capture.cancel();opened=false;saleId=null;record=null;requestId=null;pending='';ink=null;accepted=false;viewed='';running=false;previewHost=null;}
 function pointer(id){storage.setItem(pointerKey(saleId),JSON.stringify({id,saleId}));requestId=id;}
 function forget(){try{storage.removeItem(pointerKey(saleId));}catch{}}
 async function apply(value,stamp){
  check(stamp);if(!value||!uuid(value.id)||value.operationId!==saleId||!Number.isSafeInteger(value.orderId)||!['prepared','signed','cancelled'].includes(value.status))throw Error('No se ha podido comprobar la factura guardada.');
  await signatureDocumentBlob(value,'original');if(value.status==='signed')await signatureDocumentBlob(value,'signed');check(stamp);
  if(!record||record.id!==value.id||record.original.sha256!==value.original.sha256){ink=null;accepted=false;viewed='';}
  record=value;requestId=value.id;pending='';if(value.status==='signed'||value.status==='cancelled'){ink=null;forget();}else pointer(value.id);return value;
 }
 async function execute(fn){if(opened&&boundOwner!==owner()){reset();throw Error('La cuenta o la caja han cambiado. Vuelve a consultar el documento.');}if(running)throw Error('Termina primero la operación de firma actual.');const stamp=token();running=true;try{return await fn(stamp);}catch(error){if(stamp.epoch===epoch&&/^TPV_SIGNATURE_(EXPIRED|POLICY_CHANGED|DISABLED|FORBIDDEN|CANCELLED|ALREADY_BOUND)$/.test(error?.code||''))pending='';throw error;}finally{if(stamp.epoch===epoch)running=false;}}
 function writable(){if(!canWrite()||!getSettings()?.enabled)throw Error('Abre una caja autorizada y activa la firma de facturas para continuar.');}
 async function open(id){if(opened&&boundOwner!==owner())reset();if(!uuid(id))throw Error('No se ha podido identificar la venta.');if(opened&&saleId===id)return record;if(ink||pending)throw Error('Guarda, recupera o cancela la firma actual antes de abrir otra factura.');reset();opened=true;boundOwner=owner();saleId=id;
  return execute(async stamp=>{
   let saved=null;try{const p=JSON.parse(storage.getItem(pointerKey(id))||'null');if(p?.saleId===id&&uuid(p.id)){requestId=p.id;saved=await stamp.adapter.getInvoiceSignature(p.id);check(stamp);}}catch(error){if(requestId)throw error;}
   if(!saved){saved=await stamp.adapter.findInvoiceSignature(id);check(stamp);}
   if(saved?.status==='prepared'&&(Date.parse(saved.expiresAt)<=now()||saved.sessionId&&saved.sessionId!==getScope()?.sessionId)){saved=null;forget();requestId=null;}
   if(saved&&saved.status!=='cancelled')return apply(saved,stamp);
   if(!canWrite()||!getSettings()?.enabled){record=null;return null;}
   writable();pointer(crypto.randomUUID());pending='prepare';
   return apply(await stamp.adapter.prepareInvoiceSignature({operationId:requestId,saleId}),stamp);
  });
 }
 async function collect(){return execute(async stamp=>{writable();if(record?.status!=='prepared'||pending||!accepted||viewed!==recordKey())throw Error('Revisa primero la factura y el texto que va a aceptar el cliente.');
  const value=await capture.capture({documentLabel:'Factura del pedido #'+record.orderId,acceptanceText:record.acceptanceText});check(stamp);if(value)ink=signatureInk(value);return value;
 });}
 async function submit(){return execute(async stamp=>{writable();if(record?.status!=='prepared'||!ink||!accepted||viewed!==recordKey())throw Error('Revisa el documento y recoge la firma antes de guardarlo.');
  pending='sign';const expected=signatureInk(ink),value=await stamp.adapter.signInvoice({operationId:record.id,originalSha256:record.original.sha256,ink:expected,accepted:true});check(stamp);if(value?.status==='signed'&&JSON.stringify(value.ink)!==JSON.stringify(expected))throw Error('No se ha confirmado la firma recogida. Recupera el resultado de esta misma solicitud.');return apply(value,stamp);
 });}
 async function recover(){return execute(async stamp=>{
  if(!requestId)throw Error('No hay una solicitud de firma que recuperar.');const saved=await stamp.adapter.getInvoiceSignature(requestId);check(stamp);
  if(saved){const intended=ink&&signatureInk(ink),wasPending=pending;await apply(saved,stamp);if(saved.status==='prepared'&&wasPending==='sign'&&intended){ink=intended;pending='sign';writable();return apply(await stamp.adapter.signInvoice({operationId:saved.id,originalSha256:saved.original.sha256,ink:intended,accepted:true}),stamp);}return saved;}
  if(pending==='prepare'){writable();return apply(await stamp.adapter.prepareInvoiceSignature({operationId:requestId,saleId}),stamp);}
  throw Error('No se encuentra la preparación de firma. Vuelve a consultar la venta.');
 });}
 async function cancel(){return execute(async stamp=>{if(pending)throw Error('Recupera primero el resultado de esta misma solicitud.');if(record?.status==='prepared'){writable();await apply(await stamp.adapter.cancelInvoiceSignature(record.id),stamp);}reset();});}
 async function download(kind){return execute(async stamp=>{if(!record)throw Error('Consulta primero la factura.');const file=await signatureDocumentBlob(record,kind);check(stamp);saveFile(file);if(kind==='original')viewed=recordKey();});}
 function html(){if(opened&&boundOwner!==owner())reset();if(!opened)return '';const prepared=record?.status==='prepared',signed=record?.status==='signed';
  return `<section class="card card-pad tpv-signature-panel"><header class="tpv-signature-heading"><div><p class="eyebrow">Documentos de la venta</p><h3>Factura y firma del cliente${record?' · pedido #'+esc(record.orderId):''}</h3></div><span class="badge ${signed?'success':'info'}">${signed?'Firmada y guardada':'Firma del cliente'}</span></header><p>La factura original se conserva. La firma se añade a una copia vinculada a este mismo documento.</p><div class="tpv-signature-layout">${record?`<section class="tpv-signature-document"><h4>${signed?'Copia firmada':'Factura original'}</h4><div data-signature-pdf class="pdf-preview"></div></section>`:''}<section class="tpv-signature-controls" aria-label="Revisión y firma">${record?.acceptanceText?'<p class="note">'+esc(record.acceptanceText)+'</p>':''}
   ${!record&&!pending?'<p>Este pedido todavía no tiene una factura firmada. Para recoger una firma, abre una caja autorizada y activa la opción en Configuración.</p>':''}
   ${prepared&&!pending?`<label class="tpv-check"><input type="checkbox" data-signature-reviewed ${accepted?'checked':''} ${canWrite()?'':'disabled'}> He revisado esta factura y el texto que va a aceptar el cliente</label>${ink?'<div class="tpv-signature-ink">'+signatureSvg(ink)+'</div>':''}<div class="inline-actions"><button class="btn secondary" type="button" data-tpv-action="signature-capture" ${!canWrite()||!accepted||viewed!==recordKey()?'disabled':''}>${ink?'Rehacer firma':'Recoger firma'}</button>${ink?'<button class="btn primary" type="button" data-tpv-action="signature-save">Guardar factura firmada</button>':''}${canWrite()?'<button class="btn secondary" type="button" data-tpv-action="signature-cancel">Cancelar preparación</button>':''}</div>`:''}
   ${pending?'<p class="note" role="status">El resultado todavía no está confirmado. Conserva esta solicitud y recupera su estado antes de recoger otra firma.</p><button class="btn primary" type="button" data-tpv-action="signature-recover">Recuperar resultado de firma</button>':''}
   ${signed?'<p class="note" role="status">Factura firmada conservada en Central.</p><p class="small muted">Recogida por '+esc(record.actorName)+' · '+esc(record.signedAt?new Date(record.signedAt).toLocaleString('es-ES'):'')+'</p>':''}<div class="inline-actions">${record?'<button class="btn secondary" type="button" data-tpv-action="signature-original">Descargar original</button>':''}${signed?'<button class="btn primary" type="button" data-tpv-action="signature-download">Descargar factura firmada</button>':''}<button class="btn secondary" type="button" data-tpv-action="signature-close">Volver a documentos</button></div></section></div></section>`;
 }
 async function mountPreview(root){const target=root?.querySelector('[data-signature-pdf]');if(!target||!record||target===previewHost)return;previewHost=target;const stamp=token(),key=recordKey(),original=record;
  try{const file=await signatureDocumentBlob(original,original.status==='signed'?'signed':'original');check(stamp);if(!target.isConnected)return;await viewPdf(file.blob,target);check(stamp);if(target.isConnected&&key===recordKey()&&target.dataset.pdfRendered){viewed=key;const button=root.querySelector('[data-tpv-action="signature-capture"]');if(button)button.disabled=!accepted||!canWrite();}}
  catch{if(target.isConnected)target.textContent='No se ha podido mostrar el PDF. Descarga el original para revisarlo.';}
 }
 function review(value,root){accepted=value===true;const button=root?.querySelector('[data-tpv-action="signature-capture"]');if(button)button.disabled=!accepted||!canWrite()||viewed!==recordKey();}
 return {open,collect,submit,recover,cancel,download,reset,html,mountPreview,review,isOpen:()=>opened,hasDraft:()=>!!ink||!!pending};
}
