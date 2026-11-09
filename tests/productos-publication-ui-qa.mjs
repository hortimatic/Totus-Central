import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductStagesUI} from '../src/productos-stages-ui.js';
function fixture(){
 const calls=[],result={record_id:'42',request_id:crypto.randomUUID(),existing_product:true},source={id:'42',available_for_order:'0',associations:{images:[],combinations:[{id:'7'}]}},plan={variants:[]},profile={language_ids:['1']};let fail=false;
 const ui=createProductStagesUI({canEdit:()=>true,invoke:async(shop,action,args)=>{calls.push({action,...args});if(action.endsWith('_prepare'))return {persisted:false,can_commit:true,fingerprint:'a'.repeat(64)};if(fail&&args.kind==='variation'){fail=false;throw Error('Fallo de conexión');}return {persisted:true,verified:true,record_id:args.kind==='image'?'92':args.kind==='variation'?'8':args.kind==='variation_edit'?'7':'42'};}});
 const run=(action,detail={})=>ui.perform(action,'hortimatic',result,plan,source,profile,{},detail);
 const state=()=>ui.snapshot()[0][1];
 return {ui,calls,run,state,fail:()=>fail=true};
}
test('solo producto conserva las variaciones pendientes sin enviarlas',async()=>{
 const f=fixture();await f.run('stage-add',{kind:'variation'});await f.run('stage-add',{kind:'finish',publicationOnly:true});const finish=f.state().rows.at(-1);await f.run('stage-commit',{row:finish.id});assert.deepEqual(f.calls.filter(c=>c.action.endsWith('_commit')).map(c=>c.kind),['finish']);assert.equal(f.state().rows[0].done,undefined);
});
test('publicar con variaciones guarda primero fotos, asignaciones y combinaciones',async()=>{
 const f=fixture();await f.run('stage-add',{kind:'image',assignVariantId:'7'});f.state().rows[0].image={name:'muestra.png',mime:'image/png',base64:'AAAA'};await f.run('stage-add',{kind:'variation'});await f.run('stage-add',{kind:'finish',publicationOnly:true});const finish=f.state().rows.at(-1);finish.publicationScope='all';await f.run('stage-commit',{row:finish.id});assert.deepEqual(f.calls.filter(c=>c.action.endsWith('_commit')).map(c=>c.kind),['image','variation','variation_edit','finish']);assert.deepEqual(f.calls.find(c=>c.kind==='variation_edit'&&c.action.endsWith('_commit')).associations.images,['92']);
});
test('fallo de combinación impide publicar y el reintento conserva la solicitud',async()=>{
 const f=fixture();await f.run('stage-add',{kind:'variation'});await f.run('stage-add',{kind:'finish',publicationOnly:true});const finish=f.state().rows.at(-1);finish.publicationScope='all';f.fail();await assert.rejects(()=>f.run('stage-commit',{row:finish.id}),/Fallo de conexión/);assert.equal(f.calls.some(c=>c.action.endsWith('_commit')&&c.kind==='finish'),false);await f.run('stage-commit',{row:finish.id});const attempts=f.calls.filter(c=>c.action.endsWith('_commit')&&c.kind==='variation');assert.equal(attempts[0].step_key,attempts[1].step_key);assert.equal(f.calls.filter(c=>c.action.endsWith('_commit')&&c.kind==='finish').length,1);
});
