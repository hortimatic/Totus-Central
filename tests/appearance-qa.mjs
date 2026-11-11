import assert from 'node:assert/strict';
import {APPEARANCE_FIELDS,appearanceValues,appearanceVariables,loginVariables,contrastText} from '../src/appearance-core.js';
for(const key of ['navigationOrder','navigationCollapsed','navigationBackground','navigationText','navigationSectionText','navigationActive'])assert(APPEARANCE_FIELDS.interfaz[key],key);
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

assert.equal(appearanceValues('interfaz',{startModule:'unknown',navigationMode:'bad'}).startModule,'inicio');
assert.equal(appearanceValues('interfaz',{navigationMode:'compact'}).navigationMode,'compact');

assert.equal(appearanceVariables({navigationActive:'#ffffff'})['--appearance-nav-active-ink'],'#000000');
assert.equal(appearanceVariables({navigationActive:'#000000'})['--appearance-nav-active-ink'],'#ffffff');

import {contrastRatio,appearanceContrastChecks,improveAppearanceContrast} from '../src/appearance-contrast.js';
assert.equal(contrastRatio('#ffffff','#000000'),21);
assert.equal(contrastRatio('#000000','#ffffff'),21);
assert(contrastRatio('#888888','#ffffff')<4.5);
const unreadable=appearanceValues('interfaz',{card:'#ffffff',surface:'#ffffff',text:'#ffffff',muted:'#dddddd',navigationBackground:'#ffffff',navigationText:'#ffffff',navigationSectionText:'#dddddd'});
assert(appearanceContrastChecks(unreadable).some(check=>!check.ok));
const corrected=improveAppearanceContrast(unreadable);
assert(appearanceContrastChecks(corrected).every(check=>check.ok),'Default black and white candidates must correct legibility on uniform surfaces');
assert.equal(corrected.card,unreadable.card,'A contrast correction cannot recolour cards');
assert.equal(corrected.navigationBackground,unreadable.navigationBackground,'A contrast correction cannot recolour navigation background');
const safe=appearanceValues('interfaz',{card:'#ffffff',surface:'#ffffff',text:'#0f172a',muted:'#334155',navigationBackground:'#0b1228',navigationText:'#ffffff',navigationSectionText:'#cbd5e1'});
assert.deepEqual(improveAppearanceContrast(safe),safe,'Readable custom colours must be kept');

import {APPEARANCE_EXTENDED_KEYS,appearanceExtendedDefaults} from '../src/appearance-core.js';
assert.equal(APPEARANCE_EXTENDED_KEYS.length,15);
for(const key of APPEARANCE_EXTENDED_KEYS){assert.equal(APPEARANCE_FIELDS.interfaz[key].type,'color',key);assert.match(appearanceValues('interfaz',{theme:'dark'})[key],/^#[0-9a-f]{6}$/i,key);}
assert.equal(appearanceValues('interfaz',{headingText:'not-a-hex'}).headingText,APPEARANCE_FIELDS.interfaz.headingText.value);
assert.equal(appearanceValues('interfaz',{theme:'dark',surface:'#08152b',card:'#18263f',text:'#f0f5ff'}).topbarBackground,'#08152b','Saved old dark accounts keep the prior surface color');
assert.equal(appearanceValues('interfaz',{theme:'dark',surface:'#08152b',card:'#18263f',text:'#f0f5ff'}).inputBackground,'#18263f','Dark forms keep old card color');
assert.equal(appearanceVariables({tableHeadBackground:'#123456'})['--appearance-table-head-bg'],'#123456');
assert.equal(appearanceVariables({headingText:'#112233'})['--appearance-heading-ink'],'#112233');
assert.equal(appearanceVariables({secondaryButtonBackground:'#123456',secondaryButtonText:'#fefefe'})['--appearance-secondary-bg'],'#123456');
assert.equal(appearanceExtendedDefaults('light').noteBackground,'#f6f8fb');

assert.equal(appearanceValues('interfaz',null).topbarBackground,'#ffffff','Null profile during logout must keep default appearance');
assert.equal(appearanceVariables(null)['--appearance-topbar-bg'],'#ffffff','Null appearance must not throw on sign-out');
