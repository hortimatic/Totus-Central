const WIDTH=1000,HEIGHT=400,MAX_POINTS=4096,MAX_STROKES=128;
export function signatureInk(value){
 if(!value||Object.keys(value).some(key=>!['width','height','strokes'].includes(key))||value.width!==WIDTH||value.height!==HEIGHT||!Array.isArray(value.strokes)||value.strokes.length>MAX_STROKES)throw Error('Revisa la firma del cliente.');
 if(!value.strokes.length)throw Error('Traza la firma antes de continuar.');
 let points=0,distance=0;
 const strokes=value.strokes.map(stroke=>{
  if(!Array.isArray(stroke)||stroke.length<2)throw Error('Traza la firma antes de continuar.');
  return stroke.map((point,index)=>{
   if(++points>MAX_POINTS||!Array.isArray(point)||point.length!==2||!point.every(Number.isSafeInteger)||point[0]<0||point[0]>WIDTH||point[1]<0||point[1]>HEIGHT)throw Error('La firma no es válida o contiene demasiados trazos.');
   if(index)distance+=Math.hypot(point[0]-stroke[index-1][0],point[1]-stroke[index-1][1]);return [...point];
  });
 });
 if(distance<12)throw Error('Traza la firma antes de continuar.');
 return {width:WIDTH,height:HEIGHT,strokes};
}
/** SVG is constructed solely from bounded integer coordinates; no input markup. */
export function signatureSvg(value){const ink=signatureInk(value);return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Firma del cliente"><rect width="1000" height="400" fill="white"/><g fill="none" stroke="#111827" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${ink.strokes.map(stroke=>`<path d="M${stroke.map(point=>point.join(' ')).join(' L')}"/>`).join('')}</g></svg>`;}
export function createSignatureCapture(){
 let active=null;
 function cancel(){active?.finish(null);}
 function capture({documentLabel,acceptanceText=''}){
  if(active)throw Error('Termina primero la firma actual.');
  if(typeof documentLabel!=='string'||!documentLabel.trim()||documentLabel.length>120||typeof acceptanceText!=='string'||acceptanceText.length>500)throw Error('No se ha podido identificar el documento que se va a firmar.');
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog'),strokes=[];let drawing=null,pointer=null,settled=false;active={finish};
   function finish(value){if(settled)return;settled=true;active=null;if(dialog.open)dialog.close();dialog.remove();resolve(value);}
   dialog.className='tpv-signature-dialog';dialog.setAttribute('aria-labelledby','tpvSignatureTitle');
   dialog.innerHTML='<form><h3 id="tpvSignatureTitle">Firma del cliente</h3><p data-signature-document></p><p data-signature-text></p><p class="small muted">Firma con el dedo, un lápiz o el ratón dentro del recuadro.</p><canvas width="1000" height="400" aria-label="Recuadro para la firma del cliente"></canvas><p role="alert" hidden></p><footer><button type="button" class="btn secondary" data-signature-clear>Borrar firma</button><button type="button" class="btn secondary" data-signature-cancel>Cancelar</button><button type="submit" class="btn primary">Aceptar firma</button></footer></form>';
   dialog.style.cssText='width:min(680px,calc(100vw - 24px));box-sizing:border-box;max-height:calc(100dvh - 24px);overflow:auto;border:1px solid var(--line,#ccd5df);border-radius:16px;padding:20px;background:var(--panel,#fff);color:var(--text,#111827)';
   dialog.querySelector('[data-signature-document]').textContent=documentLabel;
   dialog.querySelector('[data-signature-text]').textContent=acceptanceText;
   const canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),alert=dialog.querySelector('[role=alert]');
   canvas.style.cssText='display:block;box-sizing:border-box;width:100%;height:auto;aspect-ratio:5/2;touch-action:none;border:1px solid var(--line,#ccd5df);border-radius:8px;background:#fff';
   const footer=dialog.querySelector('footer');footer.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin-top:16px';
   function paint(){ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.strokeStyle='#111827';ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';for(const stroke of [...strokes,...(drawing?[drawing]:[])]){ctx.beginPath();stroke.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();}}
   function point(event){const rect=canvas.getBoundingClientRect();return [Math.round(Math.max(0,Math.min(WIDTH,(event.clientX-rect.left)/rect.width*WIDTH))),Math.round(Math.max(0,Math.min(HEIGHT,(event.clientY-rect.top)/rect.height*HEIGHT)))];}
   function message(text){alert.textContent=text;alert.hidden=!text;}
   canvas.addEventListener('pointerdown',event=>{if(pointer!==null||event.button!==0||strokes.length>=MAX_STROKES)return;event.preventDefault();pointer=event.pointerId;drawing=[point(event)];canvas.setPointerCapture(pointer);message('');});
   canvas.addEventListener('pointermove',event=>{if(event.pointerId!==pointer||!drawing)return;if(strokes.reduce((n,s)=>n+s.length,0)+drawing.length>=MAX_POINTS){message('La firma contiene demasiados trazos. Bórrala e inténtalo de nuevo.');return;}const next=point(event),last=drawing.at(-1);if(next[0]!==last[0]||next[1]!==last[1])drawing.push(next);paint();});
   function stop(event){if(event.pointerId!==pointer)return;if(event.type==='pointerup'&&drawing?.length>=2)strokes.push(drawing);drawing=null;pointer=null;paint();}
   canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);canvas.addEventListener('lostpointercapture',stop);
   dialog.querySelector('[data-signature-clear]').onclick=()=>{drawing=null;pointer=null;strokes.length=0;message('');paint();};
   dialog.querySelector('[data-signature-cancel]').onclick=()=>finish(null);dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});dialog.addEventListener('close',()=>finish(null));
   dialog.querySelector('form').onsubmit=event=>{event.preventDefault();if(pointer!==null){message('Termina el trazo antes de aceptar la firma.');return;}try{finish(signatureInk({width:WIDTH,height:HEIGHT,strokes}));}catch(error){message(error.message);}};
   document.body.append(dialog);dialog.showModal();dialog.querySelector('[data-signature-cancel]').focus();
  });
 }
 return {capture,cancel};
}
