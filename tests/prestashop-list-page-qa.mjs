import assert from 'node:assert/strict';
import {listPage,productCategoryIds,catalogCategoryChoices,filterCatalogRows} from '../src/prestashop-list-page.js';
const rows=Array.from({length:135},(_,id)=>({id:String(id),name:'Producto '+id,active:id%2?'1':'0',id_category_default:id%2?'2':'1',associations:{categories:['3']}}));
assert.equal(listPage(rows).rows.length,20);assert.equal(listPage(rows,{size:'50',page:2}).rows.length,35);assert.equal(listPage(rows,{size:'100',page:100}).page,1);assert.equal(listPage(rows,{size:'all'}).rows.length,135);assert.equal(listPage([]).start,0);assert.equal(listPage([]).pages,1);assert.equal(listPage(rows,{size:'bad',page:-4}).size,'20');
assert.deepEqual(productCategoryIds(rows[0]),['1','3']);assert.equal(filterCatalogRows(rows,{category:'2'}).length,67);assert.equal(filterCatalogRows(rows,{category:'1',active:'1'}).length,0);assert.equal(filterCatalogRows(rows,{query:'Producto 134'}).length,1);
assert(catalogCategoryChoices(rows,[{id:'1',name:'Primera'}]).some(([id,name])=>id==='1'&&name==='Primera'));
console.log('List pages: 20/50/100/all, clamping, empty results, categories and combined filters OK');
