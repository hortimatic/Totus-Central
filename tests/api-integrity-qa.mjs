import assert from 'node:assert/strict';
// The browser SDK is substituted only in Node tests; production connects directly to Supabase.
const records=Array.from({length:2305},(_,i)=>({id:String(i).padStart(5,'0'),business_date:'2026-01-02',value:i}));
let rows=records,denyDeletion=false,deleteCalls=0;
const client={
 from(table){
  let mode='select',id=null,sort=[],offset=[0,999];
  return {
   select(){return this;},delete(){mode='delete';return this;},
   eq(k,v){if(k==='id')id=v;return this;},
   order(key,{ascending=true}={}){sort.push([key,ascending]);return this;},
   range(a,b){offset=[a,b];return this;},
   then(done,reject){
    if(mode==='delete'){
     deleteCalls++;
     const index=denyDeletion?-1:rows.findIndex(x=>x.id===id);
     const removed=index>=0?rows.splice(index,1):[];
     return Promise.resolve({data:removed,error:null}).then(done,reject);
    }
    const ordered=[...rows].sort((a,b)=>{
     for(const [k,asc] of sort){const cmp=String(a[k]??'').localeCompare(String(b[k]??''));if(cmp)return asc?cmp:-cmp}
     return 0;
    });
    return Promise.resolve({data:ordered.slice(offset[0],offset[1]+1),error:null}).then(done,reject);
   }
  };
 }
};
globalThis.window={supabase:{createClient:()=>client}};
const {select,remove}=await import('../src/api.js');
const paged=await select('ops_daily_closings',{order:'business_date',ascending:false});
assert.equal(paged.length,2305);
assert.equal(new Set(paged.map(x=>x.id)).size,2305,'Paginated queries duplicate rows');
assert.deepEqual(paged.map(x=>x.id),[...paged].map(x=>x.id).sort(),'Ties must have deterministic id ordering');
await assert.rejects(select('ops_daily_closings',{limit:2000}),/límite de 2000/,'Truncation must produce a clear error');
assert.equal((await select('ops_daily_closings',{limit:2000,allowTruncated:true})).length,2000);
rows=[{id:'exists'}];denyDeletion=true;
await assert.rejects(remove('ops_suppliers','exists'),/No se eliminó/,'RLS silent denial must not be reported as successful');
assert.equal(rows.length,1);
denyDeletion=false;
assert.equal((await remove('ops_suppliers','exists')).id,'exists');
assert.equal(rows.length,0);
await assert.rejects(remove('ops_suppliers','exists'),/No se eliminó/,'Missing record must not report deletion');
assert.equal(deleteCalls,3);
console.log('API INTEGRITY QA: 2305 rows, deterministic pagination, no silent truncation, denied/missing delete detected');
