/** Presentation only: fit the conversation to the visible viewport without growing when the document scrolls. */
export function bindChatViewport(host){
 let frame=null,disposed=false;
 const viewport=window.visualViewport;
 function measure(){
  frame=null;if(disposed||!host.isConnected)return;
  const root=host.matches('.team-chat')?host:host.querySelector('.team-chat');if(!root)return;
  const top=viewport?.offsetTop||0,height=viewport?.height||window.innerHeight;
  const available=Math.max(120,Math.floor(top+height-Math.max(root.getBoundingClientRect().top+window.scrollY,top)-12));
  root.toggleAttribute('data-chat-short',available<340);
  const value=available+'px';if(root.style.getPropertyValue('--chat-visible-height')!==value)root.style.setProperty('--chat-visible-height',value);
 }
 function refresh(){if(!disposed&&frame===null)frame=requestAnimationFrame(measure);}
 const sizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(refresh):null;sizeObserver?.observe(host);if(host.parentElement)sizeObserver?.observe(host.parentElement);
 window.addEventListener('resize',refresh);window.addEventListener('scroll',refresh,{passive:true});
 viewport?.addEventListener('resize',refresh);viewport?.addEventListener('scroll',refresh);
 refresh();return {refresh,dispose(){disposed=true;sizeObserver?.disconnect();if(frame!==null)cancelAnimationFrame(frame);window.removeEventListener('resize',refresh);window.removeEventListener('scroll',refresh);viewport?.removeEventListener('resize',refresh);viewport?.removeEventListener('scroll',refresh);}};
}
