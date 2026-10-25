import assert from 'node:assert/strict';
import {RECOVERY_TABLES,PRE_CHAT_RECOVERY_TABLES,CHAT_RECOVERY_TABLES,LEGACY_RECOVERY_TABLES,STOCK_RECOVERY_TABLES,LEGACY_STOCK_SCHEMA_HASH,validateMetadata,isLegacyStockArchive,recoveryFileReferences} from '../src/recovery-core.js';
const database=Object.fromEntries(RECOVERY_TABLES.map(t=>[t,[]]));
const manifest={format:'totus-clean-backup',version:3,project_ref:'test',database_instance:'11111111-1111-4111-8111-111111111111',schema_hash:'a'.repeat(64),revision:'b'.repeat(64),identities:[],tables:[...RECOVERY_TABLES],storage:{'business-documents':[],'business-assets':[]}};
assert.equal(PRE_CHAT_RECOVERY_TABLES.length,42);assert.equal(CHAT_RECOVERY_TABLES.length,7);assert.equal(RECOVERY_TABLES.length,52);assert.equal(new Set(RECOVERY_TABLES).size,52);
assert.equal(STOCK_RECOVERY_TABLES.length,4);
validateMetadata(manifest,database);
for(const missing of STOCK_RECOVERY_TABLES){
 const partial={...database};delete partial[missing];assert.throws(()=>validateMetadata(manifest,partial),/incompletas/);
}
const legacy=Object.fromEntries(LEGACY_RECOVERY_TABLES.map(t=>[t,[]]));
const oldManifest={...manifest,schema_hash:LEGACY_STOCK_SCHEMA_HASH,tables:[...LEGACY_RECOVERY_TABLES]};
assert(isLegacyStockArchive(oldManifest,legacy));validateMetadata(oldManifest,legacy);
assert(!isLegacyStockArchive({...oldManifest,schema_hash:'f'.repeat(64)},legacy));
assert.throws(()=>validateMetadata({...oldManifest,schema_hash:'f'.repeat(64)},legacy),/incompletas/);
const missingAccounting={...legacy};delete missingAccounting.ops_expenses;
assert.throws(()=>validateMetadata(oldManifest,missingAccounting),/incompletas/);
database.ops_documents.push({id:'doc',storage_path:'2026/stock/pedido.pdf'});
database.ops_stock_sources.push({id:'source',document_id:'doc'});
assert.deepEqual(recoveryFileReferences(database)['business-documents'],['2026/stock/pedido.pdf']);
console.log('STOCK BACKUP QA: all 52 tables required; exact legacy 38-table contract supported; missing accounting and partial module rejected; originals included');
