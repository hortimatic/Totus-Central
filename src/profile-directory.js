// Directory reads do not need other users' saved themes, chat backgrounds or layouts.
export const PROFILE_DIRECTORY_COLUMNS='id,email,full_name,role,active,created_at,updated_at,account:ui_preferences->account';

export async function readProfileDirectory(select,owner,initialProfile=null){
 const rows=await select('profiles',{columns:PROFILE_DIRECTORY_COLUMNS});
 const directory=rows.map(({account,ui_preferences,...row})=>({...row,ui_preferences:{account:account??ui_preferences?.account}}));
 const position=directory.findIndex(row=>row.id===owner);
 if(position<0)return directory;
 // updated_at is not maintained by all existing preference RPCs. Reuse only the
 // profile read in this same boot; later refreshes always read the owner afresh.
 const own=initialProfile?.id===owner?[initialProfile]:await select('profiles',{limit:1,allowTruncated:true,filter:query=>query.eq('id',owner)});
 const verified=own.find(row=>row.id===owner);
 if(verified)directory[position]=verified;
 return directory;
}
