import test from 'node:test';import assert from 'node:assert/strict';
import {budgetDocumentHtml} from '../src/totustpv/budget-document.js';
test('commercial document prints saved amounts and public contact data while excluding internal intent',()=>{
 const document={reference:'P-000001',title:'Oferta <script>',status:'saved',storeName:'Tienda',createdAt:'2026-11-17T10:00:00Z',validUntil:'2026-12-17T10:00:00Z',publicNote:'Recogida\nPor la tarde',payload:{note:'PRIVATE INTERNAL NOTE'},snapshot:{currency:'EUR',totalCents:1602,totalTaxExclCents:1324,merchant:{name:'Comercio',registration:'NIF-FICTICIO'},customer:{name:'Cliente <img onerror=x>',address:'Calle de prueba'},lines:[{name:'Artículo <svg onload=x>',qty:2,unitTaxInclMicros:8012100,lineTaxInclCents:1602}],nativeCartId:999,nativeQuoteFingerprint:'SECRET-NATIVE-HASH'}};
 const html=budgetDocumentHtml(document);assert.ok(html.includes('P-000001'));assert.ok(html.includes('16,02'));assert.ok(html.includes('8,0121'));assert.ok(html.includes('NIF-FICTICIO'));assert.ok(html.includes('Recogida<br>Por la tarde'));
 for(const text of ['<script>','<img','<svg','PRIVATE INTERNAL NOTE','SECRET-NATIVE-HASH','nativeCartId'])assert.equal(html.includes(text),false);
 assert.ok(html.includes('&lt;svg'));assert.ok(html.includes('&lt;img'));assert.ok(budgetDocumentHtml({...document,snapshot:{...document.snapshot,customer:null}}).includes('Cliente de mostrador'));
});
