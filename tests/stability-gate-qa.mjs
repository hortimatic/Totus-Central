import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {affectedCircuits,validateCircuits,removedExports} from '../tools/stability-gate.mjs';
const matrix=JSON.parse(fs.readFileSync('stability/circuits.json','utf8'));
test('adding an export cannot silently remove a working public entry point',()=>assert.deepEqual(removedExports('export async function createProduct(){} export const editProduct=()=>{}','export async function createProduct(){} export const newFeature=1'),['editProduct']));
test('moving a declaration to a re-export preserves its public contract',()=>assert.deepEqual(removedExports('export const STORES=[]','import {NAMES as STORES} from "./registry.js"; export {STORES};'),[]));
test('all declared circuits refer to existing executable checks',()=>assert.equal(validateCircuits(matrix),11));
test('shared PrestaShop read changes cover copy, sales, Home and alerts',()=>{const ids=affectedCircuits(['src/prestashop-readonly.js'],matrix).map(c=>c.id);for(const id of ['products','sales','home','automation'])assert(ids.includes(id));});
test('copy fixes retain all product workflows; docs do not trigger business changes',()=>{assert.deepEqual(affectedCircuits(['src/productos-create-ui.js'],matrix).map(c=>c.id),['products']);assert.deepEqual(affectedCircuits(['docs/manual.md'],matrix),[]);assert.throws(()=>validateCircuits({circuits:[{id:'missing',paths:['src/'],tests:['not-found.mjs'],invariants:['write']}]}),/Falta/);});
