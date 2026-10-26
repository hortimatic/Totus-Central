import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync('index.html','utf8');
const source=html.match(/<script>\s*(\/\* Identificar[\s\S]*?)<\/script>/)[1];
const old='a'.repeat(40),latest='b'.repeat(40);
async function check(loaded,build,fail=false){
  const labels=Array.from({length:2},()=>({textContent:'',children:[],append(...items){this.children.push(...items)}}));
  const document={querySelector:()=>({getAttribute:()=>`src/app.js${loaded?'?v='+loaded:''}`}),querySelectorAll:()=>labels,createElement:()=>({setAttribute(name,value){this[name]=value}})};
  await vm.runInNewContext(source,{document,URL,location:{href:'https://example.com/Totus-Central/?keep=yes#recovery'},Date,fetch:async()=>{if(fail)throw Error('offline');return {ok:true,json:async()=>build}}});
  return labels;
}
for(const el of await check(old,{environment:'production',commit:old})){
  assert.equal(el.textContent,'· versión aaaaaaaa');assert.equal(el.children.length,0);
}
for(const el of await check(old,{environment:'production',commit:latest})){
  assert.equal(el.textContent,'· versión aaaaaaaa');
  const link=el.children[1],url=new URL(link.href);
  assert.equal(link.textContent,'Actualizar');assert.equal(url.searchParams.get('release'),latest);
  assert.equal(url.searchParams.get('keep'),'yes');assert.equal(url.hash,'#recovery');
  assert.match(url.searchParams.get('totus_refresh'),/^\d+$/);
}
for(const build of [{environment:'preview',commit:latest},{environment:'production',commit:'invalid'}]){
  for(const el of await check(old,build)){assert.equal(el.textContent,'· versión aaaaaaaa');assert.equal(el.children.length,0);assert(el.title);}
}
for(const el of await check(old,null,true)){assert.equal(el.textContent,'· versión aaaaaaaa');assert(el.title);}
for(const el of await check(null,{environment:'production',commit:latest})){
  assert.equal(el.textContent,'· versión local sin verificar');assert.equal(el.children.length,0);
}
assert(fs.readFileSync('.github/workflows/publish.yml','utf8').includes('src/app.js?v=$GITHUB_SHA'));
console.log('LOADED VERSION QA: actual code identity, safe explicit update, offline/invalid metadata and deployment HTML verified');
