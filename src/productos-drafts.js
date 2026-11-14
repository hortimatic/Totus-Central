import {textValue} from './productos-core.js';

// Selection, filters and durable local gallery preferences are not unsaved writes.
export function productHasUnpublishedChanges({record,overrides={},variants=[],variantOverrides=new Map(),mode='',targetRaw=new Map(),targets=null,tableEdits=[],wizard={},draftPhotos=[]}={}){
 const entries=value=>value instanceof Map?[...value]:Array.isArray(value)?value:[];
 if(entries(tableEdits).some(([,row])=>row?.request||Object.keys(row?.values||{}).length))return true;
 const destinationEntries=entries(targetRaw),destinations=targets?[...targets]:destinationEntries.map(([shop])=>shop);
 if(record?.id&&mode==='comparar'&&destinations.length&&destinations.every(shop=>destinationEntries.find(([key])=>key===shop)?.[1]?.__copyCompleted))return false;
 if(!record)return false;
 if(!record.id&&(textValue(record.name)||textValue(record.reference)||draftPhotos.length))return true;
 const differs=(source,changes)=>Object.entries(changes||{}).some(([field,value])=>textValue(value)!==textValue(source?.[field]));
 if(differs(record,overrides))return true;
 if(entries(variantOverrides).some(([id,changes])=>differs(variants.find(row=>String(row.id||row.draft_key)===String(id)),changes)))return true;
 return entries(wizard.stages).some(([,stage])=>stage?.rows?.some(row=>!row.done));
}

// Unknown/legacy state never makes a draft eligible for automatic cleanup.
export function productDraftFacts(d,now=Date.now()){
 const stages=d?.wizard?.stages??[],valid=Array.isArray(stages)&&stages.every(entry=>Array.isArray(entry)&&entry[1]&&Array.isArray(entry[1].rows));
 const rows=valid?stages.flatMap(([,state])=>state.rows):[];
 const requests=d?.editRequests,requestCount=requests instanceof Map?requests.size:Array.isArray(requests)?requests.length:requests==null?0:1;
 const sent=!!d?.wizard?.attempted?.length||requestCount>0||rows.some(row=>row?.attempted||row?.done)||!valid;
 const savedAt=d?.savedAt;
 return {sent,canPurge:valid&&!sent&&Number.isFinite(savedAt)&&savedAt>0&&now-savedAt>30*86400000,pendingSteps:rows.filter(row=>!row?.done).length,doneSteps:rows.filter(row=>row?.done).length};
}
