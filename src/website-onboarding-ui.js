import {esc} from './utils.js';
import {showProductDialog} from './productos-dialogs.js';

export async function openWebsiteSettings({root,connection,rpc,current,trigger,onSaved=()=>{}}){
 const context=await rpc('totus_websites',{p_action:'manage'});
 if(!current())return;
 const website=context.websites.find(w=>w.connection_id===connection.id);
 if(!website)throw Error('Guarda una conexión PrestaShop con una dirección HTTPS /api válida.');
 const dialog=document.createElement('dialog');dialog.className='prd-select-dialog api-website-dialog';
 const option=(id,name,value)=>'<option value="'+esc(id)+'" '+(id===value?'selected':'')+'>'+esc(name)+'</option>';
 dialog.innerHTML='<form><header class="section-head"><h3>Tienda y módulos</h3><button type="button" class="btn secondary" data-close aria-label="Cerrar">×</button></header>'+
 '<p>Esta web tiene una identidad propia. Sus productos, pedidos y datos se mantienen separados de las demás webs, aunque pertenezcan al mismo negocio.</p>'+
 '<div class="form-grid"><label>Nombre visible<input name="name" required maxlength="100" value="'+esc(website.name)+'"></label>'+
 '<label>Estado<select name="status">'+[['active','Disponible en los módulos'],['disabled','Desactivada'],['retired','Retirada · conservar historial']].map(([id,label])=>option(id,label,website.status)).join('')+'</select></label>'+
 '<label>Negocio físico asociado<select name="business_id">'+option('','Sin asociar · web independiente',website.business_id||'')+(context.businesses||[]).map(b=>option(b.id,b.name,website.business_id)).join('')+'</select></label></div>'+
 '<label class="check"><input type="checkbox" name="include_in_totals" '+(website.include_in_totals?'checked':'')+'> Incluir en los totales consolidados</label>'+
 '<p class="small">Una web de preproducción o con pedidos migrados se deja fuera de los totales para evitar contar dos veces las mismas ventas. Siempre puedes consultarla por separado.</p>'+
 '<p class="small">La clave, los permisos de usuario y la prueba de conexión se gestionan en APIs. Cambiar este nombre no modifica el catálogo ni los identificadores de la web.</p>'+
 '<p role="status" data-status></p><div class="form-actions"><button type="button" class="btn secondary" data-close>Cancelar</button><button type="submit" class="btn primary">Guardar tienda</button></div></form>';
 for(const button of dialog.querySelectorAll('[data-close]'))button.onclick=()=>dialog.close();
 dialog.querySelector('form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,values=new FormData(form),buttons=dialog.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try{await rpc('totus_websites',{p_action:'save',p_data:{key:website.key,connection_id:connection.id,expected_revision:website.revision,name:String(values.get('name')||'').trim(),status:values.get('status'),business_id:values.get('business_id')||null,include_in_totals:values.has('include_in_totals')}});if(!current())return;dialog.close();await onSaved();}
  catch(error){if(current())dialog.querySelector('[data-status]').textContent=error.message;}
  finally{buttons.forEach(b=>b.disabled=false);}
 };
 showProductDialog(root,dialog,{label:'Configuración de la tienda '+website.name,trigger});
}
