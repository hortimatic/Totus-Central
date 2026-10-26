import assert from 'node:assert/strict';
import {createBusinessWriter} from '../src/business-write.js';
const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const root=()=>{const input={id:'amount',value:'100',type:'text',checked:false};return {input,querySelectorAll:()=>[input]};};
const args={p_expense:{supplier_name:'QA'},p_lines:[{base_amount:100}]};
for(const lose of [0,1,2]){
 const form=root(),keys=[];let attempts=0,commits=0;const saved=new Map();
 const writer=createBusinessWriter({rpc:async(name,a)=>{
  if(name==='totus_business_write_contract')return {request_replay:1};
  const key=a.p_expense.request_id;keys.push(key);attempts++;
  if(!saved.has(key)){saved.set(key,id);commits++;}
  if(attempts<=lose)throw new Error('Lost response after commit');
  return saved.get(key);
 }});
 if(lose===2){
  await assert.rejects(writer.execute(form,'totus_save_expense',args,'p_expense'),e=>e.outcomeUnknown===true);
  form.input.value='200';await assert.rejects(writer.resume(form),/has cambiado/);assert.equal(attempts,2);
  form.input.value='100';assert.equal((await writer.resume(form)).id,id);
 }else assert.equal(await writer.execute(form,'totus_save_expense',args,'p_expense'),id);
 assert.equal(commits,1);assert.equal(new Set(keys).size,1);assert.equal(await writer.resume(form),null);
}
let writes=0;
const old=createBusinessWriter({rpc:async()=>({request_replay:0})});
await assert.rejects(old.execute(root(),'totus_save_expense',args,'p_expense'),e=>e.confirmedRejected===true);
const rejected=createBusinessWriter({rpc:async(name)=>{if(name==='totus_business_write_contract')return {request_replay:1};writes++;const e=new Error('Denied');e.confirmedRejected=true;throw e;}});
const form=root();await assert.rejects(rejected.execute(form,'totus_save_expense',args,'p_expense'),/Denied/);assert.equal(writes,1);assert.equal(await rejected.resume(form),null);
console.log('BUSINESS WRITE QA: lost replies replay one request, uncertain form retained, altered retry refused, confirmed rejection not retried and legacy contract blocked');
