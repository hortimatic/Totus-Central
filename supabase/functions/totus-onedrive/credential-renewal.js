export async function renewMicrosoftCredential({config,secret,root,saveExpiry,fetchToken=fetch},value,expires){
 if(typeof value!=='string'||value.length<16||value.length>4096||/\s/.test(value))throw new Error('Introduce el valor completo de la nueva clave.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||!Number.isFinite(Date.parse(expires+'T00:00:00Z'))||new Date(expires+'T00:00:00Z').toISOString().slice(0,10)!==expires||Date.parse(expires+'T23:59:59Z')<Date.now())throw new Error('La nueva clave necesita una fecha de caducidad futura válida.');
 const c=await config(),raw=await secret('read_tokens'),saved=raw?JSON.parse(raw):null;
 if(!c.connected||!saved?.refresh_token)throw new Error('Primero autoriza la conexión con Microsoft.');
 const response=await fetchToken('https://login.microsoftonline.com/consumers/oauth2/v2.0/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:saved.refresh_token,client_id:c.client_id,client_secret:value,scope:'Files.ReadWrite.AppFolder offline_access'}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('Microsoft no acepta la nueva clave. Se conserva la conexión anterior.');
 const token=await response.json(),seconds=Number(token.expires_in);
 if(typeof token.access_token!=='string'||!String(token.scope||'').toLowerCase().includes('files.readwrite.appfolder')||!Number.isFinite(seconds)||seconds<=0)throw new Error('Microsoft no ha confirmado la clave y su permiso de carpeta.');
 await root(token.access_token);
 await secret('write_client',value);
 await secret('write_tokens',JSON.stringify({access_token:token.access_token,refresh_token:token.refresh_token||saved.refresh_token,expires_at:Date.now()+seconds*1000}));
 await saveExpiry(expires);
 return {updated:true,credential_expires_at:expires};
}
