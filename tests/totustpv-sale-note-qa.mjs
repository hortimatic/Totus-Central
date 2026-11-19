import assert from 'node:assert/strict';
import test from 'node:test';
import {saleNote} from '../src/totustpv/sale-note.js';
test('private sale note preserves plain multilingual text and canonical line endings',()=>{
 assert.equal(saleNote(undefined),undefined);assert.equal(saleNote('  \r\n  '),undefined);
 assert.equal(saleNote('  Entrega el miércoles\r\nLlamar antes\t🙂  '),'Entrega el miércoles\nLlamar antes\t🙂');
 assert.equal(Array.from(saleNote('🙂'.repeat(500))).length,500);
});
test('private sale note rejects markup, controls, malformed values and overlong text',()=>{
 for(const value of [null,{},1,'🙂'.repeat(501),'texto\u0000','texto\u007f','<script>hola</script>','2 > 1','\ud800'])assert.throws(()=>saleNote(value),/TPV_SALE_NOTE_INVALID/);
});
