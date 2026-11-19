import test from 'node:test';import assert from 'node:assert/strict';
import {receiptHtml,receiptLinePresentation} from '../src/totustpv/documents.js';
import {receiptOptions,receiptOptionsFromForm} from '../src/totustpv/receipt-options.js';
const line={name:'Nombre nativo completo (Rojo)',base_name:'Producto (edición especial)',variant_name:'Color: Rojo · Talla: M',reference:'QA',quantity:1,line_cents:1000};
const document={existing_document:true,kind:'receipt',currency:'EUR',reference:'QA-1',created_at:'2026-11-18 12:00:00',merchant:{name:'Tienda ficticia'},lines:[line],payments:{cash:1000},total_cents:1000};
test('typed historical fields display or hide attributes without parsing a native title',()=>{
 assert.equal(receiptOptions().showAttributes,true);assert.equal(receiptOptionsFromForm(new Map()).showAttributes,false);
 const visible=receiptHtml(document);assert.match(visible,/Producto \(edición especial\)/);assert.match(visible,/Variante: Color: Rojo/);
 const hidden=receiptHtml(document,{showAttributes:false});assert.match(hidden,/Producto \(edición especial\)/);assert.doesNotMatch(hidden,/Color: Rojo|Nombre nativo completo/);
 assert.match(receiptHtml({...document,kind:'gift'}),/Color: Rojo/);assert.doesNotMatch(receiptHtml({...document,kind:'gift'}),/€/);
});
test('legacy or malformed snapshots retain the whole original title and escape native text',()=>{
 for(const patch of [{base_name:undefined},{variant_name:undefined},{base_name:''},{variant_name:'x\n'},{base_name:'x'.repeat(513)}])assert.deepEqual(receiptLinePresentation({...line,...patch},false),{name:line.name,variant:''});
 assert.match(receiptHtml({...document,lines:[{...line,base_name:'<producto>',variant_name:'<rojo>'}]}),/&lt;producto&gt;/);
 assert.doesNotMatch(receiptHtml({...document,lines:[{...line,base_name:'<producto>',variant_name:'<rojo>'}]}),/<producto>|<rojo>/);
});
