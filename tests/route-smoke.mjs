import assert from 'node:assert/strict';
import fs from 'node:fs';
import {state,setView,resetView,patchFilters} from '../src/state.js';
import {renderers} from '../src/pages/main.js';
import {ROUTES} from '../src/config.js';

const harness=fs.readFileSync('tests/ui-harness.html','utf8');
const code=harness.split('<script type="module">')[1]?.split('</script>')[0];
assert.ok(code,'Missing UI sample data');
const seed=code.replace(/^\s*import\s+.*?;\s*$/gm,'').split('setRoute(route);')[0];
new Function('state','location','URLSearchParams',seed)(state,{search:'?route=inicio'},URLSearchParams);
const actions=new Set();let cases=0;
function check(route,scenario){
 const html=renderers[route]();
 assert.equal(typeof html,'string',route+' '+scenario+' not rendered');
 assert.ok(html.length>150,route+' '+scenario+' is empty');
 for(const hit of html.matchAll(/data-action="([^"$]+)"/g))actions.add(hit[1]);
 cases++;
 return html;
}
for(const route of ROUTES.map(x=>x.id))check(route,'list');
for(const [route,id] of [['cajas','cl1'],['gastos','ex1'],['facturacion','iv1'],['documentos','doc1']]){
 setView(route,{mode:'record',id:null});check(route,'new');
 setView(route,{mode:'record',id});check(route,'edit');
 resetView(route);
}
for(const section of ['usuarios','negocio','fiscal','storage','backups','log']){
 setView('administracion',{section});check('administracion',section);
}
for(const [route,needle] of [['cajas','Cierre QA'],['gastos','Proveedor QA'],['facturacion','H-0001'],['documentos','factura.pdf']]){
 const original={...state.filters[route]};
 patchFilters(route,{from:'2026-10-01',to:'2026-10-31',store:'s1',query:''});
 assert.ok(check(route,'in range').includes(needle),route+' must include dated item');
 patchFilters(route,{from:'2026-10-11'});
 assert.ok(!check(route,'outside range').includes(needle),route+' must exclude later range');
 patchFilters(route,{from:'2026-10-01',store:'s2'});
 assert.ok(!check(route,'other store').includes(needle),route+' must exclude other store');
 patchFilters(route,original);
}
// A staff member may edit their own upload but never another user's document.
const savedUser=state.user,savedSession=state.session,savedDoc=state.data.documents[0];
state.data.documents[0]={...savedDoc,uploaded_by:'qa-owner'};
for(const [role,userId,mayEdit,mayDelete] of [
 ['encargado','other-user',false,false],
 ['encargado','qa-owner',true,false],
 ['gerente','other-user',true,true],
 ['admin','other-user',true,true]
]){
 state.user={...savedUser,role};
 state.session={user:{id:userId}};
 setView('documentos',{mode:'record',id:'doc1'});
 const html=check('documentos','permission '+role);
 assert.equal(html.includes('data-action="document-save"'),mayEdit,'Incorrect document edit permissions: '+role);
 assert.equal(html.includes('data-action="document-delete"'),mayDelete,'Incorrect document delete permissions: '+role);
 assert.ok(html.includes('data-action="document-preview"'),'Read-only users must be able to preview');
}
state.user=savedUser;state.session=savedSession;state.data.documents[0]=savedDoc;
resetView('documentos');

const app=fs.readFileSync('src/app.js','utf8');
const handlers=new Set([...app.matchAll(/\ba==='([^']+)'/g)].map(x=>x[1]));
const unhandled=[...actions].filter(x=>!handlers.has(x)&&!x.endsWith('-apply')&&!x.endsWith('-month'));
assert.deepEqual(unhandled,[],'Missing click handlers');
console.log('ROUTE SMOKE: '+cases+' renders, '+actions.size+' actions checked, 12 date/store scenarios OK');
