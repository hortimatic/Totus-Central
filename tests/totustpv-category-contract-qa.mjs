import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryCreationDraft,categoryCreateRequest} from '../src/category-create-contract.js';
import {directoryMutation} from '../src/contact-directory-contract.js';
import {directoryBlankXml,prepareProductStageXml,directoryXmlField,directoryXmlLanguages,selectedXmlValues} from '../src/productos-write-contract.js';
const id='00000000-0000-4000-8000-000000000001',context={action:'prestashop_directory_prepare',id,call_id:id,request_id:id,revision:6,store:'qa-shop'};
test('category create request derives native shop, slug, active flag and non-root category from a minimal ordinary form',()=>{
 const q=categoryCreateRequest({...context,payload:{name:'  Camisas y algodón  ',parentId:'2'}},3);
 assert.deepEqual(q.fields,{name:'Camisas y algodón',id_parent:'2',link_rewrite:'camisas-y-algodon',active:'1',is_root_category:'0',id_shop_default:'3'});
 for(const injected of [{shopId:1},{active:false},{is_root_category:true},{id_shop_default:'all'}])assert.throws(()=>categoryCreationDraft({name:'Camisas',parentId:'2',...injected}));
 for(const name of ['', 'x'.repeat(129),'<script>','A;B','A#B','A=B'])assert.throws(()=>categoryCreationDraft({name,parentId:'2'}));
 assert.throws(()=>categoryCreateRequest({...context,payload:{name:'Camisas',parentId:'2'}},0));
});
test('category XML uses the shared native directory serializer with complete supplied translations',()=>{
 const xml=prepareProductStageXml(directoryBlankXml('categories'),'categories',{id_parent:'2',active:'1',is_root_category:'0',id_shop_default:'3',
  name:[{language_id:'1',value:'Camisas & algodón'},{language_id:'2',value:'Camisas & algodón'}],link_rewrite:[{language_id:'1',value:'camisas'},{language_id:'2',value:'camisas'}]},{});
 assert.deepEqual(directoryXmlLanguages(xml,'categories','name'),['1','2']);const read=xml.replace('<id></id>','<id>7</id>');
 assert.equal(directoryXmlField(read,'categories','id'),'7');
 assert.equal(selectedXmlValues(read,'categories','7',[{field:'name',language_id:'1',value:'Camisas & algodón'}]).changes[0].before,'Camisas & algodón');
});
test('the general public directory mutation contract does not gain category writes or deletion',()=>{
 assert.throws(()=>directoryMutation({...context,kind:'categorias',resource:'categories',operation:'create',fields:{name:'Camisas'}}),/no permitido/);
 assert.throws(()=>categoryCreateRequest({...context,action:'prestashop_directory_delete',payload:{name:'Camisas',parentId:'2'}},1));
 assert.throws(()=>categoryCreateRequest({...context,action:'prestashop_directory_commit',payload:{name:'Camisas',parentId:'2'},fingerprint:'a'.repeat(64)},1));
});
