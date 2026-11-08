import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptStoreText} from '../src/productos-copy-text.js';
test('copy adapts store branding and domains in both directions without changing product identifiers',()=>{
 assert.equal(adaptStoreText('HORTIMATIC · Compra en hortimatic.com. Ref HORTI-42','hortimatic','newoldsmok'),'NewOldSmok · Compra en newoldsmok.com. Ref HORTI-42');
 assert.equal(adaptStoreText('NewOldSmok / NEW OLD SMOK / new-old-smok · newoldsmok.com','newoldsmok','hortimatic'),'Hortimatic / Hortimatic / Hortimatic · hortimatic.com');
 assert.equal(adaptStoreText('kit-hortimatic-42','hortimatic','newoldsmok',{slug:true}),'kit-newoldsmok-42');
 assert.equal(adaptStoreText('kit-new-old-smok-42','newoldsmok','hortimatic',{slug:true}),'kit-hortimatic-42');
 assert.equal(adaptStoreText('myhortimaticvariant','hortimatic','newoldsmok'),'myhortimaticvariant');
 assert.equal(adaptStoreText('Hortimatic','hortimatic','hortimatic'),'Hortimatic');
 assert.throws(()=>adaptStoreText('x','unknown','hortimatic'));
});
