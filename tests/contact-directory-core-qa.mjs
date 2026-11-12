import {test} from 'node:test';import assert from 'node:assert/strict';
import {directoryLayout,directoryPage,directoryDiff,DIRECTORY_COLUMNS,joinDirectoryAddresses} from '../src/contact-directory-core.js';
test('directory tables search the entire loaded directory independently of page size',()=>{
 const rows=Array.from({length:137},(_,i)=>({id:String(i+1),firstname:i===136?'Álvaro':'Cliente '+i,active:i%2?'0':'1'})),layout=directoryLayout('clientes');
 assert.equal(directoryPage(rows,{layout}).rows.length,20);const found=directoryPage(rows,{layout,search:'alvaro'});assert.equal(found.total,1);assert.equal(found.rows[0].id,'137');
 assert.equal(directoryPage(rows,{layout:directoryLayout('clientes',{pageSize:50}),page:3}).rows.length,37);assert.equal(directoryPage(rows,{layout:directoryLayout('clientes',{pageSize:0})}).rows.length,137);
 assert.equal(directoryPage(rows,{layout,page:999}).page,7);
});
test('column layouts keep only supported fields and valid durable widths',()=>{
 for(const kind of Object.keys(DIRECTORY_COLUMNS)){const l=directoryLayout(kind,{columns:['passwd','email','id','id'],widths:{email:240,id:1,passwd:200},pageSize:999});assert(l.columns.includes('id'));assert(!l.columns.includes('passwd'));assert.equal(l.widths.passwd,undefined);assert.equal(l.widths.id,undefined);assert.equal(l.pageSize,20);}
});
test('editing a visible field does not include credentials, timestamps or unedited translations',()=>{
 assert.deepEqual(directoryDiff('customers',{firstname:'Antes',email:'igual@example.invalid'},{firstname:'Después',email:'igual@example.invalid',passwd:'not-accepted',date_upd:'fake'}),{firstname:'Después'});
 assert.deepEqual(directoryDiff('product_options',{name:[{id:'1',value:'Color'},{id:'2',value:'Colour'}]},{name:'Color'},'1'),{});
});
test('contact columns use active addresses without losing archived addresses or parent identity',()=>{
 const rows=[{id:'1',firstname:'Persona'},{id:'2',firstname:'Otra'}],addresses=[{id:'10',id_customer:'1',deleted:'1',phone:'antiguo'},{id:'11',id_customer:'1',deleted:'0',phone:'600123123',id_country:'6',id_state:'7',alias:'Principal'}];
 const joined=joinDirectoryAddresses('clientes',rows,addresses,{countries:[{id:'6',name:[{id:'2',value:'España'}]}],states:[{id:'7',name:'Madrid'}],languageId:'2'});
 assert.equal(joined[0].phone,'600123123');assert.equal(joined[0].country,'España');assert.equal(joined[0].province,'Madrid');assert.equal(joined[0].__addresses.length,2);assert.equal(joined[1].phone,'');assert.equal(rows[0].phone,undefined);
 assert.throws(()=>joinDirectoryAddresses('clientes',rows,[{id:'1',id_customer:'99'}]));
});
