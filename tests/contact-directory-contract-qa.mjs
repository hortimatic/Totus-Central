import assert from 'node:assert/strict';
import {test} from 'node:test';
import {directoryQuery,directoryMutation,directoryRows} from '../src/contact-directory-contract.js';
const uuid='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const identity={id:uuid,call_id:uuid,revision:1,store:'hortimatic',kind:'clientes'};
test('directory permits bounded complete customer paging without arbitrary URLs, fields or SQL',()=>{
 const q={...identity,action:'prestashop_directory_read',resource:'customers',page:1,page_size:100};assert.equal(directoryQuery(q).page,1);
 for(const extra of [{url:'https://other.invalid'},{fields:'passwd'},{page:1001},{page_size:101}])assert.throws(()=>directoryQuery({...q,...extra}));
 assert.throws(()=>directoryQuery({...q,kind:'marcas'}));assert.throws(()=>directoryQuery({...q,resource:'addresses'}));
 assert.deepEqual(directoryQuery({...q,resource:'addresses',customer_ids:['41']}).customer_ids,['41']);
 assert.throws(()=>directoryQuery({...q,resource:'orders'}));assert.throws(()=>directoryQuery({...q,kind:'marcas',resource:'addresses',customer_ids:['41'],manufacturer_id:'2'}));
});
test('customer fields are editable but passwords and session secrets can neither be read nor sent',()=>{
 const q={...identity,action:'prestashop_directory_prepare',resource:'customers',operation:'update',record_id:'1',request_id:uuid,fields:{firstname:'Diego',email:'test@example.invalid',active:'1'}};
 assert.equal(directoryMutation(q).fields.firstname,'Diego');
 for(const field of ['passwd','secure_key','reset_password_token','date_add'])assert.throws(()=>directoryMutation({...q,fields:{[field]:'secret'}}));
 const rows=directoryRows({customers:[{id:1,firstname:'Diego',passwd:'do-not-leak',secure_key:'never',reset_password_token:'token'}]},'customers',20);
 assert.deepEqual(rows,[{id:'1',firstname:'Diego'}]);
 assert.throws(()=>directoryMutation({...q,action:'prestashop_directory_commit',confirmed:true,fingerprint:'wrong'}));
 assert.throws(()=>directoryMutation({...q,fields:{birthday:'2026-02-30'}}));
 assert.equal(directoryMutation({...q,fields:{birthday:'2024-02-29'}}).fields.birthday,'2024-02-29');
 assert.throws(()=>directoryMutation({...q,fields:{firstname:'a'.repeat(256)}}));
 assert.equal(directoryMutation({...q,fields:{firstname:'é'.repeat(255)}}).fields.firstname.length,255);
});
test('writes validate names, identifiers, fields and required data before any transport',()=>{
 const q={...identity,kind:'atributos',action:'prestashop_directory_prepare',resource:'product_option_values',operation:'create',request_id:uuid,fields:{name:'Azul',id_attribute_group:'2',color:'#0000ff'}};
 assert.equal(directoryMutation(q).fields.name,'Azul');assert.throws(()=>directoryMutation({...q,fields:{name:'Azul'}}));assert.throws(()=>directoryMutation({...q,fields:{...q.fields,id_attribute_group:'1|2'}}));
 assert.throws(()=>directoryMutation({...q,operation:'delete',record_id:'2'}));
 assert.throws(()=>directoryMutation({...q,fields:{...q.fields,name:'a'.repeat(129)}}));
 assert.throws(()=>directoryMutation({...q,kind:'marcas',resource:'manufacturers',fields:{name:'a'.repeat(65)}}));
 assert.throws(()=>directoryMutation({...q,kind:'marcas',resource:'manufacturers',fields:{name:'Marca#incorrecta'}}));
 assert.equal(directoryMutation({...q,kind:'proveedores',resource:'suppliers',fields:{name:'Proveedor válido'}}).fields.name,'Proveedor válido');
 assert.throws(()=>directoryMutation({...q,kind:'proveedores',resource:'addresses',fields:{id_customer:'5'}}));
 assert.throws(()=>directoryMutation({...q,kind:'clientes',resource:'addresses',operation:'update',record_id:'2',fields:{alias:'a'.repeat(33)}}));
});
test('directory drops unknown data and retains only typed native associations and languages',()=>{
 assert.deepEqual(directoryRows({manufacturers:[{id:'1',name:'Marca',meta_title:[{id:'1',value:'Título'}],extra:{secret:true}}]},'manufacturers',20),[{id:'1',name:'Marca',meta_title:[{id:'1',value:'Título'}]}]);
 assert.throws(()=>directoryRows({customers:[{id:'1'},{id:'1'}]},'customers',20));
 assert.throws(()=>directoryRows({products:[{id:'1',associations:{combinations:[{id:'unsafe'}]}}]},'products',20));
});
