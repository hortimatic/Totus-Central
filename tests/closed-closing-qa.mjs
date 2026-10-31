import assert from 'node:assert/strict';
import {state} from '../src/state.js';
import {closingRecordHtml} from '../src/pages/main.js';

state.user={role:'admin',email:'audit@qa.invalid'};
state.data.stores=[{id:'store',name:'Tienda QA',active:true}];
state.data.drawers=[{id:'vape',store_id:'store',name:'Vape',active:true},{id:'head',store_id:'store',name:'Head',active:true}];
state.data.closingDrawers=state.data.drawers.map(d=>({closing_id:'closing',drawer_id:d.id,opening_cash:50,closing_cash:75}));
for(const status of ['borrador','cerrado']){
 const html=closingRecordHtml({id:'closing',store_id:'store',business_date:'2026-10-18',status});
 const inputs=[...html.matchAll(/<input\b[^>]*id="dr[^"\s]+"[^>]*>/g)].map(m=>m[0]);
 assert.equal(inputs.length,22,'Se comprueban los diez movimientos y la referencia de ventas de cada caja');
 for(const input of inputs)assert.equal(/\bdisabled\b/.test(input),status==='cerrado',input);
 assert.equal(html.includes('data-action="closing-save-close"'),status==='borrador');
 assert.equal(html.includes('data-action="closing-reopen"'),status==='cerrado');
}
console.log('CLOSED CLOSING QA: 22 campos bloqueados al cerrar y editables en borrador; reapertura explícita.');
