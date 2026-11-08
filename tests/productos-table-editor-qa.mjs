import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductTableEditor} from '../src/productos-table-editor.js';
test('table edits prepare only selected fields and retain request identity after a lost reply',async()=>{
 const calls=[];let saved=null,lose=true;const invoke=async(shop,action,args)=>{calls.push({shop,action,...structuredClone(args)});if(action.endsWith('_prepare'))return {resource:'products',record_id:args.record_id,fingerprint:'a'.repeat(64),can_commit:true,changes:args.changes.map(c=>({...c,changed:true}))};if(action.endsWith('_commit')){if(lose){lose=false;throw Error('Respuesta perdida');}return {persisted:true,verified:true,resource:'products',record_id:args.record_id};}return {resource:'products',item:{id:args.record_id,reference:'NUEVA'}};};
 const editor=createProductTableEditor({invoke,canEdit:()=>true,onSaved:(shop,item)=>saved={shop,item}});
 editor.open('hortimatic','42',['1','2']);editor.change('hortimatic','42','name','Nombre ES');editor.change('hortimatic','42','price','12,50');await editor.prepare('hortimatic','42');assert.deepEqual(calls[0].changes,[{field:'name',value:'Nombre ES',language_id:'1'},{field:'price',value:'12.50'}]);
 await assert.rejects(editor.save('hortimatic','42'),/perdida/);const snapshot=editor.snapshot();assert.throws(()=>editor.discard('hortimatic','42'),/Comprueba/);assert.throws(()=>editor.change('hortimatic','42','price','20'),/Comprueba/);
 const resumed=createProductTableEditor({invoke,canEdit:()=>true,onSaved:(shop,item)=>saved={shop,item}});resumed.restore(snapshot);await resumed.save('hortimatic','42');const puts=calls.filter(c=>c.action.endsWith('_commit'));assert.equal(puts[0].request_id,puts[1].request_id);assert.deepEqual(saved,{shop:'hortimatic',item:{id:'42',reference:'NUEVA'}});assert.equal(resumed.rows.size,0);
});
test('permissions, cross-row identity and validation remain enforced',async()=>{
 const denied=createProductTableEditor({invoke:()=>{throw Error('Should not call')},canEdit:()=>false});assert.throws(()=>denied.open('hortimatic','42',['1']),/permiso/);
 const editor=createProductTableEditor({invoke:async()=>({resource:'products',record_id:'99',changes:[],fingerprint:'x',can_commit:true}),canEdit:()=>true});editor.open('hortimatic','42',['1']);editor.change('hortimatic','42','active','0');await assert.rejects(editor.prepare('hortimatic','42'),/otra ficha/);await assert.rejects(editor.save('hortimatic','42'),/Revisa/);assert.throws(()=>editor.language('hortimatic','42','2'),/Idioma/);assert.throws(()=>editor.change('hortimatic','42','id','9'),/ficha/);
});
