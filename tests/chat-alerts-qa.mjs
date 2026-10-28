import assert from 'node:assert/strict';
import {createChatNotifier,prepareChatSound,playChatSound,requestChatDesktopPermission} from '../src/chat-alerts.js';
import {chatChannelInput,chatChannelIdentity,chatLayout} from '../src/team-chat-core.js';
globalThis.document={visibilityState:'hidden',addEventListener(){},removeEventListener(){}};
globalThis.window={focus(){}};
let actor='qa@qa.invalid',allowed=true,rows=[],settings={sound_enabled:true,desktop_enabled:true},sounds=0,reading=false,counts=[],opens=[];
class NotificationMock{static permission='granted';static all=[];constructor(title,options){this.title=title;this.options=options;NotificationMock.all.push(this);}close(){this.closed=true;this.onclose?.();}}
const n=createChatNotifier({actor:()=>actor,can:()=>allowed,onCount:x=>counts.push(x),onOpen:m=>opens.push(m.id),isReading:()=>reading,NotificationClass:NotificationMock,sound:async()=>{sounds++;},rpc:async name=>name==='totus_chat_inbox'?rows:{layout:settings}});
const m=id=>({id,channel_id:'channel',channel_name:'Cajas',desktop_enabled:false});
rows=[m('old')];await n.check();assert.equal(sounds,0);assert.equal(NotificationMock.all.length,0,'No old-message storm on start');
rows=[m('new'),...rows];await n.check();assert.equal(sounds,1);assert.equal(NotificationMock.all.length,1,'Background delivery must work');assert.equal(NotificationMock.all[0].options.silent,true);assert(!NotificationMock.all[0].options.body.includes('private'));
await n.check();assert.equal(sounds,1,'No repeat');NotificationMock.all[0].onclick();assert.deepEqual(opens,['new']);
reading=true;rows=[m('reading'),...rows];await n.check();assert.equal(sounds,1,'No alert for visible bottom of current conversation');reading=false;
settings={sound_enabled:false,desktop_enabled:false};rows=[m('off'),...rows];await n.check();assert.equal(sounds,1);assert.equal(NotificationMock.all.length,1);
settings={sound_enabled:true,desktop_enabled:true};NotificationMock.permission='denied';rows=[m('denied'),...rows];await n.check();assert.equal(sounds,2);assert.equal(NotificationMock.all.length,1,'Permission denial leaves sound operational');
allowed=false;await n.check();assert.equal(counts.at(-1),0);allowed=true;actor='new@qa.invalid';await n.check();assert.equal(sounds,2,'No previous-account notifications');n.stop();
// Logging out while a request is in flight must not deliver stale notifications.
let release;const delayed=createChatNotifier({actor:()=>actor,onCount:()=>{},onOpen:()=>{},rpc:name=>name==='totus_chat_inbox'?new Promise(r=>release=r):Promise.resolve({layout:settings}),NotificationClass:NotificationMock});
const pending=delayed.check();delayed.stop();release([m('stale')]);await pending;assert.equal(NotificationMock.all.length,1);
assert.equal(chatLayout({sound_enabled:true,desktop_enabled:false}).sound_enabled,true);assert.equal(chatLayout({sound_enabled:'yes'}).sound_enabled,undefined);
assert.equal(chatChannelInput({name:'Pedidos',icon:'📦'}).name,'📦 Pedidos');assert.deepEqual(chatChannelIdentity('📦 Pedidos'),{icon:'📦',name:'Pedidos'});assert.equal(chatChannelInput({name:'Pedidos',icon:'<script>'}).name,'Pedidos');
assert.throws(()=>chatChannelInput({name:'a'.repeat(80),icon:'📦'}));
let emitted=0;globalThis.AudioContext=class{state='running';currentTime=0;destination={};resume(){return Promise.resolve();}createOscillator(){return {type:'',frequency:{setValueAtTime(){}},connect(){},start(){emitted++;},stop(){},disconnect(){}};}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}};
await prepareChatSound();assert.equal(await playChatSound(),true);assert.equal(emitted,1);
globalThis.Notification={permission:'denied'};await assert.rejects(requestChatDesktopPermission(),/no autorizados/);
console.log('CHAT ALERTS QA: background, opt-out, no old/repeated/current-user alerts, logout, icons and audio OK');

// Preview pagination cannot cap the unread badge; mute and mentions still apply.
let total;
const totals=createChatNotifier({actor:()=>actor,onCount:n=>total=n,onOpen:()=>{},rpc:async name=>name==='totus_chat_inbox'?Array.from({length:100},(_,i)=>m('preview'+i)):{layout:{},channels:[{id:'a',member_role:'member',unread:170},{id:'b',member_role:'member',unread:80,notify_level:'mentions',mentions:3},{id:'muted',member_role:'member',muted:true,unread:999},{id:'public',unread:400},{id:'old',member_role:'member',archived:true,unread:200}]} });
await totals.check();assert.equal(total,173);totals.stop();
