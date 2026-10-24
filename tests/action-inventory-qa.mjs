import assert from 'node:assert/strict';
import fs from 'node:fs';
const view=fs.readFileSync('src/pages/main.js','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const stock=fs.readFileSync('src/stock-ui.js','utf8')+'\n'+fs.readFileSync('src/pricing-drafts.js','utf8');
assert.ok(app.includes("a.startsWith('stock-')"),'Missing receipt action delegation');
const buttons=[...[view,app,stock].flatMap(code=>[...code.matchAll(/\b(?:btn|action)\([^,\n]*,\s*'([a-z0-9-]+)'/g)].map(x=>x[1]))];
const literals=[...[view,app,stock].flatMap(code=>[...code.matchAll(/data-action="([a-z0-9-]+)"/g)].map(x=>x[1]))];
const handlers=new Set([...(app+'\n'+stock).matchAll(/\ba\s*===\s*'([a-z0-9-]+)'/g)].map(x=>x[1]));
const visible=[...new Set([...buttons,...literals])].sort();
const exceptions=new Set();
const unmapped=visible.filter(action=>!handlers.has(action)&&!exceptions.has(action));
assert.equal(unmapped.length,0,'Botones visibles sin acción definida: '+unmapped.join(', '));
for(const section of ['usuarios','roles','negocio','fiscal','storage','backups','log']){
 assert(view.includes('data-section="'+section+'"'),'No existe submenú '+section);
}
for(const action of ['admin-log-filter','admin-log-clear','admin-log-refresh','admin-log-detail','admin-log-export','backup-settings-save','backup-run-now','backup-history-download','backup-history-verify','backup-refresh']){
 assert(handlers.has(action),'Acción nueva sin manejador: '+action);
}
for(const field of ['backupFrequency','backupTime','backupRetention','backupFolder','backupEnabled','logFrom','logTo','logActor','logArea','logQuery']){
 assert(view.includes('id="'+field+'"'),'Campo ausente de administración: '+field);
}
console.log('ACTION INVENTORY QA: '+visible.length+' botones (páginas + ventanas emergentes) y '+handlers.size+' manejadores; cero botones sin ruta, siete submenús verificados');
