import {test} from 'node:test';
import assert from 'node:assert/strict';
import {directorySchemaProjection,directoryXmlLanguages,selectedXmlValues,prepareProductStageXml,PRODUCT_WRITE_FIELDS} from '../src/productos-write-contract.js';
test('customer edits preserve credentials and unrelated values only inside server XML',()=>{
 const xml='<prestashop><customer><id>4</id><firstname>Antes</firstname><lastname>Apellido</lastname><passwd><![CDATA[HASH_NO_CAMBIAR]]></passwd><newsletter>1</newsletter><associations><groups><group><id>3</id></group></groups></associations></customer></prestashop>';
 const result=selectedXmlValues(xml,'customers','4',[{field:'firstname',value:'Después'}]);
 assert.equal(result.changes.length,1);assert(!JSON.stringify(result.changes).includes('HASH_NO_CAMBIAR'));
 const patched=prepareProductStageXml(result.patched,'customers',{}, {},'4');assert(patched.includes('HASH_NO_CAMBIAR'));assert(patched.includes('<newsletter>1</newsletter>'));assert(patched.includes('<group><id>3</id></group>'));assert.equal(PRODUCT_WRITE_FIELDS.customers,undefined);
 assert.throws(()=>selectedXmlValues(xml,'customers','5',[{field:'firstname',value:'Después'}]));
});
test('schema projection omits native readonly fields and preserves native associations',()=>{
 const schema='<prestashop><customer><id></id><firstname></firstname><passwd></passwd><secure_key readOnly="true"></secure_key><last_passwd_gen readOnly="true"></last_passwd_gen><associations><groups><group><id></id></group></groups></associations></customer></prestashop>';
 assert.equal(directorySchemaProjection(schema,'customers'),'[id,firstname,passwd,groups[id]]');
 assert.throws(()=>directorySchemaProjection(schema,'products'));
 assert.throws(()=>directorySchemaProjection('<!DOCTYPE x><prestashop><customer><id/></customer></prestashop>','customers'));
});
test('localized directory updates retain the other shop languages',()=>{
 const xml='<prestashop><product_option><id>2</id><name><language id="1">Color</language><language id="2">Colour</language></name><public_name><language id="1">Color</language><language id="2">Colour</language></public_name></product_option></prestashop>';
 assert.deepEqual(directoryXmlLanguages(xml,'product_options','name'),['1','2']);
 const changed=prepareProductStageXml(xml,'product_options',{name:[{language_id:'1',value:'Acabado'}]}, {},'2');
 assert(changed.includes('<language id="2">Colour</language>'));assert(changed.includes('Acabado'));
});
