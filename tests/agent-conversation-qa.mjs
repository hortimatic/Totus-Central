import test from 'node:test';import assert from 'node:assert/strict';
import {agentRequest} from '../src/agent-conversation.js';
test('short clarification follows the chronological goal and cannot be displaced by the catalogue',()=>{
 const text=agentRequest({current:'Hortimatic',requester:'owner',history:[{author_email:'owner',body:'octubre de 2026'},{author_email:'other',body:'Otro solicitante'},{author_email:'owner',body:'Descarga el Excel de gastos y ventas'}],catalogue:{tools:['diario_mensual']}});
 assert(text.indexOf('Descarga el Excel')<text.indexOf('octubre de 2026'));assert(text.endsWith('Hortimatic'));assert(!text.includes('Otro solicitante'));assert(text.indexOf('diario_mensual')<text.indexOf('PETICIÓN ACTUAL'));
});
test('the goal survives more than six short follow-up messages without assistant claims',()=>{
 const history=[...Array.from({length:9},(_,i)=>({author_email:'owner',body:'aclaración '+i})),{author_email:'bot',body:'Archivo entregado sin prueba'},{author_email:'owner',body:'Necesito mi factura de octubre'}];
 const text=agentRequest({current:'sí',history,requester:'owner'});assert(text.includes('Necesito mi factura'));assert(!text.includes('sin prueba'));assert(text.endsWith('sí'));
});
test('bounded private context does not mutate the original rows',()=>{
 const history=Array.from({length:30},()=>({author_email:'owner',body:'a'.repeat(4000)}));const copy=JSON.stringify(history);const text=agentRequest({current:'actual',history,requester:'owner'});assert(text.length<20000);assert.equal(JSON.stringify(history),copy);
});
