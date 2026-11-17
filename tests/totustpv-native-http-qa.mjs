/** Real loopback HTTP, native Webservice ACL and installed original module.
 * Never reads remote credentials or contacts a remote shop.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createNativeCapabilityAdapter} from '../src/totustpv/server/native-capability-adapter.js';
import {nativeCents,nativeMicros} from '../src/totustpv/server/native-adapter.js';
import {verifyRemoteSale} from '../src/totustpv/model.js';
import {exerciseCentralEdge} from './native-lab/central-edge-flow.mjs';
import {exerciseNativeCatalogue} from './native-lab/catalogue-order-flow.mjs';
const project=process.cwd(),native=path.resolve('artifacts/native-lab/shop');
const params=await fs.readFile(path.join(native,'app/config/parameters.php'),'utf8');
assert.match(params,/'database_name'\s*=>\s*'totus_tpv_lab'/);assert.match(params,/'database_host'\s*=>\s*'127.0.0.1'/);
const moduleDir=path.join(native,'modules/totuscentralconnector');await fs.mkdir(moduleDir,{recursive:true});
await fs.cp('connectors/prestashop/src',path.join(moduleDir,'src'),{recursive:true});
for(const file of ['totuscentralconnector.php','Webservice.php'])await fs.copyFile('connectors/prestashop/module/'+file,path.join(moduleDir,file));
const php=path.resolve('artifacts/php82/php.exe'),ini=path.resolve('artifacts/native-lab/php.ini');
const env={...process.env,OPENSSL_CONF:path.resolve('artifacts/php82/extras/ssl/openssl.cnf')};
execFileSync(php,['-c',ini,'tests/native-lab/http-install.php'],{encoding:'utf8',env,maxBuffer:2*1024*1024});
execFileSync(php,['-c',ini,'tests/native-lab/cart-quote.php'],{encoding:'utf8',env,maxBuffer:2*1024*1024});
const setup=execFileSync(php,['-c',ini,'tests/native-lab/http-setup.php'],{encoding:'utf8',env,maxBuffer:2*1024*1024});
const fixture=JSON.parse(setup.trim().split(/\r?\n/).at(-1));
execFileSync(php,['-c',ini,'tests/native-lab/document-logo.php'],{encoding:'utf8',env,maxBuffer:1024*1024});
process.stdout.write(execFileSync(php,['-c',ini,'tests/native-lab/api-permissions.php',String(fixture.keyId)],{encoding:'utf8',env,maxBuffer:1024*1024}));
const base='http://127.0.0.1:8771/api/';let stderr='';
const assets=createServer(async(req,res)=>{try{
 const uri=new URL(req.url,'http://127.0.0.1:8772').pathname;
 assert.ok(['GET','HEAD'].includes(req.method)&&/^\/img\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|gif|webp)$/.test(uri));
 const target=path.resolve(native,'.'+uri),root=path.resolve(native,'img')+path.sep;assert.ok(target.startsWith(root));
 const data=await fs.readFile(target);res.setHeader('Content-Type',uri.endsWith('.png')?'image/png':'image/jpeg');
 res.end(req.method==='HEAD'?undefined:data);
 }catch{res.statusCode=404;res.end();}});
await new Promise((resolve,reject)=>{assets.once('error',reject);assets.listen(8772,'127.0.0.1',resolve);});
const child=spawn(php,['-c',ini,'-d','display_errors=0','-S','127.0.0.1:8771','tests/native-lab/http-router.php'],
 {cwd:project,env,windowsHide:true,stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>stderr+=b.toString());
async function api(resource,{method='GET',body,auth=true,actor}={}){
 const url=new URL(resource,base);url.searchParams.set('output_format','JSON');url.searchParams.set('id_shop','1');
 if(actor)url.searchParams.set('actor_id',actor);
 const response=await fetch(url,{method,redirect:'error',headers:{...(auth?{Authorization:'Basic '+Buffer.from(fixture.key+':').toString('base64')}:{ }),
  ...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
 const text=await response.text();let result;try{result=JSON.parse(text);}catch{if(response.status===401&&!auth)return {status:401,result:null};throw Error('Native HTTP returned non-JSON: '+text.slice(0,450));}
 return {status:response.status,result};
}
const actor=randomUUID(),session=randomUUID(),drawer=randomUUID();
const command=(name,payload)=>({protocol:1,operation_id:randomUUID(),installation_id:fixture.installationId,shop_id:1,actor_id:actor,command:name,payload});
try{
 let ready=false;for(let i=0;i<50;i++){try{await api('totus_tpv_profile');ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.equal(ready,true,'Disposable PHP server did not become ready');
 assert.equal((await api('totus_tpv_profile',{auth:false})).status,401,'Anonymous API request must be denied');
 const profile=await api('totus_tpv_profile');assert.equal(profile.status,200);assert.equal(profile.result.installation_id,fixture.installationId);
 assert.equal(profile.result.environment,'qa');assert.equal(profile.result.configured,false);
 const provision=await api('totus_tpv_setup',{method:'POST',body:command('setup.qa',{confirm_qa:true})});
 assert.equal(provision.result.verified,true,JSON.stringify(provision.result));
 const configured=await api('totus_tpv_profile');assert.equal(configured.result.configured,true);
 const again=await api('totus_tpv_setup',{method:'POST',body:command('setup.qa',{confirm_qa:true})});
 assert.deepEqual(again.result,provision.result,'Setup must reuse its native entities');
 const customerId=configured.result.counter_customer_id,addressId=configured.result.counter_address_id;
 if(process.argv.includes('--variants-only')){
  const variant=JSON.parse(execFileSync(php,['-c',ini,'tests/native-lab/variant-setup.php',String(fixture.productId),'zero-parent'],{encoding:'utf8',env,maxBuffer:1024*1024}).trim().split(/\r?\n/).at(-1));
  const parent=await api('totus_tpv_catalogue?search='+encodeURIComponent(variant.reference));assert.equal(parent.status,200);
  assert.equal(parent.result.items.length,1);assert.equal(parent.result.items[0].choose_variant,true);assert.equal(parent.result.items[0].stock,0);
  const choices=await api('totus_tpv_catalogue?product_id='+variant.productId);assert.equal(choices.status,200);
  assert.deepEqual(choices.result.items.map(row=>row.stock).sort((a,b)=>a-b),[-5,5]);
  assert.ok(choices.result.items.every(row=>row.choose_variant===false));
  console.log('PASS native variant catalogue: zero aggregate, negative unavailable variant, positive available variant. Fictional local product; no sale or remote shop.');
 }else if(process.argv.includes('--catalogue-only')){
  await exerciseNativeCatalogue({api,php,ini,env});
 }else if(process.argv.includes('--customers-only')||process.argv.includes('--browser-only')){
  await exerciseCentralEdge({fixture,profile:configured.result,base,focus:process.argv.includes('--customers-only')?'customers':'browser'});
 }else{
 const catalogue=await api('totus_tpv_catalogue?search='+encodeURIComponent(fixture.reference)+'&page=0&page_size=50');
 assert.equal(catalogue.status,200,JSON.stringify(catalogue.result));
 assert.equal(catalogue.result.catalogue_copied,false);assert.equal(catalogue.result.payable_cart_quote,false);
 const article=catalogue.result.items.find(row=>row.product_id===fixture.productId);
 assert.ok(article,'Native searchable catalogue must include the sale fixture');assert.equal(article.preview_cents,801);
 assert.equal(article.choose_variant,false);assert.equal(article.attribute_id,0);
 const exact=await api('totus_tpv_catalogue?search='+encodeURIComponent(article.reference));
 assert.ok(exact.result.items.some(row=>row.product_id===fixture.productId));
 assert.equal((await api('totus_tpv_catalogue?page=-1')).status,400);
 const centralScope={connectionId:randomUUID(),connectionRevision:1,storeId:randomUUID(),shopId:1,actorId:actor,
  drawerId:drawer,sessionId:session,currency:'EUR',environment:'qa'};
 // Explicit local native fixture transport. The production transport continues
 // to reject loopback; no production URL/secret policy is loosened for tests.
 const nativeTransport={assertMutationTarget:()=>true,createOrderOnce:()=>{throw Error('Classic order write forbidden');},
  async read(resource,query={}){const u=new URL(resource,base);for(const [key,value] of Object.entries(query))u.searchParams.set(key,value);
   const response=await api(u.pathname.replace('/api/','')+u.search);assert.equal(response.status,200,JSON.stringify(response.result));return response.result;},
  async nativeCommand({operationId,command:name,payload}){
   const resource={'sale.commit':'totus_tpv_sales'}[name];assert.ok(resource);
   return (await api(resource,{method:'POST',body:{...command(name,payload),operation_id:operationId}})).result;
  },async readNativeOperation(id){return (await api('totus_tpv_operations?operation_id='+id,{actor})).result;}};
 const centralAdapter=createNativeCapabilityAdapter({scope:centralScope,transport:nativeTransport,verifyPrepared:async()=>{throw Error('Not exercised by this readback test');}});
 const results=[],returnReceipts=[];
 fixture.variant=JSON.parse(execFileSync(php,['-c',ini,'tests/native-lab/variant-setup.php',String(fixture.productId)],{encoding:'utf8',env,maxBuffer:1024*1024}).trim().split(/\r?\n/).at(-1));
 for(const payments of [[{method:'cash',amount_cents:801,received_cents:1000}],
  [{method:'card',amount_cents:801}], [{method:'cash',amount_cents:300,received_cents:500},{method:'card',amount_cents:501}],
  [{method:'bizum',amount_cents:801}],[{method:'transfer',amount_cents:801}]]){
  const prep=command('cart.prepare',{session_id:session,drawer_id:drawer,customer_id:customerId,
   invoice_address_id:addressId,delivery_address_id:addressId,lines:[{product_id:fixture.productId,attribute_id:0,quantity:1}]});
  const cart=await api('totus_tpv_carts',{method:'POST',body:prep});assert.equal(cart.status,200,JSON.stringify(cart.result));assert.equal(cart.result.verified,true,JSON.stringify(cart.result));
  const quoteCommand=command('cart.quote',{cart_id:cart.result.cart_id});
  const quote=await api('totus_tpv_quotes',{method:'POST',body:quoteCommand});assert.equal(quote.result.verified,true,JSON.stringify(quote.result));
  assert.equal(quote.result.quote.total_cents,801);
  const sale=command('sale.commit',{cart_id:cart.result.cart_id,quote_operation_id:quoteCommand.operation_id,
   quote_fingerprint:quote.result.quote_fingerprint,payments});
  const q=quote.result.quote;
  const stock=await nativeTransport.read('stock_availables',{'filter[id_product]':`[${fixture.productId}]`,
   'filter[id_product_attribute]':'[0]','filter[id_shop]':'[1]',display:'full',limit:'0,2'});
  assert.equal(stock.stock_availables.length,1);
  const expected={storeId:centralScope.storeId,shopId:1,cartId:q.cart_id,customerId:q.customer_id,invoiceAddressId:q.invoice_address_id,
   deliveryAddressId:q.delivery_address_id,currencyId:q.currency_id,languageId:q.language_id,carrierId:q.carrier_id,currency:q.currency,
   paymentModule:'totuscentralconnector',paidStateIds:[configured.result.paid_state_id],nativePaymentLabels:configured.result.payment_labels,
   totalCents:q.total_cents,productsTaxInclCents:nativeCents(q.products_tax_incl),productsTaxExclCents:nativeCents(q.products_tax_excl),
   shippingCents:nativeCents(q.shipping_tax_incl),discountCents:nativeCents(q.discounts_tax_incl),
   nativeQuoteOperationId:quoteCommand.operation_id,nativeQuoteFingerprint:quote.result.quote_fingerprint,
   lines:q.lines.map(line=>({productId:line.product_id,attributeId:line.attribute_id,qty:line.quantity,
    unitTaxInclMicros:nativeMicros(line.unit_tax_incl),unitTaxExclMicros:nativeMicros(line.unit_tax_excl),
    lineTaxInclCents:nativeCents(line.line_tax_incl),lineTaxExclCents:nativeCents(line.line_tax_excl),stockRecordId:Number(stock.stock_availables[0].id)}))};
  const accepted=payments.map((row,index)=>({id:'native-test-'+index,method:row.method,amountCents:row.amount_cents,status:'settled',
   ...(row.method==='cash'?{receivedCents:row.received_cents}:{})}));
  const submitted=await centralAdapter.submitOrderOnce({scope:centralScope,operationId:sale.operation_id,expected,payments:accepted});
  const paid={result:(await nativeTransport.readNativeOperation(sale.operation_id)).result};
  assert.equal(submitted.orderId,paid.result.order_id);assert.equal(paid.result.invoice_ids.length,1);assert.equal(paid.result.total_cents,801);
  const observed=await centralAdapter.readSale({scope:centralScope,operationId:sale.operation_id,orderId:paid.result.order_id,expected});
  assert.equal(verifyRemoteSale(expected,observed).status,'confirmed','Central must independently verify the actual native order');
  const actualStock=JSON.parse(execFileSync(php,['-c',ini,'tests/native-lab/physical-stock.php',String(fixture.productId)],{encoding:'utf8',env,maxBuffer:1024*1024}).trim().split(/\r?\n/).at(-1));
  assert.equal(Number(actualStock.physical_quantity),Number(actualStock.quantity),'Delivered pickup must leave correct physical stock');
  assert.equal(Number(actualStock.reserved_quantity),0,'Delivered pickup must not retain web shipping reservations');
  const recovered=await api('totus_tpv_operations?operation_id='+sale.operation_id,{actor});
  assert.equal(recovered.result.status,'verified',JSON.stringify(recovered.result));assert.deepEqual(recovered.result.result,paid.result);
  const repeated=await api('totus_tpv_sales',{method:'POST',body:sale});assert.deepEqual(repeated.result,paid.result);
  const denied=await api('totus_tpv_operations?operation_id='+sale.operation_id,{actor:randomUUID()});assert.equal(denied.status,400);
  results.push({saleId:sale.operation_id,orderId:paid.result.order_id,payments:paid.result.payments,invoiceIds:paid.result.invoice_ids});
 }
 assert.equal(new Set(results.map(r=>r.orderId)).size,5);
 for(const kind of ['receipt','gift','invoice','delivery']){
  const document=await api('totus_tpv_documents?operation_id='+results[0].saleId+'&kind='+kind,{actor});
  assert.equal(document.status,200,JSON.stringify(document.result));assert.equal(document.result.order_id,results[0].orderId);
  assert.equal(document.result.existing_document,true);
  if(['invoice','delivery'].includes(kind))assert.equal(Buffer.from(document.result.base64,'base64').subarray(0,5).toString(),'%PDF-');
  else{assert.equal(document.result.lines.length,1);const line=document.result.lines[0];
   if(kind==='gift'){for(const field of ['line_cents','unit_tax_incl_micros','tax_cents','tax_excl_cents'])assert.equal(line[field],undefined);assert.equal(document.result.total_cents,undefined);}
   else{assert.equal(document.result.total_cents,801);assert.ok(Number.isSafeInteger(line.unit_tax_incl_micros)&&line.unit_tax_incl_micros>0);
    assert.equal(line.tax_cents,line.line_cents-line.tax_excl_cents);}}
 }
 process.stdout.write(execFileSync(php,['-c',ini,'tests/native-lab/return-rollback.php',results[0].saleId],{encoding:'utf8',env,maxBuffer:1024*1024}));
 for(let i=0;i<results.length;i++){
  const sold=results[i];const available=await api('totus_tpv_returns?sale_operation_id='+sold.saleId,{actor});
  assert.equal(available.status,200,JSON.stringify(available.result));assert.equal(available.result.items[0].remaining_quantity,1);
  const refund=command('return.commit',{sale_operation_id:sold.saleId,state_fingerprint:available.result.state_fingerprint,
   items:[{detail_id:available.result.items[0].detail_id,quantity:1,restock:i!==1}],
   payments:Object.entries(sold.payments).map(([method,amount_cents])=>({method,amount_cents})),operator_confirmed:true});
  const returned=await api('totus_tpv_returns',{method:'POST',body:refund});
  assert.equal(returned.result.verified,true,JSON.stringify(returned.result));assert.equal(returned.result.total_cents,801);
  assert.equal(returned.result.credit_note_ids.length,1);assert.equal(returned.result.stock_movement_ids.length,i===1?0:1);
  const repeated=await api('totus_tpv_returns',{method:'POST',body:refund});assert.deepEqual(repeated.result,returned.result);
  const recovered=await api('totus_tpv_operations?operation_id='+refund.operation_id,{actor});assert.deepEqual(recovered.result.result,returned.result);
  const after=await api('totus_tpv_returns?sale_operation_id='+sold.saleId,{actor});assert.equal(after.result.items[0].remaining_quantity,0);
  const excess=command('return.commit',{...refund.payload,state_fingerprint:after.result.state_fingerprint});
  const refused=await api('totus_tpv_returns',{method:'POST',body:excess});assert.equal(refused.result.status,'uncertain');
  assert.equal(refused.result.reason,'TOTUS_RETURN_QUANTITY_EXCEEDED');returnReceipts.push(returned.result);
 }
 const missing=await api('totus_tpv_operations?operation_id='+randomUUID(),{actor});assert.equal(missing.result.status,'not_observed');
 assert.equal(missing.result.retry_command_forbidden,true);
 const receive=command('stock.receive',{product_id:fixture.productId,attribute_id:0,quantity:3,reason:'Recepción ficticia del laboratorio'});
 const stocked=await api('totus_tpv_stock',{method:'POST',body:receive});assert.equal(stocked.result.verified,true,JSON.stringify(stocked.result));
 assert.equal(stocked.result.after,stocked.result.before+3);
 assert.deepEqual((await api('totus_tpv_stock',{method:'POST',body:receive})).result,stocked.result);
 assert.deepEqual((await api('totus_tpv_operations?operation_id='+receive.operation_id,{actor})).result.result,stocked.result);
 const edgeFlow=await exerciseCentralEdge({fixture,profile:(await api('totus_tpv_profile')).result,base});
 process.stdout.write(execFileSync(php,['-c',ini,'tests/native-lab/private-pickup.php'],{encoding:'utf8',env,maxBuffer:1024*1024}));
 await fs.writeFile('artifacts/native-lab/latest-http-sales.json',JSON.stringify({mode:'local-native-http-installed-module',results,returnReceipts,edgeFlow,productId:fixture.productId,remoteShopTouched:false},null,2));
 console.log('PASS installed original module: native HTTP authentication/ACL, cash/card/mixed orders, invoices, native credit notes, selective restocking, excessive-return rejection and read-only recovery without duplicate effects. Loopback lab only.');
 }
}finally{child.kill();await new Promise(resolve=>child.exitCode!==null?resolve():child.once('exit',resolve));await new Promise(resolve=>assets.close(resolve));}
