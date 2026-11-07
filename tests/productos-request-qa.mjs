import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProductRequest,renderProductRequestForm} from '../src/productos-request.js';
test('encargo desde URL conserva tienda, precios y medidas sin inventar datos ni imágenes',()=>{
 const result=buildProductRequest({operation:'url',store:'ambas',url:'https://proveedor.example/producto',cost:'3,90',sale:'12.00',weight:'0.2',images:'https://proveedor.example/a.png'});
 assert.match(result,/Hortimatic y NewOldSmok/);assert.match(result,/3,90/);assert.match(result,/state=1/);assert.match(result,/no generes imágenes/i);assert.match(result,/dos recorridos independientes/);
 assert.throws(()=>buildProductRequest({operation:'url',store:'hortimatic',url:'javascript:bad'}),/HTTPS/);
 assert.throws(()=>buildProductRequest({operation:'url',store:'hortimatic',url:'https://user:pass@example.com/a'}),/credenciales/);
 assert.throws(()=>buildProductRequest({operation:'url',store:'hortimatic',url:'https://proveedor.example/a',sale:'-1'}),/Precio/);
});
test('variación existente exige tienda única, ID y atributos y conserva publicación',()=>{
 const result=buildProductRequest({operation:'variation',store:'newoldsmok',product_id:'123',variants:'Color azul, 2 L'});
 assert.match(result,/existing_product:true/);assert.match(result,/No vuelvas a crear la base/);assert.match(result,/Conserva publicación/);
 assert.throws(()=>buildProductRequest({operation:'variation',store:'ambas',product_id:'123',variants:'Azul'}),/tienda y el ID/);
 assert.throws(()=>buildProductRequest({operation:'variation',store:'newoldsmok',product_id:'123'}),/atributos/);
});
test('formulario escapa datos y presenta unidades, campos mínimos y petición copiable',()=>{
 const html=renderProductRequestForm({operation:'url',store:'hortimatic',name:'<script>alert(1)</script>'},'Una petición');
 assert(!html.includes('<script>'));assert.match(html,/Peso \(kg\)/);assert.match(html,/Anchura \(cm\)/);assert.match(html,/Copiar para ChatGPT/);assert.match(html,/readonly/);
});
