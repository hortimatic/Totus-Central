import assert from 'node:assert/strict';
import {chatMoveChannel,chatText,chatChannelInput,chatDateRange,chatMessageMatches,chatGroups,chatLayout,chatTaskPrompt} from '../src/team-chat-core.js';
assert.equal(chatText('  Hola\r\nEquipo '),'Hola\nEquipo');
assert.throws(()=>chatText(' '));assert.throws(()=>chatText('x'.repeat(12001)));
assert.equal(chatChannelInput({name:'Cajas',group_name:'Hortimatic',is_private:true}).is_private,true);
assert.throws(()=>chatChannelInput({name:''}));
assert.throws(()=>chatDateRange('2026-10-31','2026-10-01'));
assert.throws(()=>chatDateRange('2026-02-31',''));
assert.deepEqual(chatDateRange('2026-10-01','2026-10-31'),{from:'2026-10-01',to:'2026-10-31'});
assert.equal(chatMessageMatches({created_at:'2026-10-24',body:'Factura eléctrica',author_email:'a@b',pinned:true},{query:'electrica',pinned:true}),true);
assert.equal(chatMessageMatches({created_at:'2026-10-24',body:'Factura'},{from:'2026-11-01'}),false);
assert.equal(chatGroups([{name:'Cajas',group_name:'Hortimatic'},{name:'Avisos',group_name:'Equipo'}])[0].name,'Equipo');
const prompt=chatTaskPrompt({name:'Gastos',id:'channel'},{id:'message',body:'Revisar factura'});
assert(prompt.includes('No conviertas este mensaje directamente en contabilidad'));
assert(prompt.includes('No hay un asistente automático activo'));
console.log('TEAM CHAT CORE QA: text, ranges, grouping, search and explicit accounting/AI boundaries OK');

const layoutSample=chatLayout({group_order:['NewOldSmok','Hortimatic'],group_sort:{Hortimatic:'recent'},compact_sidebar:true});
assert.equal(chatGroups([{id:'a',name:'A',group_name:'Hortimatic',last_seq:1},{id:'z',name:'Z',group_name:'Hortimatic',last_seq:20},{id:'n',name:'N',group_name:'NewOldSmok'}],layoutSample)[0].name,'NewOldSmok');
assert.equal(chatGroups([{name:'A',group_name:'Hortimatic',last_seq:1},{name:'Z',group_name:'Hortimatic',last_seq:20}],layoutSample)[0].channels[0].name,'Z');
assert.equal(chatLayout({collapsed_groups:123,group_labels:[],group_order:null}).collapsed_groups.length,0);
assert.equal(chatLayout({group_sort:{Hortimatic:'unsafe'}}).group_sort.Hortimatic,undefined);

assert.equal(chatGroups([{name:'Real',group_name:'constructor'}])[0].label,'constructor','Section labels must not inherit object properties');

const personal=chatGroups([{id:'channel',name:'Cajas',group_name:'Hortimatic'}],{channel_groups:{channel:'Mis cierres'},extra_groups:['Mis cierres']});
assert.equal(personal.find(g=>g.name==='Mis cierres').channels[0].name,'Cajas');

const moveRows=[{id:'a',name:'A',group_name:'Hortimatic'},{id:'b',name:'B',group_name:'Hortimatic'},{id:'c',name:'C',group_name:'NewOldSmok'}];
const moved=chatMoveChannel(moveRows,{},'c','a');
assert.deepEqual(chatGroups(moveRows,moved).find(g=>g.name==='Hortimatic').channels.map(c=>c.id),['c','a','b']);
assert.equal(moveRows[2].group_name,'NewOldSmok','A personal move cannot change the shared channel');
assert.deepEqual(chatMoveChannel(moveRows,moved,'missing','a'),moved);
assert.deepEqual(chatLayout(JSON.parse(JSON.stringify(moved))),moved,'Order survives server roundtrip');
