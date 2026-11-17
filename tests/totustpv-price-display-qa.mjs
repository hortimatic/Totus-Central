import test from 'node:test';
import assert from 'node:assert/strict';
import {displayPreferences,displayPreferencesFromForm,displayPreferencesHtml,cataloguePriceCents,variantOrder,TPV_VARIANT_ORDERS} from '../src/totustpv/display-preferences.js';
import {createCatalogueTable} from '../src/totustpv/catalogue-table.js';
test('tax display uses the two native amounts and never infers a fixed VAT rate',()=>{
 const product={priceCents:801,netPriceCents:662};assert.equal(cataloguePriceCents(product),801);assert.equal(cataloguePriceCents(product,'net'),662);
 assert.equal(cataloguePriceCents({priceCents:801},'net'),null);
 for(const amount of ['662',NaN,Infinity,-1,6.62,Number.MAX_SAFE_INTEGER+1])assert.equal(cataloguePriceCents({netPriceCents:amount},'net'),null);
 assert.equal(cataloguePriceCents({netPriceCents:0},'net'),0);
});
test('saved gross/net choice preserves all previous display preferences and rejects other modes',()=>{
 assert.equal(displayPreferences().priceMode,'gross');assert.equal(displayPreferences({layout:'ticket',priceMode:'net',showStock:false}).layout,'ticket');
 assert.equal(displayPreferencesFromForm(new Map([['layout','catalogue'],['priceMode','net'],['showPrices','on']])).priceMode,'net');
 for(const priceMode of ['unknown',true,4,null])assert.equal(displayPreferences({priceMode}).priceMode,'gross');
 assert.match(displayPreferencesHtml({priceMode:'net'}),/value="net" selected/);
});
test('table retains the existing gross sort and offers a separately labelled native net column',()=>{
 const table=createCatalogueTable();table.setColumns(['name','netPrice','price']);assert.deepEqual(table.columns(),['name','netPrice','price']);
 const html=table.html([{name:'Artículo',priceCents:801,netPriceCents:662}]);assert.match(html,/Precio sin IVA/);assert.match(html,/PVP con IVA/);assert.match(html,/6,62/);assert.match(html,/8,01/);
 assert.equal((html.match(/data-tpv-sort="price"/g)||[]).length,1);
 const missing=table.html([{name:'Artículo',priceCents:801}]);assert.match(missing,/data-tpv-column="netPrice">—/);
});
test('initial variant order has an explicit bounded contract independent of catalogue order',()=>{
 for(const [value] of Object.entries(TPV_VARIANT_ORDERS)){const [field,direction]=value.split(':');assert.deepEqual(variantOrder(value),{field,direction});assert.equal(displayPreferencesFromForm(new Map([['variantOrder',value]])).variantOrder,value);}
 for(const value of [null,true,3,{},['stock:desc'],'cost:desc','stock']){assert.deepEqual(variantOrder(value),{field:'name',direction:'asc'});assert.equal(displayPreferences({variantOrder:value}).variantOrder,'name:asc');}
 assert.match(displayPreferencesHtml({variantOrder:'stock:desc'}),/value="stock:desc" selected/);
});
