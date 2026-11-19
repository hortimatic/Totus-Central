import test from 'node:test';import assert from 'node:assert/strict';import {signatureOptions,signatureOptionsFromForm,signatureOptionsHtml} from '../src/totustpv/signature-options.js';
test('signature collection defaults off, requires explicit booleans and escapes its configurable text',()=>{
 assert.deepEqual(signatureOptions(),{enabled:false,acceptanceText:''});
 const value=signatureOptionsFromForm(new Map([['signatureEnabled','on'],['signatureAcceptanceText','<img src=x> "Recepcion"']]));assert.equal(value.enabled,true);
 const html=signatureOptionsHtml(value,false);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img|type="submit"/);assert.match(html,/disabled/);
 for(const invalid of [{enabled:'true',acceptanceText:''},{enabled:true,acceptanceText:'x'.repeat(501)},{enabled:true,acceptanceText:'a\nb'},{enabled:true,acceptanceText:'',password:'x'}])assert.throws(()=>signatureOptions(invalid));
});
