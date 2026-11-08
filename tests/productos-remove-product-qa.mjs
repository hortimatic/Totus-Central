import test from 'node:test';
import assert from 'node:assert/strict';
import {runWholeProductRemoval} from '../supabase/functions/totus-connections/prestashop-product-remove.js';
import {validateProductStage} from '../src/productos-stages-contract.js';
const base={action:'prestashop_product_step_prepare',id:'11111111-1111-4111-8111-111111111111',call_id:'22222222-2222-4222-8222-222222222222',revision:1,store:'hortimatic',parent_request_id:'33333333-3333-4333-8333-333333333333',product_id:'42',record_id:'42',existing_product:true,kind:'remove_product',step_key:'remove42',fields:{}};
test('whole product DELETE is explicit, fingerprinted, checked absent and never repeated',async()=>{
 const op=validateProductStage(base);assert.throws(()=>validateProductStage({...base,record_id:'99'}),/mismo producto/);let present=true,deleted=0,prior=null;
 const services={env:{get:()=> '1'},xml:async path=>{if(!path)return '<prestashop><api><products get="true" delete="true"/></api></prestashop>';if(!present)throw Error('PrestaShop rechazó products/42 (HTTP 404).');return '<prestashop><product><id>42</id><reference>QA</reference><active>0</active></product></prestashop>';},call:async(path,opts)=>{assert.equal(path,'products/42');assert.equal(opts.method,'DELETE');deleted++;present=false;throw Error('Respuesta perdida');},journal:{lookup:async()=>prior,claim:async(_op,signature)=>{prior={signature,status:'pending'};return {status:'claimed'};},complete:async()=>prior.status='completed',uncertain:async()=>prior.status='uncertain'}};
 const prepared=await runWholeProductRemoval(op,services);assert.equal(prepared.can_commit,true);assert.equal(deleted,0);const commit={...op,commit:true,expected_fingerprint:prepared.fingerprint};const result=await runWholeProductRemoval(commit,services);assert.equal(result.deleted,true);assert.equal(result.reconciled,true);assert.equal((await runWholeProductRemoval(commit,services)).reused,true);assert.equal(deleted,1);
});
test('read failure or missing DELETE permission cannot become a successful deletion',async()=>{
 const op=validateProductStage(base);await assert.rejects(()=>runWholeProductRemoval(op,{xml:async()=>{throw Error('(HTTP 403)');},journal:null}),/403/);
 const services={env:{get:()=> '1'},xml:async path=>path?'<prestashop><product><id>42</id></product></prestashop>':'<prestashop><api><products get="true" delete="false"/></api></prestashop>'};assert.equal((await runWholeProductRemoval(op,services)).can_commit,false);
});
