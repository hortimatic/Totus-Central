import assert from 'node:assert/strict';
import {initialInterfaceStyle,styleName,interfaceStylesSettings,acceptInterfaceStyles} from '../src/appearance-styles.js';
const previous={cardGlow:24,borderWidth:3,fontSize:16,customBackgroundData:'data:image/png;base64,AAAA',backgroundMode:'image',brandName:'Mi marca',navigationOrder:'cajas,inicio',startModule:'cajas'};
const style=initialInterfaceStyle('totus',previous);
assert.equal(style.cardGlow,0);assert.equal(style.borderWidth,1);assert.equal(style.fontSize,14);assert.equal(style.backgroundMode,'color');assert.equal(style.customBackgroundData,'');assert.equal(style.brandName,'Mi marca');assert.equal(style.startModule,'cajas');assert.equal(style.navigationOrder,'cajas,inicio');
assert.equal(initialInterfaceStyle('newoldsmok',previous).theme,'dark');assert.throws(()=>initialInterfaceStyle('__proto__',previous));assert.equal(styleName('  Oficina  '),'Oficina');assert.throws(()=>styleName(' '));
const state={user:{id:'a'},data:{profiles:[{id:'a',ui_preferences:{interface:{revision:1}}},{id:'b',ui_preferences:{}}]}};
acceptInterfaceStyles(state,{revision:1,items:[{name:'A'}]},'a');assert.equal(interfaceStylesSettings(state).items[0].name,'A');assert.equal(state.data.profiles[0].ui_preferences.interface.revision,1);state.user.id='b';assert.deepEqual(interfaceStylesSettings(state).items,[]);assert.throws(()=>acceptInterfaceStyles(state,{},'a'),/sesión/);
console.log('Interface styles: complete visual reset, personal identity/order, isolated library and session guard OK');
