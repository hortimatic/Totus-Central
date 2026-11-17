import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedQuantity} from '../src/totustpv/quantity-picker.js';
import {displayPreferences,displayPreferencesFromForm,displayPreferencesHtml} from '../src/totustpv/display-preferences.js';
test('explicit quantity accepts whole units inside product and ticket limits',()=>{
 assert.equal(selectedQuantity('3',2,8),3);assert.equal(selectedQuantity('0002',2,8),2);assert.equal(selectedQuantity('10000',1,10000),10000);
 for(const value of ['0','1','9','2.5','1e2','Infinity','-2','+2',' 2',2,true,null])assert.throws(()=>selectedQuantity(value,2,8));
 for(const [min,max] of [[0,8],[1,10001],[3,2],[1,NaN],[1.5,8]])assert.throws(()=>selectedQuantity('3',min,max));
});
test('quantity choice defaults off and only the boolean preference enables it',()=>{
 assert.equal(displayPreferences().requireQuantity,false);assert.equal(displayPreferences({requireQuantity:true}).requireQuantity,true);
 assert.equal(displayPreferences({requireQuantity:'true'}).requireQuantity,false);
 assert.equal(displayPreferencesFromForm(new Map([['requireQuantity','on']])).requireQuantity,true);
 assert.equal(displayPreferencesFromForm(new Map()).requireQuantity,false);
 assert.match(displayPreferencesHtml({requireQuantity:true}),/name="requireQuantity" checked/);
});
