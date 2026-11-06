import test from 'node:test';
import assert from 'node:assert/strict';
import {prestashopCapabilities,discoverPrestashop} from '../supabase/functions/totus-connections/prestashop.js';

const root='<?xml version="1.0"?><prestashop><api shopName="Prueba"><products xlink:href="https://hortimatic.com/api/products" get="true" put="true" post="false" delete="false" head="true"><description get="true">Descripción</description></products><combinations get="true" post="true" put="true" delete="true" head="true"/><images get="true" post="true" put="false" delete="false"/><custom_resource get="false" post="false" put="false" delete="false"/></api></prestashop>';

test('reconoce los permisos reales de cada recurso, sin inferir escritura por un GET',()=>{
 const result=prestashopCapabilities(root,'1.7.8.11');
 assert.equal(result.version,'1.7.8.11');
 const product=result.resources.find(x=>x.name==='products');
 assert.deepEqual(product.permissions,{GET:true,POST:false,PUT:true,DELETE:false,HEAD:true});
 assert.equal(product.writable,true);
 assert.equal(product.full_crud,false);
 assert.equal(result.resources.find(x=>x.name==='combinations').full_crud,true);
 assert.equal(result.resources.find(x=>x.name==='images').permissions.PUT,false);
 assert.equal(result.resources.find(x=>x.name==='custom_resource').readable,false);
 assert.equal(result.resources.length,4);
});
test('permiso ausente se presenta como denegado, no se inventa acceso',()=>{
 const result=prestashopCapabilities('<prestashop><api><products get="true"/><combinations get="false"/><categories post="true"/></api></prestashop>');
 assert.equal(result.resources[0].permissions.POST,false);
 assert.equal(result.resources[1].permissions.GET,false);
 assert.equal(result.resources[2].permissions.POST,true);
 assert.equal(result.resources[2].readable,false);
});
test('nunca duplica recursos, ni acepta un diagnóstico que no sea el catálogo',()=>{
 assert.throws(()=>prestashopCapabilities('<prestashop><api><products get="true"/><products post="true"/></api></prestashop>'),/duplicado/);
 assert.throws(()=>prestashopCapabilities('<html><body>Inicio de sesión</body></html>'),/Webservice/);
});
test('diagnóstico de permisos: solo GET autenticado y tienda correcta; no altera catálogo',async()=>{
 const connection={name:'PrestaShop · Hortimatic',protocol:'prestashop',enabled:true,verified_revision:2,revision:2,real_data_authorized:true,endpoint:'https://hortimatic.com/api/',auth_kind:'basic',secret:'solo-ficticia'};
 const calls=[];
 const response=await discoverPrestashop(connection,{store:'hortimatic'},{
  resolve:async()=>['8.8.8.8'],
  request:async(url,options)=>{
   calls.push({url,method:options.method,headers:options.headers});
   return new Response(root,{status:200,headers:{'content-type':'application/xml','psws-version':'1.7.8.11'}});
  }
 });
 assert.equal(response.resources.find(x=>x.name==='products').permissions.PUT,true);
 assert.equal(response.resources.find(x=>x.name==='products').permissions.POST,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].method,'GET');
 assert.equal(new URL(calls[0].url).pathname,'/api/');
 assert.ok(calls[0].headers.Authorization.startsWith('Basic '));
 await assert.rejects(()=>discoverPrestashop(connection,{store:'newoldsmok'},{resolve:async()=>['8.8.8.8'],request:async()=>{throw Error('No debería salir');}}),/conexión/);
});
