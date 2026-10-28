import assert from 'node:assert/strict';
import {filterStockReceipts,sameStockEquivalence,stockExportRows,stockReportHtml,stockChatEvidence} from '../src/stock-workflow.js';
import {unmatchedStockRows,pairUnmatchedStockRows} from '../src/stock-manual-matching.js';
const receipts=[{id:'a',received_on:'2026-01-01',supplier:'Proveedor',store_id:'A',status:'matched'},{id:'b',received_on:'2026-02-28',supplier:'Otro',store_id:'B',status:'needs_review'},{id:'c',received_on:'2026-03-01',supplier:'Proveedor',store_id:'A',status:'pending'}];
assert.equal(filterStockReceipts(receipts,{from:'2026-01-01',to:'2026-02-28'}).length,2);
assert.equal(filterStockReceipts(receipts,{from:'2026-02-28',to:'2026-02-28'})[0].id,'b');
assert.equal(filterStockReceipts(receipts,{to:'2026-01-01'}).length,1);
assert.equal(filterStockReceipts(receipts,{from:'2026-02-28',store:'B',status:'needs_review',query:'OTRO'}).length,1);
assert.throws(()=>filterStockReceipts(receipts,{from:'2026-03-01',to:'2026-02-01'}),/fecha/);
const r={id:'receipt',store_id:'A',supplier:'Proveedor',reference:'<script>not-code</script>',revision:4,received_on:'2026-01-01'};
const row={id:'line',supplier_name:'=SUM(1,2)',prestashop_name:'Producto',variant:'0.8 ohm',unit:'unidad',supplier_qty:3,prestashop_qty:9,adjustment_qty:0,adjustment_included:'no',unit_factor:3,match_confirmed:true,unit_confirmed:true,conversion_reason:'Paquetes de 3 confirmados',source_refs:[{source_id:'s1',locator:'Página 1',line_id:'1'},{source_id:'s2',locator:'Fila 2',line_id:'2'}]};
const sources=[{id:'s1',source_kind:'supplier',extraction:{state:'ready'},document:{original_name:'Factura'}},{id:'s2',source_kind:'prestashop',extraction:{state:'ready'},document:{original_name:'Entrada'}}];
r.result={complete:true,rows:[row],coverage:sources.map(s=>({source_id:s.id,complete:true,explanation:'Documento completo leído'}))};
const context={receipt:r,sources,equivalences:[]};
const exported=stockExportRows(context,'Hortimatic');
assert.equal(exported[0]['Unidades esperadas'],9);assert.equal(exported[0]['Diferencia'],0);
assert.equal(exported[0]['Producto del proveedor'],'=SUM(1,2)','Export raw text without evaluating formula');
assert(stockReportHtml(context).includes('&lt;script&gt;'));assert(!stockReportHtml(context).includes('<script>'));
const unknown=structuredClone(context);unknown.receipt.result.rows[0].supplier_qty=null;
assert.equal(stockExportRows(unknown)[0]['Unidades esperadas'],null);assert(stockReportHtml(unknown).includes('Pendiente'));
// Human review changes the receipt state without erasing documentary discrepancies.
const reviewed=structuredClone(context);
reviewed.receipt.status='differences';
reviewed.receipt.result.rows[0].prestashop_qty=7;
reviewed.receipt.result.review={note:'Contadas las unidades; diferencia identificada y registrada para reposición.',reviewed_by:'gerencia@example.invalid',reviewed_at:'2026-10-28T13:00:00Z',comparison_status:'differences'};
const reviewedRows=stockExportRows(reviewed,'Hortimatic');
assert.equal(reviewedRows[0]['Estado del pedido'],'Revisado');
assert(!reviewedRows[0]['Estado del pedido'].includes('incidencias'),'Green sign-off should be unambiguously labeled Revisado');
assert.equal(reviewedRows[0]['Estado documental calculado'],'Con diferencias');
assert.equal(reviewedRows[0]['Diferencia'],-2);
assert.equal(reviewedRows[0]['Justificación de revisión'],reviewed.receipt.result.review.note);
assert(stockReportHtml(reviewed).includes(reviewed.receipt.result.review.note));
assert(stockReportHtml(reviewed).includes('Con diferencias'),'Report must retain calculated status separately');
assert.equal(filterStockReceipts([reviewed.receipt],{status:'reviewed'}).length,1);
const injection=structuredClone(reviewed);injection.receipt.result.review.note='<script>bad</script>';
assert(!stockReportHtml(injection).includes('<script>'),'Review note must be escaped');
const e={...row,supplier:' PROVEEDOR ',store_id:'A'};
assert(sameStockEquivalence(e,row,r));assert(!sameStockEquivalence({...e,variant:'0.6 ohm'},row,r));
assert(!sameStockEquivalence({...e,store_id:'B'},row,r));
assert.equal(JSON.parse(stockChatEvidence(context)).revision,4);
console.log('STOCK WORKFLOW: inclusive ranges, store/status/text filters, guarded equivalences, complete exports, HTML safety, unknown quantities and evidence package OK');


// Manual pairing combines two *existing* sources; it must not fabricate
// quantities, merge sizes automatically, or change the input document rows.
const pendingSupplier={
 id:'supplier-l1',supplier_name:'Proveedor Gold Nuggets 25 g',
 prestashop_name:'',supplier_qty:5,prestashop_qty:0,match_confirmed:false,
 unit:'unidad',unit_confirmed:true,unit_factor:1,variant:'25 g',
 adjustment_qty:0,adjustment_included:'no',adjustment_reason:'',conversion_reason:'',
 source_refs:[{source_id:'s1',line_id:'factura-l1',locator:'Factura página 1'}]
};
const pendingPrestashop={
 id:'prestashop-l1',supplier_name:'',prestashop_name:'Golden Nuggets 25 gr',
 supplier_qty:0,prestashop_qty:1,match_confirmed:false,variant:'25 g',
 source_refs:[{source_id:'s2',line_id:'entrada-l1',locator:'Entrada página 2'}]
};
const pending50g={
 id:'prestashop-50g',supplier_name:'',prestashop_name:'Golden Nuggets 50 gr',
 supplier_qty:0,prestashop_qty:5,match_confirmed:false,variant:'50 g',
 source_refs:[{source_id:'s2',line_id:'entrada-l2',locator:'Entrada página 2'}]
};
const originalRows=[pendingSupplier,pendingPrestashop,pending50g];
const candidates=unmatchedStockRows(originalRows);
assert.equal(candidates.supplier.length,1);assert.equal(candidates.prestashop.length,2);
assert.throws(()=>pairUnmatchedStockRows(originalRows,{
 supplierLineId:'supplier-l1',prestashopLineId:'prestashop-l1',
 issueKind:'same_product',note:'breve',actor:'qa@example.invalid'
}),/20 a 5000/);
const paired=pairUnmatchedStockRows(originalRows,{
 supplierLineId:'supplier-l1',prestashopLineId:'prestashop-l1',
 issueKind:'same_product',
 note:'Revisadas referencias, etiqueta y tamaño 25 g en ambos documentos.',
 actor:'qa@example.invalid'
});
assert.equal(paired.rows.length,2,'The other variant must remain separate');
assert.equal(paired.row.prestashop_qty,1);
assert.equal(paired.row.supplier_qty,5);
assert.equal(paired.row.match_confirmed,true);
assert.equal(paired.row.source_refs.length,2,'Both original source lines survive');
assert.equal(originalRows[0].prestashop_qty,0,'Input must not be mutated');
assert.equal(originalRows[1].supplier_qty,0,'Input must not be mutated');
assert.equal(unmatchedStockRows(paired.rows).prestashop[0].id,'prestashop-50g');
assert.equal(paired.row.manual_assignment.kind,'same_product');
assert.throws(()=>pairUnmatchedStockRows(paired.rows,{
 supplierLineId:'supplier-l1',prestashopLineId:'prestashop-50g',
 issueKind:'same_product',note:'No se puede asignar dos veces el mismo producto.',
 actor:'qa@example.invalid'
}),/cambió/);
assert.throws(()=>pairUnmatchedStockRows(originalRows,{
 supplierLineId:'prestashop-50g',prestashopLineId:'prestashop-l1',
 issueKind:'same_product',note:'No corresponde una fuente PrestaShop a factura.',
 actor:'qa@example.invalid'
}),/cambió/);
const manualContext=structuredClone(context);
manualContext.receipt.result.rows=[paired.row];
const manualExport=stockExportRows(manualContext,'Hortimatic')[0];
assert(manualExport['Asignación manual'].includes('25 g'));
assert.equal(manualExport['Diferencia'],-4);
assert(!manualExport['Incidencia de catálogo']);
console.log('STOCK MANUAL PAIRING: isolated sources, preserved variants, confirmation, immutable original rows and exports OK');
