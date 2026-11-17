import assert from 'node:assert/strict';
import {MODULE_PATHS,moduleNavigationState,moduleUrl,requestedModule,nativeModuleClick,moduleReads,adminSectionFromUrl,drawerManagementUrl} from '../src/module-navigation.js';
assert.equal(drawerManagementUrl('https://example.invalid/central/tpv?token=private'),'https://example.invalid/central/administracion?section=negocio');
assert.equal(adminSectionFromUrl('https://example.invalid/administracion?section=unknown'),null);
assert.equal(moduleUrl('https://example.invalid/administracion?section=negocio&token=private','inicio'),'https://example.invalid/inicio');
assert.equal(moduleUrl('https://example.invalid/administracion?section=negocio&token=private','administracion'),'https://example.invalid/administracion?section=negocio');
assert.equal(new URL(drawerManagementUrl('https://example.invalid/tests/app-mock.html')).searchParams.get('module'),'administracion');
const routes=[{id:'inicio'},{id:'gastos'}];
const clean=new URL(moduleUrl('https://example.invalid/?v=old&utm_source=chatgpt.com&utm_campaign=x&ps_order=7&ps_store=hortimatic#retorno','inicio'));
assert.equal(clean.searchParams.has('utm_source'),false);assert.equal(clean.searchParams.has('v'),false);assert.equal(clean.search,'');assert.equal(clean.hash,'');assert.equal(clean.pathname,'/inicio');
const url=moduleUrl('https://example.invalid/Totus-Central/?release=abc','gastos');
assert.equal(new URL(url).searchParams.has('release'),false);assert.equal(requestedModule(url,routes),'gastos');
assert.equal(requestedModule('https://example.invalid/?module=unknown',routes),'inicio');
for(const field of ['ctrlKey','metaKey','shiftKey','altKey'])assert(nativeModuleClick({button:0,[field]:true},{tagName:'A'}));
assert(nativeModuleClick({button:1},{tagName:'A'}));assert(!nativeModuleClick({button:0},{tagName:'A'}));
const tasks=[['settings'],['rolePermissions'],['userPermissions'],['team'],['profiles'],['stores'],['drawers'],['closings'],['closingDrawers'],['products'],['audit'],['backupRuns']];
const closing=moduleReads(tasks,'cajas').map(([k])=>k);assert(closing.includes('closings')&&closing.includes('closingDrawers'));assert(!closing.includes('products')&&!closing.includes('audit')&&!closing.includes('backupRuns'));
const apis=moduleReads(tasks,'apis').map(([key])=>key);
assert(apis.includes('settings')&&apis.includes('team'),'API management receives shared context');
assert(!apis.includes('closings')&&!apis.includes('products')&&!apis.includes('audit'),'API management does not load unrelated business data');
assert.deepEqual(moduleReads(tasks),tasks);assert.deepEqual(moduleReads(tasks,'administracion'),tasks);assert.throws(()=>moduleReads(tasks,'unknown'));
console.log('MODULE NAVIGATION QA: module URLs, native tab gestures and bounded module reads');

assert.equal(requestedModule('https://example.invalid/',routes,'gastos'),'gastos');
assert.equal(requestedModule('https://example.invalid/?module=inicio',routes,'gastos'),'inicio');
assert.equal(requestedModule('https://example.invalid/',routes,'denied'),'inicio');
assert.equal(requestedModule('https://example.invalid/?module=gastos',routes,'inicio',true),'inicio','Internal navigation must not override the next startup');
assert.equal(requestedModule('https://example.invalid/?module=inicio',routes,'gastos',true),'gastos','Respect the personal startup module');
assert.equal(requestedModule('https://example.invalid/?module=gastos',routes,'inicio',false),'gastos','Keep explicit links usable');

const refreshed=new URL(moduleUrl('https://example.invalid/?module=inicio&release=abc&totus_refresh=123&ps_order=7#retorno','inicio'));assert.equal(refreshed.search,'');assert.equal(refreshed.hash,'');assert.equal(refreshed.pathname,'/inicio');

for(const [id,segment] of Object.entries(MODULE_PATHS)){const paths=[{id}];assert.equal(moduleUrl('https://totuscentral.totuscode.com/?module=pricing&ps_order=7',id),'https://totuscentral.totuscode.com/'+segment);assert.equal(requestedModule('https://totuscentral.totuscode.com/'+segment,paths),id);assert.equal(requestedModule('https://totuscentral.totuscode.com/'+segment+'/',paths),id);assert.equal(moduleUrl('https://example.invalid/Totus-Central/precio',id),'https://example.invalid/Totus-Central/'+segment);}
assert.equal(requestedModule('https://example.invalid/?module=pricing',[{id:'pricing'}]),'pricing');
const link='https://example.invalid/?module=ventas&ps_store=hortimatic&ps_order=46623&ps_date=2026-11-13';
const context=moduleNavigationState(link,'ventas');assert.equal(context.totusOrderLink.ps_order,'46623');assert.equal(moduleUrl(link,'ventas'),'https://example.invalid/ventas');assert.deepEqual(moduleNavigationState(link,'tareas',context),{});
