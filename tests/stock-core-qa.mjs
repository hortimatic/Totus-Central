import assert from 'node:assert/strict';
import {stockLineResult,stockCorrectedLineResult,stockSummary} from '../src/stock-core.js';
import {extractStockText} from '../src/stock-extract.js';
const row={id:'r1',supplier_qty:10,prestashop_qty:12,adjustment_qty:2,adjustment_included:'yes',adjustment_reason:'Corrección de otra entrega',unit:'unidad',unit_factor:1,unit_confirmed:true,match_confirmed:true,source_refs:[{source_id:'s1',locator:'p1 l1',line_id:'p1l1'},{source_id:'s2',locator:'fila 1',line_id:'f1'}]};
assert.equal(stockLineResult(row).difference,0);
const overridden={...row,unit_correction:{expected:10,received:8,reason:'Comprobación detallada con albarán y recuento verificado.',corrected_by:'qa@example.invalid'}};
assert.equal(stockLineResult(overridden).difference,0,'The original documentary result must never change');
assert.equal(stockCorrectedLineResult(overridden).difference,-2,'Corrected units are separate');
assert.equal(stockCorrectedLineResult(overridden).originalReceived,10);
assert.equal(stockCorrectedLineResult(overridden).hasCorrection,true);
assert.equal(stockCorrectedLineResult(row).hasCorrection,false);

assert.equal(stockLineResult({...row,adjustment_included:'no'}).difference,2);
for(const change of [{supplier_qty:null},{prestashop_qty:null},{adjustment_qty:null},{adjustment_included:'unknown'},{unit:''},{unit_factor:0},{unit_confirmed:false},{match_confirmed:false},{adjustment_reason:''},{unit_factor:12,conversion_reason:''}]){
 assert.equal(stockLineResult({...row,...change}).status,'needs_review');
}
assert.equal(stockLineResult({...row,supplier_qty:-2,prestashop_qty:-2,adjustment_qty:0}).status,'matched');
const sources=[{id:'s1',source_kind:'supplier',extraction:{state:'ready'}},{id:'s2',source_kind:'prestashop',extraction:{state:'ready'}}];
const result={complete:true,rows:[row],coverage:sources.map(s=>({source_id:s.id,complete:true,explanation:'Todo leído'}))};
assert.equal(stockSummary(result,sources).status,'matched');
assert.equal(stockSummary({...result,rows:[row,{...row,id:'r2'}]},sources).status,'needs_review');
assert.equal(stockSummary({...result,coverage:[]},sources).status,'needs_review');
assert.equal(stockSummary(result,[sources[0],{...sources[1],extraction:{state:'unread'}}]).status,'needs_review');
assert.equal(stockSummary({...result,rows:[{...row,prestashop_qty:13}]},sources).status,'differences');
const pdfLibrary={getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async n=>({getTextContent:async()=>({items:n===1?[{str:'Producto 10',transform:[1,0,0,1,10,10]}]:[]}),cleanup(){}})}),destroy:async()=>{}})};
const file={name:'scan.pdf',arrayBuffer:async()=>new ArrayBuffer(1)};
const extracted=await extractStockText(file,{pdfLibrary});
assert.equal(extracted.extraction.state,'partial');
assert.equal(extracted.extraction.pages[1].readable,false);
const blankLibrary={getDocument:()=>({promise:Promise.resolve({numPages:1,getPage:async()=>({getTextContent:async()=>({items:[]}),cleanup(){}})}),destroy:async()=>{}})};
const blank=await extractStockText(file,{pdfLibrary:blankLibrary});assert.equal(blank.extraction.state,'unread');assert.equal(blank.text,'');
const text=await extractStockText({name:'data.csv',text:async()=>'producto;cantidad\nA;10'});assert.equal(text.extraction.state,'ready');
const tooLong=await extractStockText({name:'data.txt',text:async()=>'a'.repeat(250001)});assert.equal(tooLong.extraction.state,'partial');assert.equal(tooLong.text.length,250000);
assert.equal((await extractStockText({name:'foto.png'})).extraction.state,'unread');
console.log('STOCK CORE QA: signed quantities, adjustments, unknown data, source coverage, duplicate origins, scan detection and extraction bounds OK');
