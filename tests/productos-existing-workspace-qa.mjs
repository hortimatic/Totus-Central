import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductWizard} from '../src/productos-create-ui.js';

test('existing product stages keep identity, defaults and installed translations without another base creation',async()=>{
 const calls=[],source={id:'42',reference:'REAL-42',active:'1',available_for_order:'1',visibility:'both',id_default_combination:'300',
  name:[{id:'1',value:'Nombre español'},{id:'2',value:'Other language'}],
  description:[{id:'1',value:'Descripción española'},{id:'2',value:'Original other description'}],
  description_short:[{id:'1',value:'Resumen español'},{id:'2',value:'Original summary'}],
  associations:{combinations:[{id:'300'}],images:[{id:'90'}]}};
 const plan={store:'hortimatic',operation:'update',target_id:'42',changes:[],variants:[]};
 const invoke=async(store,action,args)=>{
  calls.push({store,action,args});
  if(action==='prestashop_product_create_profile')return {persisted:false,language_ids:['1','2']};
  if(action==='prestashop_product_step_prepare')return {persisted:false,fingerprint:'a'.repeat(64),can_commit:true};
  throw Error('Unexpected write or base creation: '+action);
 };
 const wizard=createProductWizard({invoke,canEdit:()=>true});
 await wizard.openExisting('hortimatic',source);
 await wizard.perform('create-stage-tab','hortimatic',plan,source,{tab:'variation'});
 await wizard.perform('create-stage-add','hortimatic',plan,source,{kind:'variation'});
 let html=wizard.render(plan,source),id=html.match(/data-pr-stage-row="([a-f0-9]+)"/)[1];
 wizard.handleChange({dataset:{prStageRow:id,prStageField:'reference'},value:'NEW-VARIANT'});
 await wizard.perform('create-stage-prepare','hortimatic',plan,source,{row:id});
 const variation=calls.at(-1).args;
 assert.equal(variation.existing_product,true);
 assert.equal(variation.product_id,'42');
 assert.equal(variation.fields.default_on,'0','Adding a variant must preserve the original default');
 const parent=variation.parent_request_id;
 const saved=structuredClone(wizard.snapshot());
 const restored=createProductWizard({invoke,canEdit:()=>true});restored.restore(saved);
 await restored.perform('create-stage-tab','hortimatic',plan,source,{tab:'finish'});
 await restored.perform('create-stage-add','hortimatic',plan,source,{kind:'finish'});
 html=restored.render(plan,source);id=html.match(/data-pr-stage-row="([a-f0-9]+)"/)[1];
 await restored.perform('create-stage-prepare','hortimatic',plan,source,{row:id});
 const finish=calls.at(-1).args;
 assert.equal(finish.parent_request_id,parent);
 assert.equal(finish.fields.active,'1');assert.equal(finish.fields.available_for_order,'1');
 assert.equal(finish.fields.id_default_combination,'300');
 assert.deepEqual(finish.fields.description,[{language_id:'1',value:'Descripción española'},{language_id:'2',value:'Original other description'}]);
 assert(!calls.some(c=>c.action==='prestashop_product_create_prepare'||c.action==='prestashop_product_create_commit'));
});

test('cover/default choices are owned, explicit, resumable review steps and do not publish by themselves',async()=>{
 const calls=[],source={id:'42',reference:'REAL-42',active:'0',available_for_order:'0',visibility:'none',id_default_combination:'300',description:'Original',description_short:'Original summary',associations:{images:[{id:'90'},{id:'91'}],combinations:[{id:'300'},{id:'301'}]}};
 const plan={store:'hortimatic',operation:'update',target_id:'42',changes:[],variants:[]};
 const wizard=createProductWizard({canEdit:()=>true,invoke:async(store,action,args)=>{
  calls.push({action,args});
  if(action==='prestashop_product_create_profile')return {persisted:false,language_ids:['1']};
  if(action==='prestashop_product_step_prepare')return {persisted:false,fingerprint:'a'.repeat(64),can_commit:true};
  throw Error('No write is authorised by selecting a cover');
 }});
 await wizard.openExisting('hortimatic',source);
 await wizard.perform('create-stage-tab','hortimatic',plan,source,{tab:'finish'});
 await assert.rejects(()=>wizard.perform('create-stage-add','hortimatic',plan,source,{kind:'finish',finishFields:{id_default_image:'999'}}),/no pertenece/);
 await wizard.perform('create-stage-add','hortimatic',plan,source,{kind:'finish',finishFields:{id_default_image:'91'}});
 await wizard.perform('create-stage-add','hortimatic',plan,source,{kind:'finish',finishFields:{id_default_combination:'301'}});
 const html=wizard.render(plan,source),ids=[...new Set([...html.matchAll(/data-pr-stage-row="([a-f0-9]+)"/g)].map(m=>m[1]))];
 assert.equal(ids.length,1,'Changes share the unsubmitted review instead of creating duplicate writes');
 await wizard.perform('create-stage-prepare','hortimatic',plan,source,{row:ids[0]});
 const args=calls.at(-1).args;
 assert.equal(args.fields.id_default_image,'91');assert.equal(args.fields.id_default_combination,'301');
 assert.equal(args.fields.active,'0');assert.equal(args.fields.available_for_order,'0');
 assert.equal(args.existing_product,true);
 assert(!calls.some(c=>c.action.endsWith('_commit')));
});
