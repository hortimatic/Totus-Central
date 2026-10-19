import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const source=['src/app.js','src/api.js','src/state.js','src/utils.js','src/config.js','src/components.js','src/permissions.js','src/calculations.js','src/file-utils.js','src/expense-register.js','src/excel.js','src/backup.js','src/pages/main.js'];
source.push('src/gestor-format.js');
source.push('src/pdf-preview.js','src/report-period.js','src/recovery-core.js','src/recovery-runner.js','src/form-drafts.js');
const cache=Object.fromEntries(source.map(file=>[file,fs.readFileSync(file,'utf8')]));
const problems=[];
for(const [file,content] of Object.entries(cache)){
 const defs=[...content.matchAll(/(?:^|\n)(?:export\s+)?(?:async\s+)?function\s+([\w$]+)\s*\(/g)].map(x=>x[1]);
 const duplicated=defs.filter((x,i)=>defs.indexOf(x)!==i);
 if(duplicated.length)problems.push(file+': duplicate function '+[...new Set(duplicated)].join(','));
 for(const statement of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)){
  const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),statement[2]));
  if(!cache[target]){problems.push(file+': module does not exist '+target);continue}
  const exported=cache[target];
  for(const specifier of statement[1].split(',')){
   const name=specifier.trim().split(/\s+as\s+/)[0];
   if(!name)continue;
   const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   const exp=new RegExp('export\\s+(?:async\\s+)?(?:const|let|var|function|class)\\s+'+escaped+'(?=\\W|$)|export\\s*\\{[^}]*\\b'+escaped+'\\b');
   if(!exp.test(exported))problems.push(file+': missing named export '+name+' in '+target);
  }
 }
}
// Evitar reincorporar enlaces y servicios pertenecientes a aplicaciones abandonadas.
const deployable=['index.html',...source,'src/styles.css'];
const forbidden=[
 {pattern:/hortimatic\.github\.io\/totus-pricing-demo/i,label:'URL de la aplicación anterior'},
 {pattern:/qgyufbjytcewuevbketz/i,label:'Supabase anterior'},
 {pattern:/totus-pricing-demo/i,label:'Identificador anterior'}
];
for(const file of deployable){
 const content=fs.readFileSync(file,'utf8');
 for(const rule of forbidden)if(rule.pattern.test(content))problems.push(file+': '+rule.label);
}
if(!cache['src/config.js'].includes('https://awmojepsasikxocoeqtu.supabase.co'))problems.push('Staging debe permanecer desconectado de producción');
if(cache['src/config.js'].includes('zwkpmjjuurgjygcrejiw'))problems.push('Staging no debe contener credenciales ni dirección de producción');
// Hosting agnóstico: la interfaz debe funcionar como archivos estáticos contra Supabase.
const hostingMarkers=['vercel.app','vercel.com','@vercel/','process.env.vercel','import.meta.env.vercel'];
for(const file of deployable){
 const content=fs.readFileSync(file,'utf8').toLowerCase();
 if(hostingMarkers.some(marker=>content.includes(marker)))problems.push(file+': dependencia de Vercel en código publicado');
}
for(const required of ['index.html','src/app.js','src/api.js','src/config.js','src/styles.css']){
 if(!fs.existsSync(required))problems.push('Falta archivo esencial para alojamiento estático: '+required);
}
if(!cache['src/api.js'].includes('window.supabase.createClient('))problems.push('Supabase: falta conexión directa desde navegador');
for(const name of ['styleMoney','addAutoFilter','quarterStats'])if(new RegExp('\\b'+name+'\\b').test(cache['src/excel.js']))problems.push('Dead Excel helper still in use: '+name);
if(problems.length){console.error('CODE INTEGRITY FAILED\n'+problems.join('\n'));process.exit(1)}
console.log('CODE INTEGRITY: '+source.length+' JS modules and all named imports validated; no duplicate functions or dead Excel helpers');

 
// Regression guard: cleanup must remain read-only and additive API must not drop tables.
for(const sqlPath of ['supabase/cleanup.sql','supabase/totus_api.sql']){
 const sqlText=fs.readFileSync(sqlPath,'utf8');
 const active=sqlText.split(/\r?\n/).filter(line=>!/^\s*--/.test(line));
 if(active.some(line=>/^\s*drop\s+table\b/i.test(line))) {
  console.error('UNSAFE SQL detected in '+sqlPath+': DROP TABLE');
  process.exit(1);
 }
}

const backupSql=fs.readFileSync('supabase/backup.sql','utf8').replace(/\r\n/g,'\n');
const contractStart=backupSql.indexOf('create or replace function public.totus_backup_contract()');
assert.ok(contractStart>=0,'Backup contract missing from SQL source');
const contractEnd=backupSql.indexOf('revoke all on function public.totus_backup_contract()',contractStart);
const contractBody=backupSql.slice(contractStart,contractEnd);
assert.ok(contractBody.includes('as '+String.fromCharCode(36,36)+'\n'+'begin'),'Backup contract opening delimiter invalid');
assert.ok(contractBody.includes('end;\n'+String.fromCharCode(36,36)+';'),'Backup contract closing delimiter invalid');

const restoreSource=fs.readFileSync('src/backup.js','utf8');
const restoreStart=restoreSource.indexOf('export async function restoreBackup(');
assert.ok(restoreStart>=0,'Restore entrypoint missing');
const restoreBody=restoreSource.slice(restoreStart);
assert.ok(restoreBody.includes('await inspectBackup(file)'),'Restore must validate backup before refusing unsafe operations');
assert.ok(restoreBody.includes('throw new Error('),'Restore safety lock must be explicit');
assert.ok(!restoreBody.includes("rpc('totus_restore_backup'"),'Unsafe database restoration must remain blocked');
assert.ok(!restoreSource.includes('async function restoreStorage('),'Unsafe independent storage replacement must remain removed');

// Document paths must never resolve to relative navigation segments.
const {safeFileSegment}=await import('../src/file-utils.js');
for(const input of ['.','..','  ..  '])assert.equal(safeFileSegment(input),'sin_dato','Unsafe document path segment');
assert.equal(safeFileSegment('../factura.pdf'),'.._factura.pdf');

// The backup validator must reject unexpected ZIP members and duplicate manifest paths.
assert.ok(restoreSource.includes("new Set(['manifest.json','database.json'])"),'Backup allowed file list is missing');
assert.ok(restoreSource.includes('new Set(paths).size!==paths.length'),'Backup duplicate path validation is missing');
assert.ok(restoreSource.includes('!expectedEntries.has(name)'),'Unexpected ZIP members must be rejected');

// Contextual help markers must remain available on common financial fields.
const componentSource=fs.readFileSync('src/components.js','utf8');
for(const label of ['Importe pagado','% deducible','Gastos pagados en caja','Recargo (%)','Estado de pago'])assert.ok(componentSource.includes("'"+label+"':"),'Missing contextual help: '+label);
assert.ok(componentSource.includes('fieldHelp(label)'), 'Common fields must display contextual help');

// Field guidance must be usable on touchscreens and by keyboard, not title-only hover hints.
assert.ok(componentSource.includes('<details class="field-help"'),'Contextual help needs native tap-to-open details');
assert.ok(componentSource.includes('<summary aria-label='),'Contextual help needs keyboard-accessible summary');

// Reporting totals must preserve explicit zero values instead of falling back to paid amounts.
const pagesSource=fs.readFileSync('src/pages/main.js','utf8');
assert.ok(!pagesSource.includes('x.gross_expense||x.accounting_amount||x.amount_paid'),'Gastos total must not treat 0 as missing');
const {expenseCostAmount}=await import('../src/calculations.js');
assert.equal(expenseCostAmount({accounting_amount:0,amount_paid:88}),0,'Expense rollups must preserve an explicit accounting zero');
assert.equal(expenseCostAmount({gross_expense:0,amount_paid:88}),0,'Expense rollups must preserve an explicit gross zero');

assert.ok(!pagesSource.includes('r.gross_expense||r.accounting_amount||r.amount_paid'),'Expense row must preserve zero-valued totals');

// Financial reports and detail screens must not treat an explicit 0 as an absent amount.
for(const pattern of ['x.accounting_amount||x.gross_expense','row?.gross_expense||row?.accounting_amount'])assert.ok(!pagesSource.includes(pattern),'Zero amount incorrectly overridden: '+pattern);

// Backup ZIP path validation must reject single backslash characters.
const bs=String.fromCharCode(92);
assert.ok(restoreSource.includes("path.includes('"+bs+bs+"')"),'Backup validator must reject a single backslash');
assert.ok(!restoreSource.includes("path.includes('"+bs.repeat(4)+"')"),'Backup validator must not test only doubled backslashes');

// Spreadsheet previews are user-controlled file content: escape cells and limit DOM size.
const appSource=fs.readFileSync('src/app.js','utf8');
assert.ok(!appSource.includes('XLSX.utils.sheet_to_html('),'Untrusted spreadsheet HTML cannot be inserted directly');
assert.ok(appSource.includes('row.slice(0,30).map(cell=>`<td>${esc(cell)}</td>`)'),'Spreadsheet preview must escape cell text');

const paymentSource=fs.readFileSync('src/calculations.js','utf8');
assert.ok(appSource.includes('validateExpensePayment(total,amountPaid,paidStatus)'),'Expense form must use shared validator');
assert.ok(paymentSource.includes('El importe pagado no puede superar el total de la factura.'),'Expense payments must not exceed invoice total');
assert.ok(paymentSource.includes('Un pago parcial debe ser mayor que cero'),'Partial payments require a positive partial amount');
assert.ok(appSource.includes('safeFileSegment(d.id)}_${safeFileSegment(d.original_name)'),'ZIP export must preserve duplicate named documents');

const apiSql=fs.readFileSync('supabase/totus_api.sql','utf8');
const guardedRpcs=[
 'totus_convert_proforma(uuid,uuid)',
 'totus_delete_closing(uuid,text)',
 'totus_finalize_sales_document(uuid)',
 'totus_register_external_document(uuid,integer)',
 'totus_save_closing(jsonb,jsonb)',
 'totus_save_sales_document(jsonb,jsonb)',
 'totus_update_invoice_payment(uuid,jsonb)'
];
for(const signature of guardedRpcs){
 assert.ok(apiSql.includes('revoke all on function public.'+signature+' from public,anon;'),'Anonymous RPC access missing safeguard: '+signature);
}
assert.ok(backupSql.includes('revoke all on function public.totus_storage_usage() from public,anon;'),'Anonymous storage usage access must be blocked');
assert.ok(backupSql.includes('revoke all on function public.totus_restore_backup(jsonb,text) from authenticated;'),'Restore RPC must stay disabled');

assert.ok(pagesSource.includes("row?.paid_date||(row?'':isoToday())"),'New paid expenses should have a usable payment date by default');
assert.ok(appSource.includes("paidStatus==='pendiente'?null:"),'Unpaid invoices must not persist a payment date');
assert.ok(appSource.includes('Indica la fecha en que se pagó el gasto.'),'Paid invoices must validate the payment date');

const expenseCalculations=fs.readFileSync('src/calculations.js','utf8');
assert.ok(expenseCalculations.includes('export function validateExpenseLineAmounts('),'Expense fiscal line validator missing');
assert.ok(appSource.includes('validateExpenseLineAmounts({base,vat,re,withholding:wh,deductiblePct:dedPct})'),'Saving expenses must use the fiscal line validator');
const expenseLineConstraint=fs.readFileSync('supabase/review_patches/005_expense_line_validation.sql','utf8');
assert.ok(expenseLineConstraint.includes('ops_expense_lines_valid_amounts_ck'),'Database expense constraint documentation missing');

assert.ok(pagesSource.includes("row.uploaded_by===state.session?.user?.id"),'Document owner must retain edit access');
assert.ok(pagesSource.includes("canUser(state.user,'documentos','delete',state.data.userPermissions)"),'Document deletion visibility must reflect user permissions');
assert.ok(appSource.includes("current.uploaded_by!==state.session?.user?.id"),'Document save action must verify owner');
assert.ok(appSource.includes("if(!can('documentos','delete'))"),'Document deletion must require module permission');

const htmlSource=fs.readFileSync('index.html','utf8');
assert.ok(!htmlSource.includes('stagingSignupBtn'),'Legacy self-registration shortcut must stay removed');
assert.ok(!htmlSource.includes('hortimatic.github.io/Totus-Central/staging/'),'Legacy authentication callback must not return');
assert.ok(!appSource.includes('auditSemesterFiltersInitialized'),'Refresh must never overwrite selected filters with a fixed semester');
assert.ok(!fs.existsSync('.github/workflows/entrega-codigo.yml'),'Retired release branch workflow must not return');
assert.ok(!fs.existsSync('.github/workflows/pages-preview.yml'),'Obsolete Pages deployment workflow must not return');

assert.ok(!pagesSource.includes("btn('Restaurar copia'"),'Staging must not offer a destructive restore button while restore is disabled');
assert.ok(pagesSource.includes("btn('Verificar integridad','backup-verify'"),'Staging must offer safe backup integrity verification');
assert.ok(appSource.includes("async function verifyBackupFromInput()"),'Safe inspection handler missing');
assert.ok(!appSource.includes("async function restoreBackupFromInput()"),'Dead restore input handler must remain removed');

for(const [sqlFile,functionName,baseName] of [
 ['supabase/totus_api.sql','totus_is_manager','is_manager'],
 ['supabase/totus_api.sql','totus_is_team_member','is_team_member'],
 ['supabase/backup.sql','totus_is_admin','is_admin']
]){
 const text=fs.readFileSync(sqlFile,'utf8');
 const start=text.indexOf('create or replace function private.'+functionName+'()');
 assert.ok(start>=0,'Missing role check: '+functionName);
 const body=text.slice(start,text.indexOf('$$;',start)+3);
 assert.ok(body.includes('select private.'+baseName+'();'),'Role check must reuse verified RLS helper: '+functionName);
 assert.ok(!body.includes('join public.team_members'),'Duplicate profile-based role checks are prohibited');
}

assert.ok(appSource.includes('hideForbiddenButtons()'),'Module permissions must hide unavailable actions');
assert.ok(appSource.includes("if(!checkActionPermission(a,el))"),'Module actions must reject forbidden operations');

const permissionsSql=fs.readFileSync('supabase/permissions.sql','utf8');
assert.ok(permissionsSql.includes('CREATE TABLE public.ops_user_permissions'),'User permissions table must be versioned');
assert.ok(permissionsSql.includes('AS RESTRICTIVE'),'RLS permissions need restrictive safeguards');
assert.ok(permissionsSql.includes('CREATE POLICY totus_storage_document_delete'),'Storage permissions must be declared');
for(const functionName of ['totus_convert_proforma','totus_delete_closing','totus_delete_expense','totus_finalize_sales_document','totus_register_external_document','totus_save_closing','totus_save_expense','totus_save_sales_document','totus_update_invoice_payment']){
 const start=apiSql.indexOf('create or replace function public.'+functionName+'(');
 assert.ok(start>=0,'Missing privileged RPC '+functionName);
 const end=apiSql.indexOf('$$;',start);
 assert.ok(apiSql.slice(start,end).includes('private.totus_can('),'Privileged RPC without fine-grained permission: '+functionName);
}
assert.ok(appSource.includes("event==='PASSWORD_RECOVERY'"),'Recovery links must show password reset form');
assert.ok(appSource.includes('sb.auth.updateUser({password})'),'Recovery must set a password through authenticated Supabase');
assert.ok(htmlSource.includes('id="passwordResetPanel"'),'Recovery UI missing');
