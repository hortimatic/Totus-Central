import assert from 'node:assert/strict';
import {ServiceError,UncertainWriteError,assertService,matchesSavedFields,verifiedWrite,cleanupAllowed} from '../src/write-safety.js';
const rejected=new ServiceError({error:{message:'No autorizado',code:'42501'},status:403},'Guardar');
assert.equal(rejected.code,'42501');assert.equal(rejected.status,403);assert(cleanupAllowed(rejected));
const ambiguous=new ServiceError({error:{message:'Respuesta perdida',code:'08007'}},'Guardar');
assert(!cleanupAllowed(ambiguous));
for(const code of ['08000','08007','40003','57P01',''])assert(!cleanupAllowed(new ServiceError({error:{message:'Desconocido',code}},'Guardar')),code);
for(const code of ['23505','23503','22003','P0001','40001','40P01'])assert(cleanupAllowed(new ServiceError({error:{message:'Rechazado',code}},'Guardar')),code);
assert.throws(()=>assertService({error:{message:'Inválido',code:'P0001'}},'Operación'),e=>e.code==='P0001');
const input={id:'record',amount:12.3,notes:'Conservar',settings:{b:2,a:1},updated_at:'2026-01-01T00:00:00Z'};
const saved={...input,amount:'12.30',settings:{a:1,b:2},updated_at:'2026-01-02T00:00:00Z'};
assert(matchesSavedFields(saved,input));assert(!matchesSavedFields({...saved,notes:'Otros datos'},input));
let reads=0;
assert.equal(await verifiedWrite(async()=>saved,async()=>{reads++;return null},()=>true),saved);assert.equal(reads,0);
await assert.rejects(verifiedWrite(async()=>{throw rejected},async()=>{reads++;return saved},()=>true),e=>e===rejected);assert.equal(reads,0,'A confirmed denial must never be presented as a success');
assert.equal(await verifiedWrite(async()=>{throw ambiguous},async()=>saved,row=>matchesSavedFields(row,input)),saved);
for(const read of [async()=>null,async()=>({...saved,amount:1}),async()=>{throw new TypeError('offline')}]){
 await assert.rejects(verifiedWrite(async()=>{throw new TypeError('response lost')},read,row=>matchesSavedFields(row,input)),e=>e instanceof UncertainWriteError&&!cleanupAllowed(e));
}
console.log('WRITE SAFETY QA: confirmed rejection, connection/commit uncertainty, read-back matching, no false success and no destructive cleanup on unknown outcome');
