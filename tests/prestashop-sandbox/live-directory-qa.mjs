import assert from 'node:assert/strict';
import test from 'node:test';
import {writeContactDirectory} from '../../supabase/functions/totus-connections/contact-directory-write.js';
const key='TOTUSPRESTASHOPQA123456789012345',id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const connection={id,name:'PrestaShop · Hortimatic',protocol:'prestashop',endpoint:'https://hortimatic.com/api/',secret:key,revision:1,verified_revision:1,enabled:true,real_data_authorized:true};
const entries=new Map(),counts={POST:0,PUT:0,DELETE:0};
async function request(address,init={}){const remote=new URL(address);assert.equal(remote.origin,'https://hortimatic.com');assert(remote.pathname.startsWith('/api/'));const headers=new Headers(init.headers);assert.equal(headers.get('authorization'),'Basic '+btoa(key+':'));if(counts[init.method]!==undefined)counts[init.method]++;const response=await fetch(new URL(remote.pathname+remote.search,'http://localhost:8000'),{...init,headers,redirect:'manual'});if(!response.ok)console.error('Isolated directory native error',init.method||'GET',remote.pathname+remote.search,response.status,(await response.clone().text()).slice(0,2500));return response;}
async function publish(kind,resource,operation,fields={},recordId){
 const requestId=crypto.randomUUID(),base={id,call_id:crypto.randomUUID(),request_id:requestId,revision:1,kind,store:'hortimatic',resource,operation,fields,...(recordId?{record_id:String(recordId)}:{})};
 const journal={lookup:async()=>entries.get(requestId)||null,claim:async(signature,record_id,data={})=>{if(entries.has(requestId))return entries.get(requestId);entries.set(requestId,{signature,record_id,status:'pending',...data});return {status:'claimed'};},complete:async(signature,record_id)=>{assert.equal(entries.get(requestId).signature,signature);Object.assign(entries.get(requestId),{status:'completed',record_id});},uncertain:async(signature,record_id)=>{Object.assign(entries.get(requestId),{status:'uncertain',record_id});}};
 const options={request,resolve:async()=>['8.8.8.8'],journal};const prepared=await writeContactDirectory(connection,{...base,action:'prestashop_directory_prepare'},options);assert(prepared.can_commit);const result=await writeContactDirectory(connection,{...base,action:'prestashop_directory_commit',confirmed:true,fingerprint:prepared.fingerprint},options);assert(result.verified);assert(result.persisted||result.unchanged);assert(!JSON.stringify(result).includes('passwd'));return result;
}
test('REAL isolated native customer, address, brand and attribute CRUD',async()=>{
 const suffix=Date.now();const customer=await publish('clientes','customers','create',{firstname:'Totus',lastname:'Directorio',email:'directory-'+suffix+'@example.invalid',active:'1'});
 await publish('clientes','customers','update',{firstname:'Nombre revisado'},customer.record_id);
 const countries=await (await request('https://hortimatic.com/api/countries?output_format=JSON&display=[id]&limit=0,1',{headers:{authorization:'Basic '+btoa(key+':')}})).json();assert(countries.countries?.[0]?.id);
 const address=await publish('clientes','addresses','create',{id_customer:customer.record_id,id_country:String(countries.countries[0].id),firstname:'Totus',lastname:'Directorio',alias:'Trabajo '+suffix,address1:'Calle de prueba 1',city:'Madrid',postcode:'28001'});
 await publish('clientes','addresses','delete',{},address.record_id);await publish('clientes','customers','delete',{},customer.record_id);
 const brand=await publish('marcas','manufacturers','create',{name:'Marca CI '+suffix,active:'1'});await publish('marcas','manufacturers','update',{name:'Marca revisada CI '+suffix},brand.record_id);await publish('marcas','manufacturers','delete',{},brand.record_id);
 const group=await publish('atributos','product_options','create',{name:'Atributo CI '+suffix,public_name:'Color CI '+suffix,group_type:'select'});await publish('atributos','product_option_values','create',{name:'Azul CI '+suffix,id_attribute_group:group.record_id});await publish('atributos','product_options','delete',{},group.record_id);
 assert(counts.POST>=5&&counts.PUT>=2&&counts.DELETE>=4);console.log('Verified isolated native calls',counts);
});
