import test from 'node:test';
import assert from 'node:assert/strict';
import {cataloguePreferences,cataloguePreferencesFromForm,catalogueFilters,visibleCatalogueCategories,catalogueDetails,cataloguePreferencesHtml,variantDetails} from '../src/totustpv/catalogue-preferences.js';
import {createCatalogueTable} from '../src/totustpv/catalogue-table.js';
test('catalogue filters are bounded presentation choices, with no stock or permission override',()=>{
 assert.deepEqual(cataloguePreferences(),{hideUnavailable:false,excludedCategories:[],extraDetails:false});
 assert.deepEqual(catalogueFilters({hideUnavailable:true,excludedCategories:[4,2]}),{hideUnavailable:true,excludedCategories:[2,4]});
 for(const value of [{allowOutOfStock:true},{hideUnavailable:'true'},{extraDetails:1},{excludedCategories:[2,2]},{excludedCategories:[0]},{excludedCategories:['2']},{excludedCategories:[2147483648]},{excludedCategories:Array.from({length:101},(_,n)=>n+1)}])assert.throws(()=>cataloguePreferences(value));
 assert.throws(()=>catalogueFilters({extraDetails:true}));
});
test('category visibility hides descendants, handles missing roots and never loops on malformed metadata',()=>{
 const rows=[{id:2,parentId:1},{id:3,parentId:2},{id:4,parentId:3},{id:5,parentId:1}];
 assert.deepEqual(visibleCatalogueCategories(rows,[3]).map(r=>r.id),[2,5]);assert.deepEqual(visibleCatalogueCategories(rows,[1]),[]);
 assert.deepEqual(visibleCatalogueCategories([{id:2,parentId:3},{id:3,parentId:2}],[]).map(r=>r.id),[2,3]);
 assert.deepEqual(visibleCatalogueCategories(rows,[]),rows);
 assert.deepEqual(visibleCatalogueCategories([{id:2,parentId:1,treeLeft:2,treeRight:9},{id:4,parentId:3,treeLeft:4,treeRight:5},{id:5,parentId:1,treeLeft:10,treeRight:11}],[2]).map(row=>row.id),[5],'Native tree bounds preserve exclusions through an inactive parent omitted from the list');
});
test('form choices retain multiple and empty exclusions and additional data is escaped by the renderer',()=>{
 const form=new FormData();form.append('excludedCategories','4');form.append('excludedCategories','2');form.set('extraDetails','on');
 assert.deepEqual(cataloguePreferencesFromForm(form),{hideUnavailable:false,excludedCategories:[2,4],extraDetails:true});
 assert.deepEqual(cataloguePreferencesFromForm(new Map([['excludedCategories',[]]])).excludedCategories,[]);
 const html=cataloguePreferencesHtml({},[{id:2,label:'<img src=x>'}]);assert.match(html,/&lt;img src=x&gt;/);assert.equal(html.includes('<img'),false);
 assert.equal(catalogueDetails({manufacturer:'Marca',supplier:'Proveedor',isbn:'9780306406157',costCents:50}),'Marca: Marca · Proveedor: Proveedor · ISBN: 9780306406157');
});
test('a selectable variant parent does not present its aggregate zero as an unavailable unit',()=>{
 const table=createCatalogueTable();table.setColumns(['name','stock']);const html=table.html([{id:'1:2',name:'Con variantes',chooseVariant:true,stock:0},{id:'2:0',name:'Simple agotado',stock:0}]);
 assert.match(html,/data-tpv-column="stock">Por variante/);assert.match(html,/data-tpv-column="stock">0/);
});
test('variant groups explain choices in cards and tables without interpreting native labels as markup',()=>{
 const row={id:'1:3',name:'Artículo rojo',variantAttributes:[{groupName:'Color',name:'<Rojo>'},{groupName:'Tamaño',name:'M'}]};
 assert.equal(variantDetails(row),'Color: <Rojo> · Tamaño: M');assert.equal(variantDetails({...row,chooseVariant:true}),'');
 const table=createCatalogueTable();table.setColumns(['name']);const html=table.html([row]);
 assert.match(html,/Color: &lt;Rojo&gt; · Tamaño: M/);assert.equal(html.includes('<Rojo>'),false);
});
