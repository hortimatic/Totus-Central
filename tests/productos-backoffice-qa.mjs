import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeBackofficeLink,saveBackofficeLink,productBackofficeUrl} from '../src/productos-backoffice.js';
test('native backend link stays in its shop and session, without dashboard tokens or foreign paths',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)};
 const input='https://newoldsmok.com/admin777/index.php/sell/catalog/products/42?_token=fictional-session&extra=discard';
 saveBackofficeLink(input,'newoldsmok','owner',storage);
 assert.equal(productBackofficeUrl({id:'55'},'newoldsmok','owner',storage),'https://newoldsmok.com/admin777/index.php/sell/catalog/products/55?_token=fictional-session');
 assert.equal(productBackofficeUrl({id:'55'},'newoldsmok','other',storage),'');
 assert.equal(productBackofficeUrl({},'newoldsmok','owner',storage),'');
 assert.throws(()=>normalizeBackofficeLink(input,'hortimatic'),/tienda/);
 assert.throws(()=>normalizeBackofficeLink('https://newoldsmok.com/admin777/index.php?controller=AdminDashboard&token=fake','newoldsmok'),/Inicio/);
 assert.throws(()=>normalizeBackofficeLink('https://newoldsmok.com/admin777/index.php/sell/catalog/products','newoldsmok'),/_token/);
 assert.throws(()=>normalizeBackofficeLink('https://user:pass@newoldsmok.com/admin777/index.php/sell/catalog/products?_token=fake','newoldsmok'),/tienda/);
});
