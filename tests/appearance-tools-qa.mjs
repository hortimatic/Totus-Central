import assert from 'node:assert/strict';
import {LOGIN_STYLE_PRESETS,settingsSearchText} from '../src/appearance-tools.js';
import {APPEARANCE_FIELDS,appearanceValues} from '../src/appearance-core.js';
assert.equal(settingsSearchText(' NAVEGACIÓN '),'navegacion');
for(const preset of Object.values(LOGIN_STYLE_PRESETS)){
 for(const key of Object.keys(preset))assert(APPEARANCE_FIELDS.login[key],key);
 const saved=appearanceValues('login',{loginBrandName:'Conservar marca',customLogoData:'data:image/png;base64,AAAA',...preset});
 assert.equal(saved.loginBrandName,'Conservar marca');assert.equal(saved.customLogoData,'data:image/png;base64,AAAA');
 for(const [key,value] of Object.entries(preset))assert.equal(saved[key],value,key);
}
console.log('APPEARANCE TOOLS: accent-independent search and presets use existing validated fields and preserve branding.');
