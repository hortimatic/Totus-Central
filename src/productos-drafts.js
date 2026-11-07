// Unknown/legacy state never makes a draft eligible for automatic cleanup.
export function productDraftFacts(d,now=Date.now()){
 const stages=d?.wizard?.stages??[],valid=Array.isArray(stages)&&stages.every(entry=>Array.isArray(entry)&&entry[1]&&Array.isArray(entry[1].rows));
 const rows=valid?stages.flatMap(([,state])=>state.rows):[];
 const requests=d?.editRequests,requestCount=requests instanceof Map?requests.size:Array.isArray(requests)?requests.length:requests==null?0:1;
 const sent=!!d?.wizard?.attempted?.length||requestCount>0||rows.some(row=>row?.attempted||row?.done)||!valid;
 const savedAt=d?.savedAt;
 return {sent,canPurge:valid&&!sent&&Number.isFinite(savedAt)&&savedAt>0&&now-savedAt>30*86400000,pendingSteps:rows.filter(row=>!row?.done).length,doneSteps:rows.filter(row=>row?.done).length};
}
