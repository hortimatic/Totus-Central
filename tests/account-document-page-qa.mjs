import assert from 'node:assert/strict';
import {readAccountDocumentPage} from '../src/account-document-page.js';
const calls=[];let answer={data:Array.from({length:21},(_,i)=>({id:String(i),uploaded_by:'own'})),error:null};
const q={from(...a){calls.push(['from',...a]);return this},select(...a){calls.push(['select',...a]);return this},eq(...a){calls.push(['eq',...a]);return this},order(...a){calls.push(['order',...a]);return this},ilike(...a){calls.push(['ilike',...a]);return this},async range(...a){calls.push(['range',...a]);return answer}};
const result=await readAccountDocumentPage(q,'own',{page:2,size:20,query:'file_100%'});assert.equal(result.rows.length,20);assert.equal(result.hasMore,true);assert.deepEqual(calls.find(c=>c[0]==='eq'),['eq','uploaded_by','own']);assert.deepEqual(calls.at(-1),['range',20,40]);assert.deepEqual(calls.filter(c=>c[0]==='order').map(c=>c[1]),['document_date','id']);assert.equal(calls.find(c=>c[0]==='ilike')[2],'%file\\_100\\%%');
answer={data:[{id:'x',uploaded_by:'other'}],error:null};await assert.rejects(()=>readAccountDocumentPage(q,'own'),/no válida/);answer={data:null,error:{message:'denied'}};await assert.rejects(()=>readAccountDocumentPage(q,'own'),/denied/);
for(const options of [{size:100},{page:0},{page:1.5}])await assert.rejects(()=>readAccountDocumentPage(q,'own',options));
answer={data:[],error:null};assert.deepEqual(await readAccountDocumentPage(q,'own'),{rows:[],hasMore:false});console.log('ACCOUNT DOCUMENT PAGE: bounded 21-row metadata, owner filter, stable ordering, literal search, errors and empty results PASS');
