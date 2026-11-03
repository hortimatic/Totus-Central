import test from 'node:test';
import assert from 'node:assert/strict';
import {csvCell,csv} from '../src/utils.js';
import {reportCsv} from '../src/agent-delivery.js';

test('all CSV paths guard formulas after whitespace and control characters',async()=>{
 for(const prefix of ['','  ','\t','\r\n','\u0000','\u001f','\u00a0']){
  for(const formula of ['=1+1','+CMD','-1+1','@SUM(1)']){
   const input=prefix+formula,expected='"\''+input+'"';
   assert.equal(csvCell(input),expected);
   assert(csv([{value:input}],[{label:'Value',get:r=>r.value}]).endsWith(expected));
   const output=await reportCsv({from:'2026-01-01',to:'2026-01-02',store:input}).text();
   assert(output.includes('"Tienda";'+expected));
  }
 }
});
test('numbers remain numbers and literal contents retain quotes, newlines and accents',()=>{
 assert.equal(csvCell(-44.5),'"-44.5"');
 assert.equal(csvCell(-44.5,{decimalComma:true}),'"-44,5"');
 assert.equal(csvCell('Texto "útil";\nsegunda línea'),'"Texto ""útil"";\nsegunda línea"');
 assert.equal(csvCell(null),'""');
});
