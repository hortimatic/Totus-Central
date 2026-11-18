import test from 'node:test';
import assert from 'node:assert/strict';
import {createBarcodePanel} from '../src/totustpv/barcode-panel.js';
const target={dataset:{tpvBarcode:'create'}};
test('preparing a list never generates codes and a pause stops the next capture request',async()=>{
 const calls=[];let release;const waiting=new Promise(r=>{release=r;});
 const panel=createBarcodePanel({canRead:()=>true,canEdit:()=>true,adapter:()=>({
  createBarcodeJob:async()=>({id:'job',status:'preparing'}),captureBarcodeJob:async()=>{calls.push('capture');await waiting;return {id:'job',status:'preparing',items:[]};},
  pauseBarcodeJob:async()=>{calls.push('pause');return {id:'job',status:'paused',items:[]};},
  barcodeJobs:async()=>[],getBarcodeJob:async()=>({id:'job',status:'paused',items:[]})})});
 const running=panel.click(target);await new Promise(r=>setTimeout(r,0));assert.equal(panel.isRunning(),true);
 await panel.click({dataset:{tpvBarcode:'pause'}});release();await running;assert.deepEqual(calls,['capture','pause']);assert.match(panel.html(),/En pausa/);
});
test('reset during an in-flight capture discards its response and prevents further requests',async()=>{
 let release;const waiting=new Promise(r=>{release=r;});let reads=0;
 const panel=createBarcodePanel({canRead:()=>true,canEdit:()=>true,adapter:()=>({createBarcodeJob:async()=>({id:'job',status:'preparing'}),captureBarcodeJob:async()=>{reads++;await waiting;return {id:'job',status:'preparing'};}})});
 const running=panel.click(target);await new Promise(r=>setTimeout(r,0));panel.reset();release();await running;
 assert.equal(reads,1);assert.equal(panel.isRunning(),false);assert.equal(panel.html().includes('Trabajo seleccionado'),false);
});
test('cancelled uncertain work can be checked with view permission without resuming generation',async()=>{
 const calls=[];let uncertain=1;
 const job=()=>({id:'job',field:'ean13',status:'cancelled',capturedCount:1,uncertainCount:uncertain,items:[]});
 const panel=createBarcodePanel({canRead:()=>true,canEdit:()=>false,adapter:()=>({
  barcodeOptions:async()=>({field:'ean13',generatorEnabled:true}),barcodeJobs:async()=>[job()],getBarcodeJob:async()=>job(),
  advanceBarcodeJob:async()=>{calls.push('recover');uncertain=0;return job();}
 })});
 await panel.load();await panel.click({dataset:{tpvBarcode:'select:job'}});assert.match(panel.html(),/Comprobar operaciones enviadas/);
 await panel.click({dataset:{tpvBarcode:'recover'}});assert.deepEqual(calls,['recover']);assert.equal(panel.html().includes('Comprobar operaciones enviadas'),false);
});
