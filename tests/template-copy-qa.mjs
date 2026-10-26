import assert from 'node:assert/strict';
import {templateCopyCode} from '../src/template-copy.js';
for(const length of [1,43,44,45,49,50,80]){
 const code='A'.repeat(length),templates=[{code}];
 for(let n=0;n<15;n++){
  const candidate=templateCopyCode(code,templates);
  assert(candidate.length<=50);assert(!templates.some(t=>t.code===candidate));
  templates.push({code:candidate});
 }
}
assert.equal(templateCopyCode('qa',[{code:'QA-COPIA'}]),'QA-COPIA-2');
console.log('TEMPLATE COPY QA: maximum-length codes, repeated copies and case-insensitive uniqueness');
