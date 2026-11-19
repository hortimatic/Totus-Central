import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
export async function exerciseNativeCatalogue({api,php,ini,env}){
 const seed=mode=>JSON.parse(execFileSync(php,['-c',ini,'tests/native-lab/catalogue-order-fixture.php',...(mode?[mode]:[])],{encoding:'utf8',env,maxBuffer:1024*1024}).trim().split(/\r?\n/).at(-1));
 let fixture=seed();
 const page=async(field='price',direction='asc',offset=0,extra={})=>{
  const query=new URLSearchParams({search:fixture.prefix,page:String(offset),page_size:'20',sort_field:field,sort_direction:direction,...extra});
  let previous=-1;
  for(let round=0;round<100;round++){
   const response=await api('totus_tpv_catalogue?'+query);assert.equal(response.status,200,JSON.stringify(response.result));const data=response.result;
   assert.equal(data.sort_field,field);assert.equal(data.sort_direction,direction);assert.equal(data.payable_cart_quote,false);
   if(!data.building)return data;
   assert.equal(data.items.length,0,'An incomplete price index never exposes a sorted page');assert.equal(data.has_more,false);
   assert.ok(data.building.done>=previous&&data.building.done<=data.building.total,'Native build progress is monotonic');previous=data.building.done;
  }
  throw Error('Native price index failed to complete within the bounded catalogue fixture');
 };
 const expected=()=>fixture.ids.map((id,i)=>({id,cents:i===0?37:fixture.basePrices[i]})).sort((a,b)=>a.cents-b.cents||a.id-b.id);
 const first=await page(),second=await page('price','asc',1),all=[...first.items,...second.items];
 assert.equal(first.total_count,27);assert.equal(first.has_more,true);assert.equal(second.has_more,false);
 assert.deepEqual(all.map(p=>p.product_id),expected().map(p=>p.id));assert.deepEqual(all.map(p=>p.preview_cents),expected().map(p=>p.cents));
 const descending=await page('price','desc');assert.deepEqual(descending.items.map(p=>p.product_id),[...expected()].reverse().slice(0,20).map(p=>p.id));
 assert.equal(descending.price_snapshot_at,first.price_snapshot_at,'Changing direction reuses the complete contextual snapshot');
 for(const field of ['name','reference','stock','cost','id']){
  const data=await page(field),next=await page(field,'asc',1);
  assert.deepEqual([...data.items,...next.items].map(p=>p.product_id),fixture.ids,'Native '+field+' ordering precedes pagination');
 }
 const other=await page('price','asc',0,{customer_id:String(fixture.otherCustomerId),address_id:String(fixture.otherAddressId)});
 assert.equal(other.items[0].preview_cents,101);assert.equal(other.items[0].product_id,fixture.ids.at(-1),'Another customer cannot reuse the counter customer offer');
 fixture=seed('price-change');
 const changed=await page();assert.deepEqual(changed.items.slice(0,2).map(p=>p.product_id),expected().slice(0,2).map(p=>p.id),'Native Product update invalidates an already completed index');
 fixture=seed('scheduled-expiry');
 const exact={search:fixture.prefix+'-00'};
 const before=await page('price','asc',0,exact);assert.equal(before.total_count,1);assert.equal(before.items[0].preview_cents,37);
 const boundary=fixture.expirationEpoch*1000+200;assert.ok(boundary-Date.now()<66000,'Only the known next native minute boundary is awaited');
 while(Date.now()<boundary)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,boundary-Date.now())));
 const after=await page('price','asc',0,exact);assert.equal(after.items[0].preview_cents,fixture.basePrices[0],'Scheduled native offer expiry rebuilds the price order without a catalogue write');
 console.log('PASS native catalogue HTTP/MariaDB/PrestaShop 8.2.8: 27 products, full-result PVP and SQL pagination, customer-specific price isolation, native update invalidation and scheduled-offer expiry. Disposable fixture only.');
}
