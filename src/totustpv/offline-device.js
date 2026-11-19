export function offlineDevice(storage=globalThis.localStorage){
 const key='totus-tpv-offline-device-v1';let id=storage.getItem(key);
 if(id===null){id=crypto.randomUUID();storage.setItem(key,id);}
 if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)||storage.getItem(key)!==id)throw Error('No se puede identificar este dispositivo. Conserva sus datos locales.');
 return id;
}
