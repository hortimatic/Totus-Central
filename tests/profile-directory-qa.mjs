import assert from 'node:assert/strict';
import {PROFILE_DIRECTORY_COLUMNS,readProfileDirectory} from '../src/profile-directory.js';
const own={id:'own',email:'own@example.invalid',updated_at:'2026-11-14T22:00:00Z',ui_preferences:{account:{revision:2,config:{phone:'fixture'}},interface:{config:{textColor:'#123456'}},interface_styles:{items:[{id:'style'}]},team_chat:{background:'fixture'}}};
const other={id:'other',email:'other@example.invalid',updated_at:own.updated_at,ui_preferences:{account:{revision:3,config:{notes:'fixture'}},interface:{config:{private:'not in directory'}}}};
let calls=[];
const select=async(table,options)=>{
 assert.equal(table,'profiles');calls.push(options);
 if(options.columns){assert.equal(options.columns,PROFILE_DIRECTORY_COLUMNS);return [own,other].map(({ui_preferences,...row})=>({...row,account:ui_preferences.account}));}
 let target;options.filter({eq:(column,value)=>{assert.equal(column,'id');target=value;}});assert.equal(target,'own');assert.equal(options.limit,1);return [structuredClone(own)];
};
const before=JSON.stringify([own,other]);
let rows=await readProfileDirectory(select,'own',structuredClone(own));
assert.equal(calls.length,1);assert.deepEqual(rows[0].ui_preferences,own.ui_preferences);
assert.deepEqual(rows[1].ui_preferences,{account:other.ui_preferences.account});
assert.equal(JSON.stringify([own,other]),before);
calls=[];rows=await readProfileDirectory(select,'own');
assert.equal(calls.length,2);assert.deepEqual(rows[0],own);
calls=[];rows=await readProfileDirectory(select,'own',structuredClone(other));assert.equal(calls.length,2);assert.deepEqual(rows[0],own,'A profile of another actor cannot replace the owner');
calls=[];rows=await readProfileDirectory(select,'new-user',own);assert.equal(calls.length,1);assert.equal(rows.some(row=>row.ui_preferences?.team_chat),false,'Never reuse another account\'s preferences');
await assert.rejects(()=>readProfileDirectory(async()=>{throw Error('read failed')},'own',own),/read failed/);
const missing=await readProfileDirectory(async(_table,options)=>options.columns?[{id:'own',updated_at:'new',account:{revision:1}}]:[],'own');
assert.deepEqual(missing[0].ui_preferences,{account:{revision:1}},'A missing fresh profile never restores stale themes');
console.log('PROFILE DIRECTORY: narrow list, preserved own themes/account, changed revision readback, account switch, missing profile and failure propagation verified');
