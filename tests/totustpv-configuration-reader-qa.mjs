import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createTpvConfigurationReader} from '../src/totustpv/configuration-reader.js';
import {createWorkstationAccessPanel} from '../src/totustpv/workstation-access.js';
function fixture(){let owner='manager';const row={operatorId:'person',drawerId:'drawer',storeId:'store',operatorName:'Persona',drawerName:'Caja',storeName:'Tienda',shopId:1,revision:2,active:true,operatorActive:true,drawerActive:true,permissions:{sell:false,open:true,reconcile:true,secret:'excluded'},secret:'excluded'};
 const response={connectionId:'connection',revision:6,items:[row]};
 return {row,response,change:()=>owner='other',read:(readAssignments=async()=>response)=>createTpvConfigurationReader({actor:()=>({id:owner}),rpc:async name=>name==='totus_api_manager'?{connections:[{id:'connection',revision:6}]}:{websites:[{origin:'https://preproduccion.hortimatic.com',status:'active',connection_id:'connection'}],businesses:[]},readDrawers:async()=>[],readOperators:async()=>[],readAssignments})()};
}
test('assignment reader projects verified flags and excludes unknown fields',async()=>{const f=fixture(),result=await f.read();assert.equal(result.accesses[0].permissions.sell,false);assert.equal(result.accesses[0].secret,undefined);assert.equal(result.accesses[0].permissions.secret,undefined);});
test('assignment reader rejects a stale revision, malformed flags and changed account',async()=>{const f=fixture();f.response.revision=7;await assert.rejects(f.read(),/comprobar/);f.response.revision=6;f.row.permissions.open='true';await assert.rejects(f.read(),/comprobar/);f.row.permissions.open=true;await assert.rejects(f.read(async()=>{f.change();return f.response;}),/sesión/);});
test('a delayed access reply cannot repopulate a disposed panel or another account',async()=>{
 const f=fixture();let release;const panel=createWorkstationAccessPanel({canManage:()=>true,uuid:()=> 'request',invoke:()=>new Promise(resolve=>release=resolve)});
 panel.load({connectionId:'connection',revision:6,accesses:[f.row]});panel.edit(0);const pending=panel.save();panel.reset();
 release({...f.row,connectionId:'connection',permissions:{sell:false,open:true,reconcile:true}});
 await assert.rejects(pending,/vista ha cambiado/);assert.equal(panel.html(),'');assert.equal(panel.hasDraft(),false);
});
test('losing manager permission prevents an access write',async()=>{
 const f=fixture();let permitted=true,writes=0;const panel=createWorkstationAccessPanel({canManage:()=>permitted,invoke:async()=>writes++});
 panel.load({connectionId:'connection',revision:6,accesses:[f.row]});panel.edit(0);permitted=false;
 await assert.rejects(panel.save(),/permiso/);assert.equal(writes,0);assert.equal(panel.html(),'');
});
