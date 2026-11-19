import test from 'node:test';import assert from 'node:assert/strict';import {menuLinks,menuLinksFromForm,menuLinksActions,menuLinksHtml} from '../src/totustpv/menu-links.js';
test('menu paths and HTTPS links normalize, escape labels and open with isolated tab ownership',()=>{
 const links=menuLinks([{label:'  Clientes <VIP> ',url:'/clientes'},{label:'Ayuda',url:'HTTPS://EXAMPLE.INVALID/ayuda?seccion=caja'}]);assert.equal(links[0].label,'Clientes <VIP>');assert.equal(links[1].url,'https://example.invalid/ayuda?seccion=caja');
 const html=menuLinksActions(links);assert.match(html,/Clientes &lt;VIP&gt;/);assert.match(html,/target="_blank" rel="noopener noreferrer"/);assert.doesNotMatch(html,/<VIP>/);
 assert.equal((menuLinksHtml(links).match(/class="tpv-menu-link-row"/g)||[]).length,6);
 assert.deepEqual(menuLinksFromForm(new Map([['menu-label-0','Clientes'],['menu-url-0','/clientes']])),[{label:'Clientes',url:'/clientes'}]);
});
test('unsafe schemes, credentials, tokens, partial rows and duplicates cannot be saved',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','http://example.invalid/','//example.invalid/','https://user:pass@example.invalid/','https://example.invalid/?token=a','https://example.invalid/?%74oken=a','/clientes?api_key=a','/clientes?ACCESS_TOKEN=a','https://example.invalid/#access_token=private','/clientes#%74oken=private','https://example.invalid/a\\b'])assert.throws(()=>menuLinks([{label:'Acceso',url}]));
 assert.throws(()=>menuLinks([{label:'Clientes',url:'/clientes'},{label:'CLIENTES',url:'/otra'}]));
 assert.throws(()=>menuLinks([{label:'Uno',url:'https://EXAMPLE.invalid/'},{label:'Dos',url:'https://example.invalid/'}]));
 assert.throws(()=>menuLinksFromForm(new Map([['menu-label-0','Sin dirección']])));
 assert.throws(()=>menuLinks(Array(7).fill({label:'Uno',url:'/'})));
 assert.throws(()=>menuLinks([{label:'Uno',url:'/',token:'private'}]));
});
