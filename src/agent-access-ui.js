import {modal,closeModal,btn,formField} from './components.js';
import {esc} from './utils.js';
import {invokeTeam} from './api.js';
export async function openAgentAccess(member){
 if(!member?.active||member.deleted_at||member.purged_at)throw Error('Activa primero la cuenta de la IA.');
 const status=await invokeTeam({action:'agent_access_status',email:member.email});
 modal('Acceso de IA · '+member.full_name,'<p>Vincula esta cuenta para que una IA trabaje con su identidad y sus permisos. Sirve para asistentes externos y para asignarla a una API. Elige una cuenta propia de IA, no la cuenta personal de un empleado.</p>'+
 '<div class="note"><b>'+esc(member.email)+'</b><br>Rol actual: '+esc(member.role)+' · '+(status.configured?'Acceso configurado':'Pendiente de vincular')+'</div>'+
 '<div class="form-grid" style="margin-top:16px">'+formField('Contraseña actual de esta cuenta','agentAccessPassword','','password','autocomplete="current-password" data-draft-ignore')+
 '<p class="small muted">Las cuentas técnicas creadas por el gestor de APIs pueden reutilizar su acceso guardado dejando el campo vacío. Para una cuenta manual, escribe su contraseña actual solo aquí. Se verifica y se conserva cifrada; no se muestra ni se envía a los chats.</p></div>'+
 '<label class="check-field" style="margin-top:14px"><input id="agentAccessLegacy" type="checkbox" '+(status.legacy_chatgpt||String(member.full_name).trim().toLowerCase()==='chatgpt'?'checked':'')+'>Usar también con el conector ChatGPT existente</label>'+
 '<p class="small muted">Las demás IA usan el mismo acceso indicando su propia cuenta. Su rol y permisos se mantienen. Un límite o fallo del proveedor se informa por separado.</p>'+
 '<div class="form-actions">'+btn('Verificar y vincular cuenta','user-agent-access-save','primary','data-email="'+esc(member.email)+'"')+'</div>');
}
export async function saveAgentAccess(email){
 const input=document.querySelector('#agentAccessPassword');
 if(!input)throw Error('Abre primero la configuración de acceso.');
 const result=await invokeTeam({action:'configure_agent_access',email,password:input.value,legacy_chatgpt:document.querySelector('#agentAccessLegacy')?.checked===true});
 input.value='';closeModal();return result;
}
