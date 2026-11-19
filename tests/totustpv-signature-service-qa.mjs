import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createSignatureService} from '../src/totustpv/server/signature-service.js';import {createSignaturePdfRenderer,signatureHash} from '../src/totustpv/server/signature-pdf.js';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),ink={width:1000,height:400,strokes:[[[20,40],[100,80],[200,40]]]};
async function fixture(){
 const pdf=await PDFDocument.create();pdf.addPage().drawText('Factura ficticia 91');const bytes=await pdf.save();
 const original={kind:'invoice',existing_document:true,mime:'application/pdf',order_id:91,filename:'totus-invoice-91.pdf',base64:Buffer.from(bytes).toString('base64'),sha256:await signatureHash(bytes),unexpectedSecret:'not-for-storage'};
 const f={state:new Map(),calls:[],reads:0,renders:0,losePrepare:false,loseSign:false,time:Date.now()};
 const inner=createSignaturePdfRenderer({PDFDocument,StandardFonts,rgb}),render=async data=>{f.renders++;return inner(data);};render.validateOriginal=inner.validateOriginal;
 const rpc=async(name,args)=>{f.calls.push(structuredClone({name,args}));
  if(name==='totus_tpv_orders')return {data:[{id:id(1),orderId:91,status:'confirmed',scope:{actorId:id(7)}}]};
  assert.equal(name,'totus_tpv_signature_journal');let record=f.state.get(args.p_id);
  if(args.p_action==='get')return {data:record?structuredClone(record):null};
  if(args.p_action==='prepare'){
   record={id:args.p_id,operationId:args.p_data.saleId,orderId:91,actorName:'Operador ficticio',acceptanceText:'Recepcion de prueba',original:structuredClone(args.p_data.original),status:'prepared',createdAt:new Date(f.time).toISOString(),expiresAt:new Date(f.time+600000).toISOString()};f.state.set(args.p_id,record);
   if(f.losePrepare){f.losePrepare=false;return {error:{message:'TPV_SIGNATURE_STORAGE_UNAVAILABLE'}};}
  }else if(args.p_action==='sign'){
   record={...record,ink:structuredClone(args.p_data.ink),signed:structuredClone(args.p_data.signed),signedAt:args.p_data.signedAt,status:'signed'};f.state.set(args.p_id,record);
   if(f.loseSign){f.loseSign=false;return {error:{message:'TPV_SIGNATURE_STORAGE_UNAVAILABLE'}};}
  }else if(args.p_action==='cancel'){record={...record,status:'cancelled'};f.state.set(args.p_id,record);}else assert.fail('Unexpected write');
  return {data:structuredClone(record)};
 };
 f.service=createSignatureService({rpc,render,scope:{actorId:id(5)},now:()=>f.time,transport:{readNativeDocument:async query=>{f.reads++;assert.deepEqual(query,{operationId:id(1),sourceActorId:id(7),kind:'invoice'});return original;},nativeCommand:()=>assert.fail('Signing cannot issue native writes')}});return f;
}
test('lost prepare and sign responses recover the exact original and signed bytes without another native read or render',async()=>{
 const f=await fixture(),operationId=id(2);f.losePrepare=true;
 await assert.rejects(f.service.prepare({operationId,saleId:id(1)}),/STORAGE_UNAVAILABLE/);
 const prepared=await f.service.prepare({operationId,saleId:id(1)});assert.equal(f.reads,1);assert.equal(prepared.original.unexpectedSecret,undefined);
 const request={operationId,originalSha256:prepared.original.sha256,ink,accepted:true};f.loseSign=true;
 await assert.rejects(f.service.sign(request),/STORAGE_UNAVAILABLE/);const first=f.state.get(operationId).signed;
 const stored=await f.service.sign(request);assert.equal(f.renders,1);assert.deepEqual(stored.signed,first);assert.equal(f.reads,1);
 assert.deepEqual((await f.service.get(operationId)).signed,first);
 assert.equal(f.calls.filter(x=>x.args.p_action==='prepare').length,1);assert.equal(f.calls.filter(x=>x.args.p_action==='sign').length,1);
});
test('consent, document hash, ink, expiry and bound sale are checked before any signature write',async()=>{
 const f=await fixture(),operationId=id(2),prepared=await f.service.prepare({operationId,saleId:id(1)}),request={operationId,originalSha256:prepared.original.sha256,ink,accepted:true};
 await assert.rejects(f.service.sign({...request,accepted:false}),/ACCEPTANCE_REQUIRED/);
 await assert.rejects(f.service.sign({...request,originalSha256:'0'.repeat(64)}),/HASH_MISMATCH/);
 await assert.rejects(f.service.sign({...request,ink:{...ink,strokes:[]}}),/INK_INVALID/);
 await assert.rejects(f.service.prepare({operationId,saleId:id(8)}),/ALREADY_BOUND/);
 f.time+=600001;await assert.rejects(f.service.sign(request),/EXPIRED/);assert.equal(f.renders,0);
 assert.equal(f.calls.filter(x=>x.args.p_action==='sign').length,0);
});
