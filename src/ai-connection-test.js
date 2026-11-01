// Deliberately isolated connectivity test: no business data, tools or persistent credentials.
export const GEMINI_TEST_MODEL='gemini-3.1-flash-lite';
const trials={connection:{prompt:'Esta es una prueba ficticia de conexión. Responde exactamente CONEXION_TOTUS_OK, sin añadir nada.',expected:'CONEXION_TOTUS_OK'},sum:{prompt:'Prueba con datos ficticios: suma 4 y 6. Responde únicamente 10.',expected:'10'}};
export function aiConnectionTestHtml(){return `<details class="card card-pad ai-test-panel"><summary>Conexiones IA · pruebas</summary><p>Gemini · ${GEMINI_TEST_MODEL}. Solo envía los mensajes ficticios incluidos aquí. No lee documentos, no recibe datos de la herramienta y no ejecuta acciones.</p><p class="small muted">La clave se usa directamente con Google y se borra del formulario al terminar. No se guarda en Totus Central. El nivel gratuito tiene límites y Google puede usar las pruebas para mejorar sus productos.</p><form data-ai-test-form><div class="form-grid"><label>Clave de Google AI Studio<input name="aiTestKey" type="password" autocomplete="off" spellcheck="false" data-draft-ignore required></label><label>Mensaje ficticio<select name="aiTestTrial"><option value="connection">Comprobar conexión</option><option value="sum">Sumar 4 + 6</option></select></label><label class="wide check-field"><input name="aiTestFree" type="checkbox" required data-draft-ignore>He comprobado que el proyecto está en nivel gratuito y sin facturación activada.</label></div><div class="form-actions"><button class="btn primary" type="submit">Probar Gemini</button></div><p role="status" aria-live="polite" data-ai-test-status></p><pre class="ai-test-output" data-ai-test-output hidden></pre><p class="small"><a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer">Abrir Google AI Studio</a> · <a href="https://ai.google.dev/gemini-api/docs/pricing" target="_blank" rel="noopener noreferrer">Cuotas y condiciones</a></p></form></details>`;}
export function createAIConnectionTest({allowed,actor,request=fetch}){
 let host=null,epoch=0,controller=null,timer=null,busy=false,listeners=null;
 const dispose=()=>{epoch++;controller?.abort();listeners?.abort();clearTimeout(timer);if(host){const key=host.querySelector('[name=aiTestKey]');if(key)key.value='';}host=null;controller=null;busy=false;};
 return {dispose,mount(element){
  dispose();if(!allowed()||!element)return;host=element;
  const form=host.querySelector('[data-ai-test-form]'),status=host.querySelector('[data-ai-test-status]'),output=host.querySelector('[data-ai-test-output]'),button=form.querySelector('button[type=submit]');
  listeners=new AbortController();status.textContent='';output.textContent='';output.hidden=true;button.disabled=false;
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!allowed())return;
   const keyInput=form.elements.aiTestKey,key=keyInput.value.trim(),trial=trials[form.elements.aiTestTrial.value];
   output.hidden=true;output.textContent='';
   if(!key||!trial||!form.elements.aiTestFree.checked){status.textContent='Completa la clave y confirma el nivel gratuito.';return;}
   const stamp=epoch,owner=actor(),active=()=>host===element&&epoch===stamp&&actor()===owner&&allowed();
   busy=true;button.disabled=true;status.textContent='Comprobando Gemini con datos ficticios…';
   const requestController=new AbortController();controller=requestController;const signal=requestController.signal,timeout=setTimeout(()=>requestController.abort(),15000);timer=timeout;
   try{
    const response=await request('https://generativelanguage.googleapis.com/v1beta/models/'+GEMINI_TEST_MODEL+':generateContent',{method:'POST',credentials:'omit',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{role:'user',parts:[{text:trial.prompt}]}],generationConfig:{maxOutputTokens:128,temperature:0}}),signal});
    if(!active())return;
    if(!response.ok){status.textContent=response.status===429?'Cuota gratuita agotada o límite temporal. No se reintentará automáticamente.':response.status===401||response.status===403?'Google ha rechazado la clave o sus permisos.':response.status===404?'Este modelo no está disponible en el proyecto. No se cambiará a otro automáticamente.':'Google no ha completado la prueba (HTTP '+response.status+').';return;}
    const data=await response.json();if(!active())return;
    const answer=(data.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string').map(p=>p.text).join('').trim().slice(0,1000);
    status.textContent=answer===trial.expected?'Conexión y respuesta comprobadas.':'Google ha respondido, pero la respuesta no coincide con la prueba esperada.';
    output.textContent=answer||'Sin respuesta de texto.';output.hidden=false;
   }catch{if(active())status.textContent=signal.aborted?'La prueba se ha cancelado o ha agotado el tiempo.':'No se pudo conectar con Google. Comprueba la red y las restricciones de la clave.';}
   finally{clearTimeout(timeout);if(timer===timeout)timer=null;if(active()){keyInput.value='';busy=false;button.disabled=false;controller=null;}}
  },{signal:listeners.signal});
 }};
}
