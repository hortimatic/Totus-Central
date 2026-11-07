import assert from 'node:assert/strict';
import test from 'node:test';
import {validateProductWriteRequest,selectedXmlValues,sha256Text} from '../src/productos-write-contract.js';
import {runPrestashopProductWrite as runWrite} from '../supabase/functions/totus-connections/prestashop-write.js';
const UUID='11111111-1111-4111-8111-111111111111';
const X='<?xml version="1.0"?><prestashop><product><id><![CDATA[19]]></id><reference><![CDATA[REF-1]]></reference><price><![CDATA[12.900000]]></price><name><language id="1"><![CDATA[Nombre]]></language><language id="2"><![CDATA[Name]]></language></name><associations><categories><category><id><![CDATA[33]]></id></category></categories><images><image><id><![CDATA[99]]></id></image></images></associations></product></prestashop>';
const input=(action='prestashop_product_prepare',changes=[{field:'price',value:'13.50'}])=>({action,store:'hortimatic',resource:'products',record_id:'19',id:UUID,call_id:UUID,revision:4,changes});
const connection={protocol:'prestashop',name:'PrestaShop · Hortimatic',enabled:true,verified_revision:4,revision:4,real_data_authorized:true,endpoint:'https://hortimatic.com/api',secret:'fake'};
const response=x=>new Response(x,{status:200,headers:{'content-type':'application/xml'}});
const runPrestashopProductWrite=(connection,input,options)=>runWrite(connection,input,{...options,request:async(url,opts)=>{
 if(new URL(url).pathname==='/api/languages')return response('<prestashop><languages><language id="1"/><language id="2"/></languages></prestashop>');
 if(input.resource==='products')assert.equal(new URL(url).searchParams.get('language'),'[1|2]');
 return options.request(url,opts);
}});
const resolve=async()=>['8.8.8.8'];
const journal=()=>({lookup:async()=>null,claim:async()=>({status:'claimed'}),complete:async()=>{},uncertain:async()=>{}});
test('validación rechaza IDs, stock, valores inválidos y duplicaciones',()=>{
 assert.equal(validateProductWriteRequest(input()).changes[0].field,'price');
 for(const c of [{field:'id_category_default',value:'3'},{field:'price',value:'-10'},{field:'active',value:'yes'},{field:'associations',value:'hack'}])
  assert.throws(()=>validateProductWriteRequest(input('prestashop_product_prepare',[c])),/no habilitado|no válido|no admitido/);
 assert.throws(()=>validateProductWriteRequest({...input(),endpoint:'https://wrong.invalid'}),/no admitidos/);
 assert.throws(()=>validateProductWriteRequest(input('prestashop_product_prepare',[{field:'name',value:'Sin idioma'}])),/idioma real/);
 assert.throws(()=>validateProductWriteRequest(input('prestashop_product_prepare',[{field:'reference',value:'A'},{field:'reference',value:'B'}])),/repetido/);
});
test('XML preserva todas las asociaciones e idiomas no seleccionados',()=>{
 const r=selectedXmlValues(X,'products','19',[{field:'price',value:'13.50'},{field:'name',language_id:'1',value:'Nuevo & <b>nombre</b> ]]> final'}]);
 assert.equal(r.changes[0].before,'12.900000');
 assert.ok(r.patched.includes('<price><![CDATA[13.50]]></price>'));
 assert.ok(r.patched.includes(']]]]><![CDATA[>'));
 assert.ok(r.patched.includes('<language id="2"><![CDATA[Name]]></language>'));
 assert.equal(r.patched.slice(r.patched.indexOf('<associations>')),X.slice(X.indexOf('<associations>')));
 assert.deepEqual(selectedXmlValues(r.patched,'products','19',r.changes).changes.map(x=>x.changed),[false,false]);
 assert.throws(()=>selectedXmlValues(X,'products','20',[{field:'price',value:'1'}]),/no corresponde/);
 assert.throws(()=>selectedXmlValues(X,'products','19',[{field:'name',language_id:'8',value:'Otro'}]),/Idioma 8/);
});
test('preparación consulta sin PUT y devuelve solo diferencias sin XML',async()=>{
 const calls=[];
 const result=await runPrestashopProductWrite(connection,input(),{env:{get:()=>''},resolve,request:async(url,opt)=>{calls.push(opt.method);return response(X);}});
 assert.deepEqual(calls,['GET']);assert.equal(result.persisted,false);assert.equal(result.can_commit,false);
 assert.equal(result.fingerprint,await sha256Text(X));assert.equal(result.changes[0].before,'12.900000');
 assert.ok(!JSON.stringify(result).includes('<prestashop'));
});
test('commit no habilitado se bloquea antes de ninguna llamada',async()=>{
 let count=0;
 const fingerprint=await sha256Text(X);
 await assert.rejects(()=>runPrestashopProductWrite(connection,{...input('prestashop_product_commit'),expected_fingerprint:fingerprint,request_id:UUID,confirmed:true},{env:{get:()=>''},resolve,request:async()=>{count++;return response(X);}}),/bloqueada/);
 assert.equal(count,0);
});
test('PUT ficticio con relectura verificada y comprobación de huella',async()=>{
 let current=X;const methods=[];
 const c={...input('prestashop_product_commit'),expected_fingerprint:await sha256Text(X),request_id:UUID,confirmed:true};
 const result=await runPrestashopProductWrite(connection,c,{journal:journal(),env:{get:()=> '1'},resolve,request:async(_url,opt)=>{
  methods.push(opt.method);if(opt.method==='PUT')current=opt.body;return response(current);
 }});
 assert.equal(result.persisted,true);assert.equal(result.verified,true);
 assert.deepEqual(methods,['GET','GET','PUT','GET']);
 assert.ok(current.includes('<category><id><![CDATA[33]]></id>'));
});
test('huella obsoleta cancela sin PUT',async()=>{
 const methods=[],c={...input('prestashop_product_commit'),expected_fingerprint:await sha256Text(X),request_id:UUID,confirmed:true};
 await assert.rejects(()=>runPrestashopProductWrite(connection,c,{journal:journal(),env:{get:()=> '1'},resolve,request:async(_url,opt)=>{methods.push(opt.method);return response(X.replace('12.900000','13.900000'));}}),/ha cambiado/);
 assert.deepEqual(methods,['GET']);
});
test('respuesta PUT incierta no declara resultado completado',async()=>{
 let times=0;
 const c={...input('prestashop_product_commit'),expected_fingerprint:await sha256Text(X),request_id:UUID,confirmed:true};
 await assert.rejects(()=>runPrestashopProductWrite(connection,c,{journal:journal(),env:{get:()=> '1'},resolve,request:async(_url,opt)=>{times++;if(times===4)throw Error('red');return response(X);}}),/Estado incierto/);
});


test('variaciones: precio de impacto negativo y padre obligatorio; no se puede editar producto ajeno',async()=>{
 const combination='<prestashop><combination><id><![CDATA[200]]></id><id_product><![CDATA[55]]></id_product><price><![CDATA[1.500000]]></price><reference><![CDATA[VAR-10]]></reference><minimal_quantity><![CDATA[1]]></minimal_quantity></combination></prestashop>';
 const args={...input(),store:'newoldsmok',resource:'combinations',record_id:'200',expected_product_id:'55',changes:[{field:'price',value:'-1.25'}]};
 assert.equal(validateProductWriteRequest(args).changes[0].value,'-1.25');
 assert.throws(()=>validateProductWriteRequest({...args,expected_product_id:'66',changes:[{field:'id_product',value:'1'}]}),/no habilitado/);
 assert.throws(()=>validateProductWriteRequest({...args,expected_product_id:null}),/producto/);
 assert.throws(()=>selectedXmlValues(combination,'combinations','200',args.changes,'44'),/no pertenece/);
 const shop={...connection,name:'PrestaShop · NewOldSmok',endpoint:'https://newoldsmok.com/api'};
 const r=await runPrestashopProductWrite(shop,args,{resolve,env:{get:()=>''},request:async()=>response(combination)});
 assert.equal(r.persisted,false);assert.equal(r.changes[0].value,'-1.25');
});

test('PUT 500 reconciles only after exact readback and replay never writes twice',async()=>{
 let current=X,status=null,count=0;
 const j={lookup:async()=>status,claim:async()=>{status={status:'pending'};return {status:'claimed'};},complete:async()=>{status={status:'completed'};},uncertain:async()=>{status={status:'uncertain'};}};
 const args={...input('prestashop_product_commit'),expected_fingerprint:await sha256Text(X),request_id:UUID,confirmed:true};
 const opts={journal:j,env:{get:()=> '1'},resolve,request:async(_url,opt)=>{if(opt.method==='PUT'){count++;current=opt.body;return new Response('native serialization error',{status:500});}return response(current);}};
 const first=await runPrestashopProductWrite(connection,args,opts);assert.equal(first.reconciled,true);assert.equal(first.verified,true);
 assert.equal((await runPrestashopProductWrite(connection,args,opts)).replayed,true);assert.equal(count,1);
});

test('edición de traducción usa el idioma elegido tanto en GET como PUT y relectura',async()=>{
 let current=X;const calls=[];
 const request=async(url,opts)=>{assert.equal(new URL(url).searchParams.get('language'),'[1|2]');calls.push(opts.method);if(opts.method==='PUT')current=opts.body;return response(current);};
 const prepared=await runPrestashopProductWrite(connection,input('prestashop_product_prepare',[{field:'name',language_id:'2',value:'Corrected translation'}]),{request,resolve,env:{get:()=> '1'}});
 const done=await runPrestashopProductWrite(connection,{...input('prestashop_product_commit',[{field:'name',language_id:'2',value:'Corrected translation'}]),request_id:UUID,expected_fingerprint:prepared.fingerprint,confirmed:true},{request,resolve,env:{get:()=> '1'},journal:journal()});
 assert.equal(done.verified,true);assert.equal(calls.filter(m=>m==='PUT').length,1);assert.match(current,/CDATA\[Nombre\]/);
});


test('edita productos sin imagen sin invocar getters calculados de portada',async()=>{
 const request=async(url)=>{const display=new URL(url).searchParams.get('display');assert(display?.includes('categories[id]'));assert(!display.includes('id_default_image'));assert(!display.includes('id_default_combination'));return response(X);};
 assert.equal((await runPrestashopProductWrite(connection,input(),{request,resolve,env:{get:()=>''}})).persisted,false);
});
