import test from 'node:test';
import assert from 'node:assert/strict';
import {lineName} from '../src/totustpv/line-name.js';
test('temporary item names are canonical plain Unicode, with an empty value restoring the original',()=>{
 assert.equal(lineName(undefined),undefined);assert.equal(lineName('  '),undefined);
 assert.equal(lineName('  Kit de regalo · azul 🙂  '),'Kit de regalo · azul 🙂');assert.equal(lineName('0'),'0');
 assert.equal(Array.from(lineName('🙂'.repeat(255))).length,255);
});
test('temporary item names reject non-text, native-forbidden symbols, controls and overlong strings',()=>{
 for(const value of [null,{},1,true,'🙂'.repeat(256),'<img>','Kit = 2','{kit}','texto\n','texto\u0000','\ud800'])assert.throws(()=>lineName(value),/TPV_LINE_NAME_INVALID/);
});
