import test from 'node:test';
import assert from 'node:assert/strict';
import {productIntakeDraft,productIntakePrice,productIntakeDecimal,productIntakeBase,productIntakePlan,productIntakeStage,productIntakeTaxPrice} from '../src/totustpv/product-intake-contract.js';
import {validateProductCreateRequest} from '../src/productos-write-contract.js';
import {validateProductStage} from '../src/productos-stages-contract.js';
const id='00000000-0000-4000-8000-000000000001';
const base=()=>({name:'Artículo de prueba',reference:'PRUEBA-001',price:'12,50',cost:'6.123456',categoryId:'2',quantity:4});
const context={id,call_id:id,revision:1,store:'hortimatic-2'};
test('gross/net editing preserves six decimals, a supplied real rate and a single rounding',()=>{
 assert.equal(productIntakeTaxPrice('10.000001','21'),'12.100001');
 assert.equal(productIntakeTaxPrice('15,13','21',{toNet:true}),'12.504132');
 assert.equal(productIntakeTaxPrice('10','7.5'),'10.750000');
 assert.equal(productIntakeTaxPrice('10.750000','7.5',{toNet:true}),'10.000000');
 assert.equal(productIntakeTaxPrice('0','0'),'0.000000');
 for(const rate of ['-1','101','NaN'])assert.throws(()=>productIntakeTaxPrice('10',rate));
 assert.throws(()=>productIntakeTaxPrice('999999999','100'));
});
test('quick product prices keep exact six-decimal arithmetic and reject excessive or negative inputs',()=>{
 assert.equal(productIntakePrice('0012,500001'),12500001n);assert.equal(productIntakeDecimal(-12500001n),'-12.500001');
 for(const input of ['-1','1e3','NaN','1.0000001','1000000000',12.5])assert.throws(()=>productIntakePrice(input));
 const draft=productIntakeDraft(base());assert.equal(draft.price,'12.500000');assert.equal(draft.cost,'6.123456');
});
test('quick product creation uses the existing validated native base contract and stays unpublished during setup',()=>{
 const draft=productIntakeDraft({...base(),description:'Texto <sin HTML>\nSegunda línea',manufacturerId:'3',supplierId:'4',taxRulesGroupId:'5'}),payload=productIntakeBase(draft,['1','2']);
 const normalized=validateProductCreateRequest({...context,action:'prestashop_product_create_prepare',...payload});
 assert.equal(normalized.price,'12.500000');assert.equal(normalized.translations[0].description,'<p>Texto &lt;sin HTML&gt;<br>Segunda línea</p>');
 assert.deepEqual(normalized.translations.map(row=>row.language_id),['1','2']);
 assert.equal(normalized.fields.find(row=>row.field==='visibility').value,'none');assert.equal(normalized.fields.find(row=>row.field==='available_for_order').value,'0');
 assert.deepEqual(normalized.relations,{manufacturer_id:'3',supplier_id:'4',tax_rules_group_id:'5',category_ids:['2']});
});
test('variants preserve explicit final prices and derive signed native impacts without floating-point rounding',()=>{
 const draft=productIntakeDraft({...base(),quantity:0,supplierId:'4',variants:[{attributeValueIds:['2','1'],price:'10.000001',quantity:3},{reference:'PRUEBA-OTRA',attributeValueIds:['3','1'],price:'15.750002',cost:'8',quantity:7}]});
 assert.equal(draft.variants[0].reference,'PRUEBA-001-1');assert.deepEqual(draft.variants[0].attributeValueIds,['1','2']);
 const plan=productIntakePlan(draft);assert.deepEqual(plan.map(row=>row.kind),['base','variation','variation','stock','stock','supplier_price','supplier_price','supplier_price','finish']);
 for(const [index,expected] of [[0,'-2.499999'],[1,'3.250002']]){
  const stage=productIntakeStage(draft,plan.find(row=>row.key==='variant-'+index),[],'1');assert.equal(stage.fields.price,expected);
  assert.equal(validateProductStage({...context,action:'prestashop_product_step_prepare',parent_request_id:id,product_id:'101',...stage}).kind,'variation');
 }
 const verified=[{key:'variant-0',status:'verified',recordId:'201'},{key:'variant-1',status:'verified',recordId:'202'}];
 const stock=productIntakeStage(draft,plan.find(row=>row.key==='stock-1'),verified,'1');assert.equal(stock.fields.id_product_attribute,'202');assert.equal(stock.fields.quantity,'7');
 const finish=productIntakeStage(draft,plan.at(-1),verified,'1');assert.equal(finish.fields.id_default_combination,'201');assert.equal(finish.fields.visibility,'none');assert.equal(finish.fields.active,'1');
 assert.throws(()=>productIntakeStage(draft,plan.find(row=>row.key==='stock-0'),[],'1'),/verificado/);
});
test('creation rejects forged scope, invalid relationships, duplicate combinations and ambiguous quantities before a write',()=>{
 for(const change of [{actorId:id},{shopId:2},{categoryId:0},{quantity:1.2},{quantity:-1},{visibility:'search'},{name:'<script>'},{ean13:'ABC'},{supplierReference:'SIN-PROVEEDOR'},
  {variants:[{attributeValueIds:['1'],quantity:1}]},
  {quantity:0,variants:[{attributeValueIds:['1','1']}]},
  {quantity:0,variants:[{attributeValueIds:['1','2']},{attributeValueIds:['2','1']}]},
  {quantity:0,variants:[{reference:'PRUEBA-001',attributeValueIds:['1']}]},
  {quantity:0,variants:[{attributeValueIds:['1'],imageIndexes:[0]}]}])assert.throws(()=>productIntakeDraft({...base(),...change}));
 assert.throws(()=>productIntakeBase(productIntakeDraft(base()),['1','1']),/idiomas/);
});
test('simple product stock and supplier stages are native validated steps, with availability last',()=>{
 const draft=productIntakeDraft({...base(),supplierId:'7',supplierReference:'PROV-001',visibility:'both'}),plan=productIntakePlan(draft);
 assert.deepEqual(plan.map(row=>row.kind),['base','stock','supplier_price','finish']);
 for(const step of plan.slice(1)){
  const stage=productIntakeStage(draft,step,[],'2');validateProductStage({...context,action:'prestashop_product_step_prepare',parent_request_id:id,product_id:'101',...stage});
  if(step.kind==='supplier_price'){assert.equal(stage.fields.product_supplier_reference,'PROV-001');assert.equal(stage.fields.product_supplier_price_te,'6.123456');}
 }
});
