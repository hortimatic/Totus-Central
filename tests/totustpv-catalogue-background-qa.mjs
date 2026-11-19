import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatalogueBackground} from '../src/totustpv/catalogue-background.js';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate){for(let i=0;i<200&&!predicate();i++)await sleep(5);assert.ok(predicate(),'background condition timed out');}
test('background yields to cashier, cancels obsolete scope and never overlaps preparations',async()=>{
 let scope='first',idle=false,reads=[],active=0,max=0,started=[];
 const background=createCatalogueBackground({delay:2,refresh:100000,current:()=>scope?{key:scope,prepare:async({signal,beforePage})=>{
  const owner=scope;if(owner==='first')idle=false;started.push(owner);active++;max=Math.max(max,active);
  try{await beforePage();if(signal.aborted)throw signal.reason;reads.push(owner);return {completedProducts:1};}finally{active--;}
 }}:null,canRun:()=>idle});
 try{
  background.update();await sleep(15);assert.equal(started.length,0);
  idle=true;await until(()=>started.length===1);idle=false;
  scope='second';background.update();await sleep(15);assert.deepEqual(reads,[]);
  idle=true;await until(()=>reads.includes('second'));assert.equal(max,1);
  await sleep(15);assert.equal(started.filter(x=>x==='second').length,1);
  scope=null;background.stop();await sleep(10);assert.equal(active,0);
 }finally{scope=null;background.stop();}
});

test('preparation status reports progress and expires without authorizing a sale',async()=>{
 let active=true,runnable=true;const states=[];
 const bg=createCatalogueBackground({delay:2,refresh:100000,onState:state=>states.push(state),canRun:()=>runnable,current:()=>active?{key:'station',prepare:async({onProgress})=>{
  onProgress({products:2,completedProducts:1});runnable=false;return {products:2,completedProducts:2,validUntil:Date.now()+30};
 }}:null});
 try{bg.update();await until(()=>states.some(s=>s.phase==='updated'));
  assert.ok(states.some(s=>s.phase==='preparing'&&s.completedProducts===1));
  await until(()=>bg.snapshot().phase==='waiting');
  active=false;bg.stop();assert.equal(bg.snapshot().phase,'idle');
 }finally{active=false;bg.stop();}
});
