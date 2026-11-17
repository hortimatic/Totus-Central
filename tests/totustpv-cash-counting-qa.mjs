import test from 'node:test';
import assert from 'node:assert/strict';
import {EURO_CASH_FACES,cashOptions,cashOptionsFromForm,cashCountTotal,cashCountHtml} from '../src/totustpv/cash-counting.js';
test('cash counting adds physical units in integer cents including one-cent coins',()=>{
 assert.equal(cashCountTotal({'2000':'2','500':'1','100':'3','1':'7'}),4807);
 assert.equal(cashCountTotal({'1':'00002','2':''}),2);
 assert.equal(cashCountTotal({}),0);
 for(const counts of [{'3':'1'},{'2000':'-1'},{'2000':'1.5'},{'2000':'1e3'},{'2000':'1000001'},{'50000':'20000'},null,[]])assert.throws(()=>cashCountTotal(counts));
});
test('cash options preserve a valid configured set, sort by value and reject malformed saved form choices',()=>{
 assert.deepEqual(cashOptions(null).denominations,EURO_CASH_FACES);
 assert.deepEqual(cashOptions({denominations:[1,2000,500]}).denominations,[2000,500,1]);
 assert.deepEqual(cashOptionsFromForm(new Map([['cashDenominations',['1','500','2000']]])).denominations,[2000,500,1]);
 assert.deepEqual(cashOptionsFromForm({get:()=>null,getAll:()=>['100','20']}).denominations,[100,20]);
 for(const value of [[],['300'],['0'],['500','500']])assert.throws(()=>cashOptionsFromForm(new Map([['cashDenominations',value]])));
});
test('cash form aid is limited to known targets and escapes retained invalid counts',()=>{
 const html=cashCountHtml('counted',{denominations:[2000,1]},{countedCoin2000:'2',countedCoin1:'7'});
 assert.match(html,/40,07/);assert.match(html,/name="countedCoin2000"/);
 assert.throws(()=>cashCountHtml('untrusted',null));
 assert.equal(cashCountHtml('received',{denominations:[1]},{receivedCoin1:'"><script>'}).includes('<script>'),false);
});
