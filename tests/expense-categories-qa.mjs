import assert from 'node:assert/strict';
import {expenseCategoryTree,expenseCategoryOptions,expenseCategoryCode,isInternalExpenseCategory,validateExpenseCategoryHierarchy} from '../src/expense-categories.js';
import {validateExpenseClassification} from '../src/calculations.js';
const cats=[
 {id:'root-a',code:'MERCH',name:'Mercancía',active:true,sort_order:1,parent_id:null},
 {id:'child-a',code:'MERCH_1',name:'Resistencias',active:true,sort_order:2,parent_id:'root-a'},
 {id:'child-b',code:'MERCH_2',name:'Dispositivos',active:false,sort_order:1,parent_id:'root-a'},
 {id:'root-int',code:'INTERNAL_WAREHOUSE',name:'Coste interno',active:true,sort_order:2,parent_id:null},
 {id:'child-int',code:'ALMACEN_300',name:'Almacén auxiliar',active:true,sort_order:1,parent_id:'root-int'}
];
const tree=expenseCategoryTree(cats);
assert.equal(tree.length,2);
assert.deepEqual(tree[0].children.map(x=>x.id),['child-b','child-a']);
const opts=expenseCategoryOptions(cats);
assert(opts.find(x=>x.value==='child-a')?.label.includes('Mercancía → Resistencias'));
assert(!opts.some(x=>x.value==='child-b'));
assert(expenseCategoryOptions(cats,'child-b').some(x=>x.value==='child-b'));
assert.equal(expenseCategoryCode(cats,'child-a'),'MERCH');
assert(isInternalExpenseCategory(cats,'child-int'));
assert.throws(()=>validateExpenseClassification([{category_id:'child-int',deductible_irpf:true,deductible_pct:100}],cats,false),/solo de control interno/i);
assert.equal(validateExpenseClassification([{category_id:'child-int',deductible_irpf:false,deductible_pct:0}],cats,true),true);
assert.throws(()=>validateExpenseCategoryHierarchy(cats,{id:'root-a',parent_id:'root-a'}),/propia subcategoría/);
assert.throws(()=>validateExpenseCategoryHierarchy(cats,{id:'test',parent_id:'child-a'}),/Solo se permite un nivel/);
assert.throws(()=>validateExpenseCategoryHierarchy(cats,{id:'root-a',parent_id:'root-int'}),/ya tiene subcategorías/);
assert.equal(validateExpenseCategoryHierarchy(cats,{parent_id:'root-a'}),true);
console.log('CATEGORY HIERARCHY QA: two levels, inactive history, internal inheritance, ordering and cycles OK');