import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/pages/main.js',import.meta.url),'utf8');
const start=source.indexOf("{label:'Fiscal / revisión',html:");
const end=source.indexOf("\n  {label:'Total'",start);
assert(start>=0&&end>start,'Existing fiscal column must remain present');
const column=source.slice(start,end).trim().replace(/,\s*$/,'');
const state={data:{documents:[]}};
const render=new Function('state','isExpensePaymentEvidence','expensePaymentRelation','acceptedExpense','isUnreconciledPayment','money','esc','return ('+column+').html')(state,()=>false,()=>null,()=>false,()=>false,x=>Number(x||0).toFixed(2),x=>String(x||''));
const expense={document_id:'doc-one',fiscal_reviewed:false,base_amount:19.99,vat_amount:4.2};
test('unchecked document remains pending cotejo',()=>{state.data.documents=[{id:'doc-one',status:'pendiente'}];assert.match(render(expense),/Revisión fiscal pendiente/)});
test('document cotejo and fiscal review are displayed independently',()=>{state.data.documents=[{id:'doc-one',status:'revisada'}];const html=render(expense);assert.match(html,/Documento cotejado · revisión fiscal pendiente/);assert.doesNotMatch(html,/Pendiente de desglose fiscal y cotejo/)});
test('a different reviewed document cannot mark this expense as cotejado',()=>{state.data.documents=[{id:'other-document',status:'revisada'}];assert.match(render(expense),/Revisión fiscal pendiente/)});
test('fiscally reviewed expenses retain the existing tax amounts',()=>{state.data.documents=[];const html=render({...expense,fiscal_reviewed:true});assert.match(html,/19.99/);assert.match(html,/4.20/);assert.doesNotMatch(html,/pendiente/i)});


test('pending review keeps saved amounts visible without claiming approval',()=>{state.data.documents=[{id:'doc-one',status:'pendiente'}];const html=render(expense);assert.match(html,/Base <b>19.99/);assert.match(html,/IVA <b>4.20/);assert.match(html,/excluido de previsiones/)});
