import assert from 'node:assert/strict';
import {APPEARANCE_FIELDS,appearanceValues,appearanceVariables,loginVariables,contrastText} from '../src/appearance-core.js';
assert.equal(Object.keys(APPEARANCE_FIELDS.interfaz).length,37);
assert.equal(Object.keys(APPEARANCE_FIELDS.login).length,29);
assert.equal(appearanceValues('interfaz',{fontSize:999,primary:'red;background:url(x)',theme:'x'}).fontSize,16);
assert.equal(appearanceValues('interfaz',{primary:'red;background:url(x)'}).primary,'#2563eb');
assert.equal(appearanceValues('login',{customLogoData:'data:image/svg+xml;base64,AAAA'}).customLogoData,'');
assert(!Object.hasOwn(appearanceValues('interfaz',{role:'admin'}),'role'));
assert.equal(appearanceVariables({sidebarWidth:300})['--sidebar'],'300px');
assert.equal(loginVariables({loginCardOpacity:50})['--login-card-bg'],'#ffffff7f');
assert.equal(loginVariables({loginBackground:'uploaded',customBackgroundData:'javascript:x'})['--login-bg'].startsWith('linear-gradient'),true);
console.log('Appearance QA: all options, validation, ranges, no CSS/image injection, login backgrounds OK');

assert.equal(contrastText('#ffffff'),'#000000');assert.equal(contrastText('#000000'),'#ffffff');
assert(!appearanceVariables({shadow:'none',cardGlow:12})['--shadow'].startsWith('none,'));
