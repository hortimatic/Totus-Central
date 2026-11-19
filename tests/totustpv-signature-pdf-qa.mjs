import test from 'node:test';import assert from 'node:assert/strict';import {PDFDocument,StandardFonts,rgb} from 'pdf-lib';
import {createSignaturePdfRenderer,signatureHash,signatureOriginal} from '../src/totustpv/server/signature-pdf.js';
const renderer=createSignaturePdfRenderer({PDFDocument,StandardFonts,rgb}),ink={width:1000,height:400,strokes:[[[20,40],[100,80],[200,40]]]};
async function fixture(){const pdf=await PDFDocument.create();pdf.addPage([400,500]).drawText('Factura ficticia 123: total 8.01 EUR');const bytes=await pdf.save();return {kind:'invoice',existing_document:true,mime:'application/pdf',order_id:123,filename:'totus-invoice-123.pdf',base64:Buffer.from(bytes).toString('base64'),sha256:await signatureHash(bytes)};}
const metadata={ink,snapshotId:'00000000-0000-4000-8000-000000000001',actorName:'Operador ficticio',signedAt:'2026-11-19T01:00:00.000Z',acceptanceText:'Recepción del documento de prueba.'};
test('signed copy retains original page geometry and content and appends an ink page bound to its SHA',async()=>{
 const document=await fixture(),original=document.base64,signed=await renderer({document,...metadata}),pdf=await PDFDocument.load(Buffer.from(signed.base64,'base64'));
 assert.equal(document.base64,original);assert.equal(pdf.getPageCount(),2);assert.equal(signed.originalPages,1);assert.equal(pdf.getPage(0).getWidth(),400);assert.equal(pdf.getPage(0).getHeight(),500);assert.equal(signed.originalSha256,document.sha256);assert.equal(await signatureHash(Buffer.from(signed.base64,'base64')),signed.sha256);assert.notEqual(signed.sha256,document.sha256);
 const originalPdf=await PDFDocument.load(Buffer.from(original,'base64'));
 assert.deepEqual(pdf.getPage(0).node.Contents().asArray().map(x=>Array.from(pdf.context.lookup(x).getContents())),originalPdf.getPage(0).node.Contents().asArray().map(x=>Array.from(originalPdf.context.lookup(x).getContents())),'The original invoice page streams are unchanged');
});
test('changed bytes, wrong document identity and blank ink cannot produce a signed copy',async()=>{
 const document=await fixture();await assert.rejects(signatureOriginal({...document,sha256:'0'.repeat(64)}),/HASH_MISMATCH/);
 await assert.rejects(signatureOriginal({...document,kind:'credit-note'}),/DOCUMENT_INVALID/);
 await assert.rejects(renderer({document,...metadata,ink:{...ink,strokes:[]}}),/Traza la firma/);
 await assert.rejects(renderer({document,...metadata,actorName:'fake\noperator'}),/METADATA_INVALID/);
 await assert.rejects(renderer({document,...metadata,acceptanceText:'linea\n'.repeat(20)}),/TEXT_UNSUPPORTED/);
 await assert.rejects(renderer({document,...metadata,actorName:'W'.repeat(100)}),/TEXT_UNSUPPORTED/);
});
