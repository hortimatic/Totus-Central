import test from 'node:test';
import assert from 'node:assert/strict';
import {productHasUnpublishedChanges as dirty} from '../src/productos-drafts.js';
const record={id:'42',name:'Producto',price:'10',reference:'REF'};
test('read, field/variant selection and empty quick edit do not block navigation',()=>{
 assert.equal(dirty({record}),false);
 assert.equal(dirty({record,fields:new Set(['name']),variantFields:new Map([['5',new Set(['price'])]]),tableEdits:new Map([['shop|42',{values:{},request:null}]])}),false);
 assert.equal(dirty({record,overrides:{name:'Producto'}}),false);
});
test('actual edits, new product and unconfirmed writes remain protected',()=>{
 assert.equal(dirty({record,overrides:{name:'Otro'}}),true);
 assert.equal(dirty({record:{id:null,name:'Nuevo',reference:'NEW'}}),true);
 assert.equal(dirty({record,tableEdits:new Map([['s|42',{values:{},request:{request_id:'own'}}]])}),true);
 assert.equal(dirty({record,variants:[{id:'5',price:'1'}],variantOverrides:new Map([['5',{price:'2'}]])}),true);
 assert.equal(dirty({record,wizard:{stages:[['s',{rows:[{done:false}]}]]}}),true);
});
test('verified copy can leave without losing history; new invalidated edit warns',()=>{
 const targetRaw=new Map([['destination',{id:'99',__copyCompleted:true}]]);
 assert.equal(dirty({record,mode:'comparar',targetRaw,overrides:{name:'Adaptado'}}),false);
 assert.equal(dirty({record,mode:'comparar',targetRaw,targets:new Set(['destination','pending']),overrides:{name:'Adaptado'}}),true,'An unfinished second destination remains protected');
 delete targetRaw.get('destination').__copyCompleted;
 assert.equal(dirty({record,mode:'comparar',targetRaw,overrides:{name:'Adaptado'}}),true);
 assert.equal(dirty({record,wizard:{stages:[['s',{rows:[{done:true}]}]]}}),false);
});
