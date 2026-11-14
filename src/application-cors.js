// Browser origins owned by this application. This is not an authentication layer.
export const APPLICATION_ORIGINS=Object.freeze([
 'https://hortimatic.github.io',
 'https://totuscentral.totuscode.com'
]);

/** Preserve the service response and its auth checks, varying only browser CORS. */
export function withApplicationCors(handler){
 return async function applicationRequest(request,...args){
  const origin=request.headers.get('origin');
  const response=await handler(request,...args);
  const headers=new Headers(response.headers);
  if(origin){
   if(APPLICATION_ORIGINS.includes(origin))headers.set('Access-Control-Allow-Origin',origin);
   else headers.delete('Access-Control-Allow-Origin');
  }
  const vary=headers.get('Vary');
  if(!vary?.split(',').some(value=>value.trim().toLowerCase()==='origin')){
   headers.set('Vary',vary?`${vary}, Origin`:'Origin');
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
 };
}
