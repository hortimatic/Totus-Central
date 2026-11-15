import assert from 'node:assert/strict';
import {readPool} from '../src/read-pool.js';
let active=0,max=0;const release=[];
const pending=readPool([0,1,2,3,4],async n=>{active++;max=Math.max(max,active);await new Promise(r=>release[n]=r);active--;return n;});
assert.equal(active,3);release[2]();release[1]();release[0]();await new Promise(r=>setImmediate(r));assert.equal(active,2);release[4]();release[3]();assert.deepEqual(await pending,[0,1,2,3,4]);assert.equal(max,3);
let called=0;
await assert.rejects(readPool([1,2,3],async()=>{called++;throw Error('Lectura rechazada');},{limit:1}),/Lectura rechazada/);assert.equal(called,1);
await assert.rejects(readPool([1],async()=>1,{current:()=>false}),/selección ha cambiado/);
console.log('Read pool: bounded parallelism, original order, failure and navigation cancellation PASS.');
