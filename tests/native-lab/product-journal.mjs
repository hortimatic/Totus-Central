import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
/** Exercise the actual product-journal migration subset and the actual dynamic
 * registry replacements. No reimplementation of a journal in this fixture. */
export async function loadProductJournal(db){
 const source=await readFile(new URL('../../supabase/migrations/20261106170000_prestashop_product_create_journal.sql',import.meta.url),'utf8');
 const end=source.indexOf('-- Independent journal for selective updates');assert.ok(end>0);
 await db.exec("alter table private.totus_api_connections add column name text default 'Isolated QA'; alter default privileges grant execute on functions to service_role;");
 await db.exec(source.slice(0,end)+'\nCOMMIT;');
 const dynamic=await readFile(new URL('../../supabase/migrations/20261113153222_dynamic_website_operations.sql',import.meta.url),'utf8');
 const helper=dynamic.slice(dynamic.indexOf('create function private.totus_website_matches'),dynamic.indexOf('-- Exact, checked replacements'));
 await db.exec(helper);
 const mappings=[...dynamic.matchAll(/\('public\.totus_prestashop_product_create_journal\(text,uuid,jsonb\)',\s*'((?:[^']|'')*)','((?:[^']|'')*)'\)/g)];
 assert.equal(mappings.length,2,'Both published registry bindings must be present');
 let definition=(await db.query("select pg_get_functiondef('public.totus_prestashop_product_create_journal(text,uuid,jsonb)'::regprocedure) value")).rows[0].value;
 for(const match of mappings){const from=match[1].replaceAll("''","'"),to=match[2].replaceAll("''","'");assert.ok(definition.includes(from),'Published binding must match original definition');definition=definition.replace(from,()=>to);}
 await db.exec(definition);
 await db.exec('alter table private.totus_prestashop_product_create_requests drop constraint totus_prestashop_product_create_requests_store_check; alter table private.totus_prestashop_product_create_requests add foreign key(store) references private.totus_websites(key);');
}
