import assert from 'node:assert/strict';
import {state,setView} from '../src/state.js';
import {cotejoLineStatus,cotejoSummary,cotejos} from '../src/stock-cotejos.js';
import {ROUTES} from '../src/config.js';

const base={supplierProduct:'Artículo de proveedor',stockProduct:'Artículo de PrestaShop',
 unit:'ud',expected:10,recorded:8,adjustment:0,matchConfirmed:true,evidence:'Referencia comprobada'};
assert.deepEqual(cotejoLineStatus(base),{kind:'difference',received:8,difference:-2});
assert.deepEqual(cotejoLineStatus({...base,recorded:10}),{kind:'ok',received:10,difference:0});
assert.deepEqual(cotejoLineStatus({...base,recorded:13,adjustment:3,adjustmentIncluded:'yes'}),{kind:'ok',received:10,difference:0});
assert.deepEqual(cotejoLineStatus({...base,recorded:13,adjustment:3,adjustmentIncluded:'no'}),{kind:'difference',received:13,difference:3});
assert.equal(cotejoLineStatus({...base,recorded:13,adjustment:3,adjustmentIncluded:'unknown'}).kind,'pending');
assert.equal(cotejoLineStatus({...base,matchConfirmed:false}).kind,'pending');
assert.equal(cotejoLineStatus({...base,unit:''}).kind,'pending');
assert.equal(cotejoLineStatus({...base,expected:null}).kind,'pending');
assert.equal(cotejoLineStatus({...base,recorded:null}).kind,'pending');
assert.deepEqual(cotejoSummary([base,{...base,recorded:10},{...base,unit:''}]),{ok:1,difference:1,pending:1});
assert.ok(ROUTES.some(route=>route.id==='cotejos'));
const current=state.data.cotejos;
state.data.cotejos=[{
 id:'qa-cotejo-1',shop:'Hortimatic',supplier:'Proveedor QA',reference:'QA-2026',
 status:'con_diferencias',complete:false,coverage:'2 documentos, 12 líneas verificadas',
 rows:[base,{...base,supplierProduct:'<script>malicioso</script>',matchConfirmed:false}],
 warnings:['Una página pendiente'],documents:[{name:'factura.pdf'}],received_on:'2026-10-23'
}];
try{
 setView('cotejos',{mode:'list',id:null});
 const list=cotejos();
 assert.ok(list.includes('QA-2026')&&list.includes('stock-open'));
 setView('cotejos',{mode:'record',id:'qa-cotejo-1'});
 const detail=cotejos();
 assert.ok(detail.includes('Proveedor QA')&&detail.includes('stock-back'));
 assert.ok(detail.includes('Una página pendiente'));
 assert.ok(detail.includes('&lt;script&gt;')&&!detail.includes('<script>'), 'Never render HTML from supplier fields');
 assert.ok(detail.includes('Por confirmar'));
}finally{
 state.data.cotejos=current;
 setView('cotejos',{mode:'list',id:null});
}
console.log('STOCK COTEJOS QA: calculations, pending cases, escaping, list and detail OK');
