/** One read-only preparation at a time; cashier work always gets priority. */
export function createCatalogueBackground({current,canRun,delay=1000,retry=30000,refresh=300000,onState=()=>{}}){
 let status={phase:'idle'};
 const publish=value=>{if(JSON.stringify(status)===JSON.stringify(value))return;status=value;onState({...value});};
 let timer=null,controller=null,key=null,running=false,nextAt=0,epoch=0;
 const cancel=()=>{clearTimeout(timer);timer=null;controller?.abort();controller=null;};
 function stop(){epoch++;cancel();key=null;nextAt=0;publish({phase:'idle'});}
 function update(){
  const state=current();
  if(!state){stop();return;}
  if(state.key!==key){cancel();epoch++;key=state.key;nextAt=0;publish({phase:'waiting'});}
  if(timer||running)return;
  timer=setTimeout(tick,delay);
 }
 async function tick(){
  timer=null;const state=current();
  if(!state||state.key!==key){update();return;}
  if(status.phase==='updated'&&status.validUntil!==null&&Date.now()>=status.validUntil){nextAt=0;publish({phase:'waiting'});}
  if(!canRun()||Date.now()<nextAt){update();return;}
  const run=epoch,active=new AbortController();controller=active;running=true;publish({phase:'preparing',completedProducts:0,products:0});
  const wait=()=>new Promise((resolve,reject)=>{
   if(active.signal.aborted){reject(active.signal.reason);return;}
   const abort=()=>{clearTimeout(id);reject(active.signal.reason);};
   const id=setTimeout(()=>{active.signal.removeEventListener('abort',abort);resolve();},delay);
   active.signal.addEventListener('abort',abort,{once:true});
  });
  try{
   const result=await state.prepare({signal:active.signal,onProgress:progress=>{if(run===epoch&&!active.signal.aborted)publish({phase:'preparing',completedProducts:progress.completedProducts,products:progress.products});},beforePage:async()=>{
    // Yield between pages even when idle, avoiding a burst of store requests.
    do{await wait();if(current()?.key!==state.key)active.abort();}while(!active.signal.aborted&&!canRun());
    if(active.signal.aborted)throw active.signal.reason;
   }});
   if(run===epoch){nextAt=Date.now()+(result?refresh:retry);publish(result?{phase:'updated',completedProducts:result.completedProducts,products:result.products,validUntil:result.validUntil??null}:{phase:'waiting'});}
  }catch{if(run===epoch){nextAt=Date.now()+retry;publish({phase:'retry'});}}
  finally{running=false;if(controller===active)controller=null;update();}
 }
 return {update,stop,snapshot:()=>({...status})};
}
