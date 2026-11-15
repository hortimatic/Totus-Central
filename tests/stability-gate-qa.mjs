import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {affectedCircuits,validateCircuits,validateCircuitEvolution,removedExports} from '../tools/stability-gate.mjs';
const matrix=JSON.parse(fs.readFileSync('stability/circuits.json','utf8'));
test('a change cannot drop an existing circuit, consumer, check or invariant to turn the gate green',()=>{
 for(const key of ['circuits','paths','tests','invariants']){const next=structuredClone(matrix);if(key==='circuits')next.circuits.pop();else next.circuits[0][key].pop();assert.throws(()=>validateCircuitEvolution(matrix,next),/retirad/);}
 const extended=structuredClone(matrix);extended.circuits[0].tests.push('additional-test.mjs');assert.doesNotThrow(()=>validateCircuitEvolution(matrix,extended));
});
test('assistant bridge changes require expense, receipt and product regression checks',()=>{
 const circuit=affectedCircuits(['supabase/functions/totus-assistant/assistant-operations.ts'],matrix).find(c=>c.id==='conventional-assistant');assert(circuit);
 for(const file of ['tests/assistant-own-auth.mjs','tests/assistant-attachments.mjs','tests/assistant-operations.mjs','tests/stock-workflow-qa.mjs','tests/productos-request-qa.mjs'])assert(circuit.tests.includes(file),file);
});
test('adding an export cannot silently remove a working public entry point',()=>assert.deepEqual(removedExports('export async function createProduct(){} export const editProduct=()=>{}','export async function createProduct(){} export const newFeature=1'),['editProduct']));
test('moving a declaration to a re-export preserves its public contract',()=>assert.deepEqual(removedExports('export const STORES=[]','import {NAMES as STORES} from "./registry.js"; export {STORES};'),[]));
test('all declared circuits refer to existing executable checks',()=>{assert.equal(validateCircuits(matrix),matrix.circuits.length);for(const id of ['access','products','sales','receipts','directories','finance','chat','automation','home','appearance','storage','application-origin'])assert(matrix.circuits.some(c=>c.id===id),'Preserve circuit '+id);});
test('shared PrestaShop read changes cover copy, sales, Home and alerts',()=>{const ids=affectedCircuits(['src/prestashop-readonly.js'],matrix).map(c=>c.id);for(const id of ['products','sales','home','automation'])assert(ids.includes(id));});
test('copy fixes retain all product workflows; docs do not trigger business changes',()=>{assert.deepEqual(affectedCircuits(['src/productos-create-ui.js'],matrix).map(c=>c.id),['products']);assert.deepEqual(affectedCircuits(['docs/manual.md'],matrix),[]);assert.throws(()=>validateCircuits({circuits:[{id:'missing',paths:['src/'],tests:['not-found.mjs'],invariants:['write']}]}),/Falta/);});
