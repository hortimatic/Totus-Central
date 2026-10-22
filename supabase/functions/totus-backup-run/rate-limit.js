export function isRateLimited(error){return /rate limit|429|too many requests/i.test(String(error?.message||error));}
export async function withRateLimitRetry(operation,{sleep=ms=>new Promise(r=>setTimeout(r,ms)),attempts=3,maximumWait=60000}={}){
 let waited=0;
 for(let n=0;;n++){
  try{return await operation();}
  catch(error){
   if(!isRateLimited(error)||n>=attempts-1)throw error;
   const requested=Number(String(error.message||error).match(/Retry after (\d+)ms/i)?.[1])||2000;
   const delay=Math.max(1000,requested+250);
   if(waited+delay>maximumWait)throw error;
   waited+=delay;await sleep(delay);
  }
 }
}
